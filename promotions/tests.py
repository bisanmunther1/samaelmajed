from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from profiles.models import Profile, Trip_per_user
from trips.models import Trips

from .models import FIXED, PERCENTAGE, PromoCode, PromoCodeUsage

VALIDATE_URL = '/api/promotions/validate/'
ACTIVE_URL = '/api/promotions/active/'
BOOKING_URL = '/profile/update_profile/'


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=5, discount=0,
                    desc='d', type='Beach', available=True)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class PromoTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()

        self.user = User.objects.create_user(username='buyer', password='pass1234')
        self.profile = Profile.objects.create(username='buyer', email='b@example.com', user=self.user)
        self.other_user = User.objects.create_user(username='other', password='pass1234')
        self.other_profile = Profile.objects.create(username='other', email='o@example.com', user=self.other_user)

        self.trip = make_trip('Promo Trip')

    def make_code(self, code='SAVE10', **overrides):
        values = dict(
            description='خصم ترحيبي',
            discount_type=PERCENTAGE,
            discount_value=Decimal('10'),
            valid_from=self.now - timedelta(days=1),
            valid_until=self.now + timedelta(days=30),
            usage_limit_per_user=1,
        )
        values.update(overrides)
        return PromoCode.objects.create(code=code, **values)

    def validate(self, **overrides):
        payload = dict(code='SAVE10', trip='Promo Trip', amount='200.00')
        payload.update(overrides)
        self.client.force_authenticate(user=self.user)
        return self.client.post(VALIDATE_URL, payload, format='json')

    def book(self, **overrides):
        payload = dict(
            username='buyer', price=200, trip_date='2026-05-01',
            trip_name='Promo Trip', hotel_name='no_name', hotel_reserve_date='',
        )
        payload.update(overrides)
        return self.client.post(BOOKING_URL, payload, format='json')


class PromoCodeModelTests(PromoTestBase):

    def test_code_is_stored_uppercase(self):
        promo = self.make_code(code='  welcome  ')
        self.assertEqual(promo.code, 'WELCOME')

    def test_a_percentage_outside_1_to_100_is_rejected(self):
        promo = PromoCode(
            code='BAD', description='d', discount_type=PERCENTAGE, discount_value=Decimal('150'),
            valid_from=self.now, valid_until=self.now + timedelta(days=1),
        )
        with self.assertRaises(ValidationError):
            promo.full_clean()

    def test_valid_until_must_follow_valid_from(self):
        promo = PromoCode(
            code='BAD2', description='d', discount_type=FIXED, discount_value=Decimal('5'),
            valid_from=self.now, valid_until=self.now - timedelta(days=1),
        )
        with self.assertRaises(ValidationError):
            promo.full_clean()

    def test_a_fixed_discount_may_exceed_one_hundred(self):
        promo = PromoCode(
            code='BIG', description='d', discount_type=FIXED, discount_value=Decimal('250'),
            valid_from=self.now, valid_until=self.now + timedelta(days=1),
        )
        promo.full_clean()  # must not raise


class ValidateEndpointTests(PromoTestBase):

    def test_requires_authentication(self):
        self.make_code()
        response = self.client.post(VALIDATE_URL, {'code': 'SAVE10', 'amount': '200'}, format='json')

        self.assertIn(response.status_code, (401, 403))

    def test_a_valid_percentage_code_is_priced(self):
        self.make_code()

        response = self.validate()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['discount_amount'], Decimal('20.00'))
        self.assertEqual(response.data['final_amount'], Decimal('180.00'))
        self.assertEqual(response.data['description'], 'خصم ترحيبي')

    def test_a_fixed_code_is_priced(self):
        self.make_code(discount_type=FIXED, discount_value=Decimal('35'))

        response = self.validate()

        self.assertEqual(response.data['discount_amount'], Decimal('35.00'))
        self.assertEqual(response.data['final_amount'], Decimal('165.00'))

    def test_a_percentage_is_capped_by_max_discount(self):
        self.make_code(discount_value=Decimal('50'), max_discount=Decimal('30'))

        response = self.validate(amount='400')

        # 50% of 400 is 200, but the cap is 30.
        self.assertEqual(response.data['discount_amount'], Decimal('30.00'))
        self.assertEqual(response.data['final_amount'], Decimal('370.00'))

    def test_a_discount_never_pushes_the_total_below_zero(self):
        self.make_code(discount_type=FIXED, discount_value=Decimal('500'))

        response = self.validate(amount='120')

        self.assertEqual(response.data['discount_amount'], Decimal('120.00'))
        self.assertEqual(response.data['final_amount'], Decimal('0.00'))

    def test_matching_is_case_insensitive(self):
        self.make_code()

        self.assertEqual(self.validate(code='save10').status_code, 200)

    def test_a_dry_run_changes_nothing(self):
        promo = self.make_code()

        self.validate()

        promo.refresh_from_db()
        self.assertEqual(promo.times_used, 0)
        self.assertFalse(PromoCodeUsage.objects.exists())

    # --- rejection reasons, one each ---

    def test_unknown_code(self):
        response = self.validate(code='NOPE')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'promo_not_found')
        self.assertEqual(response.data['detail'], 'كود الخصم غير صحيح.')

    def test_inactive_code(self):
        self.make_code(is_active=False)

        self.assertEqual(self.validate().data['code'], 'promo_inactive')

    def test_code_outside_its_date_window(self):
        self.make_code(valid_from=self.now - timedelta(days=10),
                       valid_until=self.now - timedelta(days=5))

        self.assertEqual(self.validate().data['code'], 'promo_not_in_window')

    def test_global_usage_limit_reached(self):
        self.make_code(usage_limit=2, times_used=2)

        self.assertEqual(self.validate().data['code'], 'promo_usage_limit_reached')

    def test_per_user_limit_reached(self):
        promo = self.make_code(usage_limit_per_user=1)
        booking = Trip_per_user.objects.create(username=self.profile, trip=self.trip, price=100)
        PromoCodeUsage.objects.create(
            promo_code=promo, user=self.user, booking=booking, discount_amount=Decimal('10'),
        )

        self.assertEqual(self.validate().data['code'], 'promo_user_limit_reached')

    def test_another_users_redemption_does_not_block_me(self):
        promo = self.make_code(usage_limit_per_user=1)
        booking = Trip_per_user.objects.create(username=self.other_profile, trip=self.trip, price=100)
        PromoCodeUsage.objects.create(
            promo_code=promo, user=self.other_user, booking=booking, discount_amount=Decimal('10'),
        )

        self.assertEqual(self.validate().status_code, 200)

    def test_amount_below_the_minimum(self):
        self.make_code(min_booking_amount=Decimal('500'))

        self.assertEqual(self.validate(amount='200').data['code'], 'promo_min_amount_not_met')

    def test_trip_not_in_the_applicable_list(self):
        promo = self.make_code()
        promo.applicable_trips.add(make_trip('Other Trip'))

        self.assertEqual(self.validate().data['code'], 'promo_trip_not_eligible')

    def test_trip_inside_the_applicable_list_is_accepted(self):
        promo = self.make_code()
        promo.applicable_trips.add(self.trip)

        self.assertEqual(self.validate().status_code, 200)

    def test_a_non_numeric_amount(self):
        self.make_code()

        self.assertEqual(self.validate(amount='abc').data['code'], 'promo_invalid_amount')


