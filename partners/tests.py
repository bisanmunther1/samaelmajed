"""FR-46 — partner role and object-level access control.

The isolation tests are the point of this file: a partner must not be able to
reach another partner's data through any endpoint, including by guessing an id.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from hotels.models import Hotels
from profiles.models import Profile, Trip_per_user
from trip_features.models import Trip_features
from trips.models import Trips

from .models import HOTEL_MANAGER, TOUR_OPERATOR, Partner

REGISTER_URL = '/api/partner/register/'
ME_URL = '/api/partner/me/'
LISTINGS_URL = '/api/partner/listings/'
BOOKINGS_URL = '/api/partner/bookings/'
DASHBOARD_URL = '/api/partner/dashboard/'


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=0, discount=0,
                    desc='d', type='Beach', available=True, capacity=10)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class PartnerTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.customer = self.make_user('shopper')
        self.staff = User.objects.create_user(username='boss', password='pass1234', is_staff=True)

        self.user_a = self.make_user('alpha')
        self.partner_a = Partner.objects.create(
            user=self.user_a, business_name='Alpha Tours',
            partner_type=TOUR_OPERATOR, is_approved=True,
        )
        self.user_b = self.make_user('beta')
        self.partner_b = Partner.objects.create(
            user=self.user_b, business_name='Beta Tours',
            partner_type=TOUR_OPERATOR, is_approved=True,
        )

        self.trip_a = make_trip('Alpha Trip', partner=self.partner_a)
        self.trip_b = make_trip('Beta Trip', partner=self.partner_b)
        # Belongs to the platform: no partner may touch it.
        self.trip_platform = make_trip('Platform Trip')

    def make_user(self, username):
        user = User.objects.create_user(username=username, password='pass1234')
        Profile.objects.create(username=username, email=f'{username}@example.com', user=user)
        return user

    def as_user(self, user):
        self.client.force_authenticate(user=user)
        return self.client


class RoleFieldTests(PartnerTestBase):

    def test_a_new_profile_is_a_customer(self):
        self.assertEqual(Profile.objects.get(username='shopper').role, 'customer')

    def test_the_token_carries_the_role(self):
        response = self.client.post('/token/', {'username': 'shopper', 'password': 'pass1234'})

        self.assertEqual(response.status_code, 200)
        # The claim is convenience only; the value must still be right.
        import jwt
        claims = jwt.decode(response.data['access'], options={'verify_signature': False})
        self.assertEqual(claims['role'], 'customer')

    def test_registering_flips_the_role_to_partner(self):
        self.as_user(self.customer).post(REGISTER_URL, {
            'business_name': 'Shopper Travel', 'partner_type': TOUR_OPERATOR,
        }, format='json')

        self.assertEqual(Profile.objects.get(username='shopper').role, 'partner')

    def test_is_staff_is_untouched_by_the_role_field(self):
        # Jazzmin and Django admin still key off is_staff, which FR-46 does not
        # write to. The staff account keeps its access.
        self.assertTrue(User.objects.get(username='boss').is_staff)


class RegistrationTests(PartnerTestBase):

    def test_a_customer_can_apply_and_starts_unapproved(self):
        response = self.as_user(self.customer).post(REGISTER_URL, {
            'business_name': 'Shopper Travel', 'partner_type': TOUR_OPERATOR,
            'contact_email': 'shop@example.com',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(response.data['is_approved'])
        self.assertFalse(Partner.objects.get(user=self.customer).is_approved)

    def test_an_applicant_cannot_approve_themselves_in_the_payload(self):
        self.as_user(self.customer).post(REGISTER_URL, {
            'business_name': 'Sneaky Travel', 'partner_type': TOUR_OPERATOR,
            'is_approved': True,
        }, format='json')

        self.assertFalse(Partner.objects.get(user=self.customer).is_approved)

    def test_applying_twice_is_refused(self):
        self.as_user(self.user_a).post(REGISTER_URL, {'business_name': 'Again'}, format='json')

        response = self.as_user(self.user_a).post(REGISTER_URL, {'business_name': 'Again'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'already_a_partner')

    def test_anonymous_users_cannot_apply(self):
        response = self.client.post(REGISTER_URL, {'business_name': 'Ghost'}, format='json')

        self.assertIn(response.status_code, (401, 403))


class ApprovalGateTests(PartnerTestBase):

    def setUp(self):
        super().setUp()
        self.pending_user = self.make_user('pending')
        self.pending_partner = Partner.objects.create(
            user=self.pending_user, business_name='Pending Tours',
            partner_type=TOUR_OPERATOR, is_approved=False,
        )

    def test_an_unapproved_partner_can_see_their_pending_state(self):
        response = self.as_user(self.pending_user).get(ME_URL)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_approved'])

    def test_an_unapproved_partner_is_blocked_from_listings(self):
        for method, url in [
            ('get', LISTINGS_URL), ('post', LISTINGS_URL),
            ('get', f'{LISTINGS_URL}Alpha Trip/'),
            ('patch', f'{LISTINGS_URL}Alpha Trip/'),
            ('delete', f'{LISTINGS_URL}Alpha Trip/'),
        ]:
            response = getattr(self.as_user(self.pending_user), method)(url, {}, format='json')
            self.assertEqual(response.status_code, 403, f'{method} {url}')

    def test_an_unapproved_partner_is_blocked_from_bookings_and_dashboard(self):
        self.assertEqual(self.as_user(self.pending_user).get(BOOKINGS_URL).status_code, 403)
        self.assertEqual(self.as_user(self.pending_user).get(DASHBOARD_URL).status_code, 403)

    def test_approval_opens_the_endpoints(self):
        Partner.objects.filter(pk=self.pending_partner.pk).update(is_approved=True)

        self.assertEqual(self.as_user(self.pending_user).get(LISTINGS_URL).status_code, 200)


class CustomerIsLockedOutTests(PartnerTestBase):

    def test_a_customer_is_blocked_from_every_partner_endpoint(self):
        client = self.as_user(self.customer)

        self.assertEqual(client.get(ME_URL).status_code, 404)
        for url in [LISTINGS_URL, BOOKINGS_URL, DASHBOARD_URL]:
            self.assertEqual(client.get(url).status_code, 403, url)

    def test_a_customer_cannot_reach_a_listing_by_id(self):
        response = self.as_user(self.customer).get(f'{LISTINGS_URL}Alpha Trip/')

        self.assertEqual(response.status_code, 403)

    def test_editing_localstorage_does_not_help_a_customer(self):
        # There is no client-supplied role anywhere in the request; the server
        # derives it from the database every time. Sending one changes nothing.
        response = self.client.get(LISTINGS_URL, HTTP_X_ROLE='partner')

        self.assertIn(response.status_code, (401, 403))


class PartnerIsolationTests(PartnerTestBase):
    """The non-negotiable set: A must never reach B."""

    def test_listings_show_only_the_callers_own(self):
        response = self.as_user(self.user_a).get(LISTINGS_URL)

        names = [row['name'] for row in response.data]
        self.assertEqual(names, ['Alpha Trip'])
        self.assertNotIn('Beta Trip', names)
        self.assertNotIn('Platform Trip', names)

    def test_partner_a_cannot_read_partner_b_listing_by_id(self):
        response = self.as_user(self.user_a).get(f'{LISTINGS_URL}Beta Trip/')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'listing_not_found')

    def test_partner_a_cannot_edit_partner_b_listing_by_id(self):
        response = self.as_user(self.user_a).patch(
            f'{LISTINGS_URL}Beta Trip/', {'price': 1}, format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.trip_b.refresh_from_db()
        self.assertEqual(self.trip_b.price, 100)

    def test_partner_a_cannot_delete_partner_b_listing_by_id(self):
        response = self.as_user(self.user_a).delete(f'{LISTINGS_URL}Beta Trip/')

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Trips.objects.filter(name='Beta Trip').exists())

    def test_no_partner_can_touch_an_unowned_platform_listing(self):
        client = self.as_user(self.user_a)

        self.assertEqual(client.get(f'{LISTINGS_URL}Platform Trip/').status_code, 404)
        self.assertEqual(client.patch(f'{LISTINGS_URL}Platform Trip/', {'price': 1}, format='json').status_code, 404)
        self.assertEqual(client.delete(f'{LISTINGS_URL}Platform Trip/').status_code, 404)
        self.assertTrue(Trips.objects.filter(name='Platform Trip').exists())

    def test_a_partner_cannot_claim_a_listing_by_sending_a_partner_id(self):
        self.as_user(self.user_a).post(LISTINGS_URL, {
            'name': 'Claimed Trip', 'place': 'Cairo', 'price': 50, 'rate': 4,
            'discount': 0, 'desc': 'd', 'type': 'Beach', 'partner': self.partner_b.pk,
        }, format='json')

        created = Trips.objects.get(name='Claimed Trip')
        self.assertEqual(created.partner_id, self.partner_a.pk)

    def test_a_partner_cannot_reassign_an_existing_listing_to_someone_else(self):
        self.as_user(self.user_a).patch(
            f'{LISTINGS_URL}Alpha Trip/', {'partner': self.partner_b.pk}, format='json',
        )

        self.trip_a.refresh_from_db()
        self.assertEqual(self.trip_a.partner_id, self.partner_a.pk)


class PrivilegeEscalationTests(PartnerTestBase):

    def test_a_partner_cannot_approve_themselves_via_patch(self):
        Partner.objects.filter(pk=self.partner_a.pk).update(is_approved=False)

        self.as_user(self.user_a).patch(ME_URL, {'is_approved': True}, format='json')

        self.partner_a.refresh_from_db()
        self.assertFalse(self.partner_a.is_approved)

    def test_a_partner_cannot_change_their_own_partner_type(self):
        self.as_user(self.user_a).patch(ME_URL, {'partner_type': HOTEL_MANAGER}, format='json')

        self.partner_a.refresh_from_db()
        self.assertEqual(self.partner_a.partner_type, TOUR_OPERATOR)

    def test_a_partner_cannot_set_their_own_role(self):
        self.as_user(self.user_a).patch(ME_URL, {'role': 'admin'}, format='json')

        self.assertNotEqual(Profile.objects.get(username='alpha').role, 'admin')

    def test_a_partner_may_still_edit_their_own_contact_details(self):
        response = self.as_user(self.user_a).patch(
            ME_URL, {'business_name': 'Alpha Travel Co', 'contact_phone': '123'}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.partner_a.refresh_from_db()
        self.assertEqual(self.partner_a.business_name, 'Alpha Travel Co')


class ListingLifecycleTests(PartnerTestBase):

    def test_a_partner_creates_a_listing_owned_by_them(self):
        response = self.as_user(self.user_a).post(LISTINGS_URL, {
            'name': 'Brand New Trip', 'place': 'Luxor', 'price': 250, 'rate': 4.5,
            'discount': 0, 'desc': 'A new tour', 'type': 'City', 'capacity': 12,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Trips.objects.get(name='Brand New Trip').partner_id, self.partner_a.pk)

    def test_a_partner_edits_their_own_listing(self):
        response = self.as_user(self.user_a).patch(
            f'{LISTINGS_URL}Alpha Trip/', {'price': 333}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.trip_a.refresh_from_db()
        self.assertEqual(self.trip_a.price, 333)

    def test_a_partner_deletes_their_own_unbooked_listing(self):
        response = self.as_user(self.user_a).delete(f'{LISTINGS_URL}Alpha Trip/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Trips.objects.filter(name='Alpha Trip').exists())

    def test_deleting_a_listing_with_bookings_is_refused_not_cascaded(self):
        profile = Profile.objects.get(username='shopper')
        Trip_per_user.objects.create(
            username=profile, trip=self.trip_a,
            trip_date=self.today + timedelta(days=5), price=Decimal('100'),
        )

        response = self.as_user(self.user_a).delete(f'{LISTINGS_URL}Alpha Trip/')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'listing_has_bookings')
        # The booking history survives, which is the whole point of PROTECT.
        self.assertTrue(Trips.objects.filter(name='Alpha Trip').exists())
        self.assertTrue(Trip_per_user.objects.filter(trip=self.trip_a).exists())


class PartnerBookingsTests(PartnerTestBase):

    def setUp(self):
        super().setUp()
        self.shopper_profile = Profile.objects.get(username='shopper')

        self.booking_a = Trip_per_user.objects.create(
            username=self.shopper_profile, trip=self.trip_a,
            trip_date=self.today + timedelta(days=5), price=Decimal('100'), seats=2,
        )
        self.booking_b = Trip_per_user.objects.create(
            username=self.shopper_profile, trip=self.trip_b,
            trip_date=self.today + timedelta(days=6), price=Decimal('200'), seats=1,
        )
        self.booking_platform = Trip_per_user.objects.create(
            username=self.shopper_profile, trip=self.trip_platform,
            trip_date=self.today + timedelta(days=7), price=Decimal('300'),
        )

    def test_a_partner_sees_only_bookings_on_their_own_listings(self):
        response = self.as_user(self.user_a).get(BOOKINGS_URL)

        ids = [row['id'] for row in response.data]
        self.assertEqual(ids, [self.booking_a.pk])
        self.assertNotIn(self.booking_b.pk, ids)
        self.assertNotIn(self.booking_platform.pk, ids)

    def test_partner_b_sees_only_their_own(self):
        response = self.as_user(self.user_b).get(BOOKINGS_URL)

        self.assertEqual([row['id'] for row in response.data], [self.booking_b.pk])

    def test_bookings_can_be_filtered_by_date(self):
        response = self.as_user(self.user_a).get(BOOKINGS_URL, {
            'from': str(self.today + timedelta(days=10)),
        })

        self.assertEqual(response.data, [])

    def test_bookings_can_be_filtered_by_status(self):
        Trip_per_user.objects.filter(pk=self.booking_a.pk).update(status='cancelled')

        confirmed = self.as_user(self.user_a).get(BOOKINGS_URL, {'status': 'confirmed'})
        cancelled = self.as_user(self.user_a).get(BOOKINGS_URL, {'status': 'cancelled'})

        self.assertEqual(confirmed.data, [])
        self.assertEqual(len(cancelled.data), 1)

    def test_the_customer_email_is_not_exposed_to_the_partner(self):
        row = self.as_user(self.user_a).get(BOOKINGS_URL).data[0]

        self.assertNotIn('email', row)
        self.assertNotIn('shopper@example.com', str(row))


class PartnerDashboardTests(PartnerTestBase):

    def test_the_counts_cover_only_the_callers_listings(self):
        profile = Profile.objects.get(username='shopper')
        Trip_per_user.objects.create(
            username=profile, trip=self.trip_a,
            trip_date=self.today + timedelta(days=5), price=Decimal('100'),
        )
        Trip_per_user.objects.create(
            username=profile, trip=self.trip_b,
            trip_date=self.today + timedelta(days=5), price=Decimal('100'),
        )

        data = self.as_user(self.user_a).get(DASHBOARD_URL).data

        self.assertEqual(data['listings'], 1)
        self.assertEqual(data['total_bookings'], 1)
        self.assertEqual(data['upcoming_bookings'], 1)

    def test_cancelled_bookings_do_not_count(self):
        profile = Profile.objects.get(username='shopper')
        booking = Trip_per_user.objects.create(
            username=profile, trip=self.trip_a,
            trip_date=self.today + timedelta(days=5), price=Decimal('100'),
        )
        Trip_per_user.objects.filter(pk=booking.pk).update(status='cancelled')

        data = self.as_user(self.user_a).get(DASHBOARD_URL).data

        self.assertEqual(data['total_bookings'], 0)

    def test_average_rating_is_across_their_listings_only(self):
        Trips.objects.filter(pk=self.trip_a.pk).update(average_rating=Decimal('4.00'))
        Trips.objects.filter(pk=self.trip_b.pk).update(average_rating=Decimal('1.00'))

        data = self.as_user(self.user_a).get(DASHBOARD_URL).data

        self.assertEqual(data['average_rating'], 4.0)

    def test_a_partner_with_nothing_gets_zeroes_not_an_error(self):
        Trips.objects.filter(pk=self.trip_a.pk).update(partner=None)

        data = self.as_user(self.user_a).get(DASHBOARD_URL).data

        self.assertEqual(data['listings'], 0)
        self.assertEqual(data['average_rating'], 0)


class HotelManagerTests(PartnerTestBase):
    """A hotel manager manages hotels, not trips."""

    def setUp(self):
        super().setUp()
        self.hotel_user = self.make_user('hotelier')
        self.hotel_partner = Partner.objects.create(
            user=self.hotel_user, business_name='Nile Hotels',
            partner_type=HOTEL_MANAGER, is_approved=True,
        )
        self.features = Trip_features.objects.create(name=self.trip_platform)
        self.hotel = Hotels.objects.create(
            trip_name=self.features, name='Nile Hotel', price=50, partner=self.hotel_partner,
        )

    def test_their_listings_are_hotels(self):
        response = self.as_user(self.hotel_user).get(LISTINGS_URL)

        self.assertEqual([row['name'] for row in response.data], ['Nile Hotel'])

    def test_a_tour_operator_does_not_see_hotels(self):
        response = self.as_user(self.user_a).get(LISTINGS_URL)

        self.assertNotIn('Nile Hotel', [row['name'] for row in response.data])

    def test_creating_a_hotel_needs_a_trip_to_hang_it_off(self):
        response = self.as_user(self.hotel_user).post(LISTINGS_URL, {
            'name': 'Orphan Hotel', 'price': 80,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'trip_required_for_hotel')

    def test_creating_a_hotel_under_a_trip_with_no_features_is_refused(self):
        response = self.as_user(self.hotel_user).post(LISTINGS_URL, {
            'name': 'Featureless Hotel', 'price': 80, 'trip': 'Alpha Trip',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'trip_features_missing')

    def test_a_hotel_manager_creates_a_hotel_they_own(self):
        response = self.as_user(self.hotel_user).post(LISTINGS_URL, {
            'name': 'Second Hotel', 'price': 90, 'trip': 'Platform Trip', 'wifi': True,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Hotels.objects.get(name='Second Hotel').partner_id, self.hotel_partner.pk)


class ExistingBehaviourIsUnchangedTests(PartnerTestBase):
    """FR-46 must be invisible to customers and admins."""

    def test_the_public_trip_listing_still_returns_platform_trips(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 50,
        }, format='json')

        names = {row['name'] for row in response.data}
        self.assertEqual(response.status_code, 200)
        # Ownership does not hide anything from the public catalogue.
        self.assertEqual(names, {'Alpha Trip', 'Beta Trip', 'Platform Trip'})

    def test_the_admin_api_still_sees_every_trip(self):
        response = self.as_user(self.staff).get('/admin-api/trips/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)

    def test_a_customer_can_still_book_a_partner_owned_trip(self):
        response = self.client.post('/profile/update_profile/', {
            'username': 'shopper', 'price': 100, 'trip_date': str(self.today + timedelta(days=3)),
            'trip_name': 'Alpha Trip', 'hotel_name': 'no_name', 'hotel_reserve_date': '',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Trip_per_user.objects.filter(trip=self.trip_a).exists())
