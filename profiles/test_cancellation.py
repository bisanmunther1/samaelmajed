"""FR-40 — cancellation, refund tiers, seat release and promo reversal."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from promotions.models import PERCENTAGE, PromoCode, PromoCodeUsage
from trips.availability import availability_row
from trips.models import TripAvailability, Trips

from .models import (
    REFUND_NOT_APPLICABLE, REFUND_PENDING, STATUS_CANCELLED, STATUS_CONFIRMED,
    Profile, Trip_per_user,
)
from .policies import TIER_FULL, TIER_NONE, TIER_PARTIAL


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=0, discount=0,
                    desc='d', type='Beach', available=True, capacity=10)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class CancellationTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.user = User.objects.create_user(username='owner', password='pass1234')
        self.profile = Profile.objects.create(username='owner', email='o@example.com', user=self.user)
        self.stranger = User.objects.create_user(username='stranger', password='pass1234')
        Profile.objects.create(username='stranger', email='s@example.com', user=self.stranger)
        self.staff = User.objects.create_user(username='staffer', password='pass1234', is_staff=True)

        self.trip = make_trip('Cancel Trip')

    def make_booking(self, days_ahead=20, seats=2, price='200.00', **overrides):
        departure = self.today + timedelta(days=days_ahead)
        values = dict(
            username=self.profile, trip=self.trip, trip_date=departure,
            price=Decimal(price), seats=seats, is_paid=True,
        )
        values.update(overrides)
        booking = Trip_per_user.objects.create(**values)

        # Mirror what the booking endpoint would have reserved.
        row = availability_row(self.trip, booking.trip_date)
        TripAvailability.objects.filter(pk=row.pk).update(booked_seats=booking.seats)
        return booking

    def preview(self, booking, user=None):
        self.client.force_authenticate(user=user or self.user)
        return self.client.get(f'/api/bookings/{booking.pk}/cancellation-preview/')

    def cancel(self, booking, user=None, reason='changed my plans'):
        self.client.force_authenticate(user=user or self.user)
        return self.client.post(f'/api/bookings/{booking.pk}/cancel/', {'reason': reason}, format='json')


class RefundTierTests(CancellationTestBase):

    def test_more_than_seven_days_out_is_a_full_refund(self):
        booking = self.make_booking(days_ahead=10)

        data = self.preview(booking).data

        self.assertEqual(data['refund_tier'], TIER_FULL)
        self.assertEqual(data['refund_amount'], Decimal('200.00'))

    def test_exactly_seven_days_out_is_half(self):
        booking = self.make_booking(days_ahead=7)

        data = self.preview(booking).data

        self.assertEqual(data['refund_tier'], TIER_PARTIAL)
        self.assertEqual(data['refund_amount'], Decimal('100.00'))

    def test_three_days_out_is_half(self):
        booking = self.make_booking(days_ahead=3)

        self.assertEqual(self.preview(booking).data['refund_tier'], TIER_PARTIAL)

    def test_two_days_out_is_nothing(self):
        booking = self.make_booking(days_ahead=2)

        data = self.preview(booking).data

        self.assertEqual(data['refund_tier'], TIER_NONE)
        self.assertEqual(data['refund_amount'], Decimal('0.00'))

    def test_the_preview_changes_nothing(self):
        booking = self.make_booking()

        self.preview(booking)

        booking.refresh_from_db()
        self.assertEqual(booking.status, STATUS_CONFIRMED)


class CancelEndpointTests(CancellationTestBase):

    def test_cancelling_marks_the_booking_and_stores_the_refund(self):
        booking = self.make_booking(days_ahead=10)

        response = self.cancel(booking)

        self.assertEqual(response.status_code, 200, response.data)
        booking.refresh_from_db()
        self.assertEqual(booking.status, STATUS_CANCELLED)
        self.assertEqual(booking.refund_amount, Decimal('200.00'))
        self.assertEqual(booking.refund_status, REFUND_PENDING)
        self.assertEqual(booking.cancellation_reason, 'changed my plans')
        self.assertIsNotNone(booking.cancelled_at)

    def test_a_zero_refund_is_not_marked_pending(self):
        booking = self.make_booking(days_ahead=1)

        self.cancel(booking)

        booking.refresh_from_db()
        self.assertEqual(booking.refund_amount, Decimal('0.00'))
        self.assertEqual(booking.refund_status, REFUND_NOT_APPLICABLE)

    def test_cancelling_releases_the_seats(self):
        booking = self.make_booking(seats=3)
        self.assertEqual(availability_row(self.trip, booking.trip_date).booked_seats, 3)

        self.cancel(booking)

        self.assertEqual(availability_row(self.trip, booking.trip_date).booked_seats, 0)

    def test_the_released_seats_are_bookable_again(self):
        booking = self.make_booking(seats=10)
        self.cancel(booking)

        row = availability_row(self.trip, booking.trip_date)
        self.assertEqual(row.remaining_seats, 10)

    def test_a_booking_cannot_be_cancelled_twice(self):
        booking = self.make_booking()
        self.cancel(booking)

        response = self.cancel(booking)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'booking_already_cancelled')

    def test_a_second_cancel_does_not_release_the_seats_again(self):
        booking = self.make_booking(seats=2)
        self.cancel(booking)
        self.cancel(booking)

        self.assertEqual(availability_row(self.trip, booking.trip_date).booked_seats, 0)

    def test_a_departed_trip_cannot_be_cancelled(self):
        booking = self.make_booking(days_ahead=-1)

        response = self.cancel(booking)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'trip_already_departed')

    def test_a_trip_departing_today_can_still_be_cancelled_at_no_refund(self):
        booking = self.make_booking(days_ahead=0)

        response = self.cancel(booking)

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        self.assertEqual(booking.refund_amount, Decimal('0.00'))

    def test_a_stranger_cannot_cancel_a_booking_that_is_not_theirs(self):
        booking = self.make_booking()

        response = self.cancel(booking, user=self.stranger)

        self.assertEqual(response.status_code, 404)
        booking.refresh_from_db()
        self.assertEqual(booking.status, STATUS_CONFIRMED)

    def test_staff_can_cancel_any_booking(self):
        booking = self.make_booking()

        self.assertEqual(self.cancel(booking, user=self.staff).status_code, 200)

    def test_anonymous_users_are_refused(self):
        booking = self.make_booking()
        self.client.force_authenticate(user=None)

        response = self.client.post(f'/api/bookings/{booking.pk}/cancel/', {}, format='json')

        self.assertIn(response.status_code, (401, 403))

    def test_an_unknown_booking_is_a_coded_404(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/bookings/999999/cancel/', {}, format='json')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'booking_not_found')


class CancellationFreesThePromoCodeTests(CancellationTestBase):

    def setUp(self):
        super().setUp()
        self.promo = PromoCode.objects.create(
            code='SAVE10', description='welcome discount', discount_type=PERCENTAGE,
            discount_value=Decimal('10'), usage_limit_per_user=1,
            valid_from=timezone.now() - timedelta(days=1),
            valid_until=timezone.now() + timedelta(days=30),
        )

    def book_with_promo(self):
        self.client.post('/profile/update_profile/', {
            'username': 'owner', 'price': 200,
            'trip_date': str(self.today + timedelta(days=20)),
            'trip_name': 'Cancel Trip', 'hotel_name': 'no_name',
            'hotel_reserve_date': '', 'promo_code': 'SAVE10',
        }, format='json')
        return Trip_per_user.objects.get(username=self.profile)

    def test_cancelling_returns_the_code_to_the_pool(self):
        booking = self.book_with_promo()
        self.promo.refresh_from_db()
        self.assertEqual(self.promo.times_used, 1)

        self.cancel(booking)

        self.promo.refresh_from_db()
        self.assertEqual(self.promo.times_used, 0)
        self.assertFalse(PromoCodeUsage.objects.exists())

    def test_the_freed_code_can_be_used_again_by_the_same_customer(self):
        booking = self.book_with_promo()
        self.cancel(booking)

        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/promotions/validate/', {
            'code': 'SAVE10', 'trip': 'Cancel Trip', 'amount': '200',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)

    def test_the_booking_keeps_its_pricing_record(self):
        booking = self.book_with_promo()

        self.cancel(booking)

        booking.refresh_from_db()
        # What they were charged stays on the row even though the code is freed.
        self.assertEqual(booking.discount_amount, Decimal('20.00'))
        self.assertEqual(booking.price, Decimal('180.00'))
        self.assertEqual(booking.refund_amount, Decimal('180.00'))


class CancelledBookingsAreExcludedTests(CancellationTestBase):
    """FR-37 must not count cancelled business; FR-38 must not review it."""

    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(username='statsadmin', password='pass1234', is_staff=True)

    def test_statistics_ignore_a_cancelled_booking(self):
        kept = self.make_booking(days_ahead=10)
        cancelled = self.make_booking(days_ahead=12, trip_date=self.today + timedelta(days=12))
        self.cancel(cancelled)

        self.client.force_authenticate(user=self.admin)
        data = self.client.get('/statistics/').json()

        self.assertEqual(data['total_bookings'], 1)
        counts = {row['trip_name']: row['bookings_count'] for row in data['most_booked_trips']}
        self.assertEqual(counts['Cancel Trip'], 1)
        self.assertIsNotNone(kept)

    def test_a_cancelled_booking_cannot_be_reviewed(self):
        booking = self.make_booking(days_ahead=-3, seats=1)
        Trip_per_user.objects.filter(pk=booking.pk).update(
            status=STATUS_CANCELLED, trip_date=self.today - timedelta(days=3),
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/reviews/', {
            'booking': booking.pk, 'trip': 'Cancel Trip', 'rating': 5, 'comment': 'great',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'booking_cancelled')

    def test_a_cancelled_booking_is_not_offered_for_review(self):
        booking = self.make_booking(days_ahead=-3, seats=1)
        Trip_per_user.objects.filter(pk=booking.pk).update(status=STATUS_CANCELLED)

        self.client.force_authenticate(user=self.user)
        rows = self.client.get('/api/reviews/pending/').json()

        self.assertNotIn(booking.pk, [row['booking'] for row in rows])