class ActiveCodesEndpointTests(PromoTestBase):

    def test_is_public_and_lists_currently_valid_codes(self):
        self.make_code(code='LIVE')

        response = self.client.get(ACTIVE_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['code'] for row in response.data], ['LIVE'])

    def test_hides_inactive_expired_and_exhausted_codes(self):
        self.make_code(code='OFF', is_active=False)
        self.make_code(code='EXPIRED', valid_from=self.now - timedelta(days=9),
                       valid_until=self.now - timedelta(days=2))
        self.make_code(code='SPENT', usage_limit=1, times_used=1)

        response = self.client.get(ACTIVE_URL)

        self.assertEqual(response.data, [])

    def test_hides_trip_restricted_codes(self):
        promo = self.make_code(code='TRIPONLY')
        promo.applicable_trips.add(self.trip)

        self.assertEqual(self.client.get(ACTIVE_URL).data, [])

    def test_does_not_leak_the_usage_counters(self):
        self.make_code(code='LIVE', usage_limit=5, times_used=3)

        row = self.client.get(ACTIVE_URL).data[0]

        self.assertNotIn('times_used', row)
        self.assertNotIn('usage_limit', row)


class BookingWithPromoTests(PromoTestBase):

    def test_a_booking_without_a_code_is_unaffected(self):
        response = self.book()

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.price, Decimal('200'))
        self.assertEqual(booking.discount_amount, Decimal('0'))
        self.assertIsNone(booking.promo_code)
        self.assertFalse(PromoCodeUsage.objects.exists())

    def test_a_valid_code_discounts_the_stored_price(self):
        promo = self.make_code()

        response = self.book(promo_code='SAVE10')

        self.assertEqual(response.status_code, 200, response.data)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.original_price, Decimal('200.00'))
        self.assertEqual(booking.discount_amount, Decimal('20.00'))
        self.assertEqual(booking.price, Decimal('180.00'))
        self.assertEqual(booking.promo_code_id, promo.pk)

    def test_redemption_records_usage_and_increments_the_counter_once(self):
        promo = self.make_code()

        self.book(promo_code='SAVE10')

        promo.refresh_from_db()
        self.assertEqual(promo.times_used, 1)
        usage = PromoCodeUsage.objects.get()
        self.assertEqual(usage.user, self.user)
        self.assertEqual(usage.discount_amount, Decimal('20.00'))
        self.assertEqual(usage.booking, Trip_per_user.objects.get(username=self.profile))

    def test_the_per_user_limit_holds_across_two_bookings(self):
        promo = self.make_code(usage_limit_per_user=1)
        self.assertEqual(self.book(promo_code='SAVE10').status_code, 200)

        second = self.book(trip_date='2026-06-01', promo_code='SAVE10')

        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.data['code'], 'promo_user_limit_reached')
        promo.refresh_from_db()
        self.assertEqual(promo.times_used, 1)

    def test_a_rejected_code_creates_no_booking_at_all(self):
        self.make_code(is_active=False)

        response = self.book(promo_code='SAVE10')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'promo_inactive')
        # The whole unit of work rolled back — including the trip's visitor count.
        self.assertFalse(Trip_per_user.objects.exists())
        self.trip.refresh_from_db()
        self.assertEqual(self.trip.num, 5)

    def test_the_client_cannot_dictate_the_discount(self):
        self.make_code(discount_value=Decimal('10'))

        # A client claiming a huge discount still only gets the code's 10%.
        self.book(promo_code='SAVE10', discount_amount=999, price=200)

        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.discount_amount, Decimal('20.00'))
        self.assertEqual(booking.price, Decimal('180.00'))

    def test_an_unknown_code_is_rejected_at_booking_time(self):
        response = self.book(promo_code='GHOST')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'promo_not_found')
        self.assertFalse(Trip_per_user.objects.exists())

    def test_original_price_is_recorded_even_without_a_code(self):
        self.book()

        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.original_price, Decimal('200.00'))
