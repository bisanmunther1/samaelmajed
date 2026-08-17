from datetime import date
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from hotels.models import Hotels
from trip_features.models import Trip_features
from trips.models import Trips
from .models import Profile, Trip_per_user


class ProfileModelTests(TestCase):

    def test_str_returns_username(self):
        user = User.objects.create_user(username='pmuser', password='pass12345')
        profile = Profile.objects.create(username='pmuser', email='p@example.com', user=user)
        self.assertEqual(str(profile), 'pmuser')

    def test_joined_at_defaults_to_today(self):
        user = User.objects.create_user(username='joindate', password='pass12345')
        profile = Profile.objects.create(username='joindate', email='j@example.com', user=user)
        self.assertEqual(profile.joined_at, date.today())


class TripPerUserModelTests(TestCase):

    def test_str_returns_owning_profiles_username(self):
        user = User.objects.create_user(username='tpuuser', password='pass12345')
        profile = Profile.objects.create(username='tpuuser', email='t@example.com', user=user)
        booking = Trip_per_user.objects.create(username=profile, price=100)
        self.assertEqual(str(booking), 'tpuuser')


class ProfileDataRetrievalTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='retrieveuser', password='pass12345')
        self.profile = Profile.objects.create(username='retrieveuser', email='r@example.com', user=self.user, first_name='Ana')

    def test_get_profile_returns_data(self):
        response = self.client.get('/profile/get/retrieveuser/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'Ana')

    def test_get_profile_for_unknown_user_crashes_with_500(self):
        # Documents existing behavior: send_data does profile[0] on a possibly
        # empty queryset with no existence check. Not fixed per the "document,
        # don't silently fix" decision for this pass.
        with self.assertRaises(IndexError):
            self.client.get('/profile/get/ghost/')

    def test_get_profile_data_returns_empty_list_for_no_bookings(self):
        response = self.client.get('/profile/get_profile_data/retrieveuser/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_get_profile_data_returns_bookings(self):
        trip = make_trip('Booked Trip')
        Trip_per_user.objects.create(username=self.profile, trip=trip, trip_date=date.today(), price=200)
        response = self.client.get('/profile/get_profile_data/retrieveuser/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['trip_name'], 'Booked Trip')


class UpdateProfileInfoViewTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='edituser', password='pass12345')
        self.profile = Profile.objects.create(username='edituser', email='e@example.com', user=self.user)

    def _auth(self):
        access = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    def test_requires_authentication(self):
        response = self.client.post('/profile/send/', {
            'username': 'edituser', 'firstname': 'A', 'lastname': 'B',
            'bio': '', 'country': '', 'phone': '', 'birth_date': '2000-01-01',
        })
        self.assertEqual(response.status_code, 401)

    def test_updates_profile_fields(self):
        self._auth()
        response = self.client.post('/profile/send/', {
            'username': 'edituser', 'firstname': 'Updated', 'lastname': 'Name',
            'bio': 'hello', 'country': 'Egypt', 'phone': '123', 'birth_date': '1999-05-05',
        })
        self.assertEqual(response.status_code, 200)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.first_name, 'Updated')
        self.assertEqual(self.profile.country, 'Egypt')


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=10, discount=0, desc='d', available=True)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class BookingFlowTests(TestCase):
    """Covers POST /profile/update_profile/ — the booking-creation endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='bookinguser', password='pass12345')
        self.profile = Profile.objects.create(username='bookinguser', email='b@example.com', user=self.user)
        self.trip = make_trip('Booking Trip', num=5)
        # The hotel the payload names has to exist in the catalogue — booking
        # creation resolves it to a real record instead of storing the string.
        features = Trip_features.objects.create(name=self.trip)
        self.hotel = Hotels.objects.create(trip_name=features, name='Nile Hotel', price=60)

    def _payload(self, **overrides):
        payload = dict(
            username='bookinguser', price=150, trip_date='2026-01-01',
            trip_name='Booking Trip', hotel_name='no_name', hotel_reserve_date='',
        )
        payload.update(overrides)
        return payload

    def test_booking_creates_trip_per_user_record(self):
        response = self.client.post('/profile/update_profile/', self._payload(price=150), format='json')

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.trip_id, 'Booking Trip')
        self.assertEqual(booking.price, 150)

    def test_booking_increments_trip_num(self):
        self.client.post('/profile/update_profile/', self._payload(), format='json')
        self.trip.refresh_from_db()
        self.assertEqual(self.trip.num, 6)

    def test_hotel_only_booking_stores_hotel_fields(self):
        response = self.client.post('/profile/update_profile/', self._payload(
            price=80, hotel_name='Nile Hotel', hotel_reserve_date='2026-02-01',
        ), format='json')

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.hotel_id, 'Nile Hotel')
        self.assertEqual(str(booking.hotel_reserve_date), '2026-02-01')

    def test_transport_only_booking_leaves_the_hotel_unlinked(self):
        response = self.client.post('/profile/update_profile/', self._payload(
            price=200, hotel_name='no_name',
        ), format='json')

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertIsNone(booking.hotel_id)

    def test_combined_hotel_and_transport_price_is_stored_as_sent(self):
        # The backend does not independently recompute the price from a
        # hotel/transport combination — it trusts whatever `price` the
        # client sends. This test documents that passthrough behavior
        # rather than a real server-side calculation, since none exists.
        response = self.client.post('/profile/update_profile/', self._payload(
            price=350, hotel_name='Nile Hotel', hotel_reserve_date='2026-02-01',
        ), format='json')

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.price, 350)

    def test_unavailable_trip_cannot_be_booked(self):
        make_trip('Closed Trip', available=False)

        response = self.client.post('/profile/update_profile/', self._payload(trip_name='Closed Trip'), format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Trip_per_user.objects.filter(trip__name='Closed Trip').exists())

    def test_booking_an_unknown_trip_is_rejected_with_a_coded_error(self):
        response = self.client.post(
            '/profile/update_profile/', self._payload(trip_name='Nonexistent Trip'), format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'trip_not_found')
        self.assertEqual(response.json()['detail'], 'الرحلة المطلوبة غير موجودة.')
        self.assertFalse(Trip_per_user.objects.exists())

    def test_booking_an_unknown_hotel_is_rejected_with_a_coded_error(self):
        response = self.client.post(
            '/profile/update_profile/', self._payload(hotel_name='Ghost Hotel'), format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'hotel_not_found')
        self.assertEqual(response.json()['detail'], 'الفندق المطلوب غير موجود.')
        self.assertFalse(Trip_per_user.objects.exists())

    def test_booking_links_the_real_trip_and_hotel_records(self):
        self.client.post('/profile/update_profile/', self._payload(
            hotel_name='Nile Hotel', hotel_reserve_date='2026-02-01',
        ), format='json')

        booking = Trip_per_user.objects.get(username=self.profile)
        self.assertEqual(booking.trip_id, self.trip.pk)
        self.assertEqual(booking.hotel_id, self.hotel.pk)

    def test_the_no_name_sentinel_is_not_resolved_against_the_hotel_catalogue(self):
        response = self.client.post(
            '/profile/update_profile/', self._payload(hotel_name='no_name'), format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(Trip_per_user.objects.get(username=self.profile).hotel_id)

    def test_missing_required_field_crashes_with_500(self):
        payload = self._payload()
        del payload['trip_name']
        with self.assertRaises(KeyError):
            self.client.post('/profile/update_profile/', payload, format='json')

    def test_endpoint_accepts_requests_with_no_authentication(self):
        # SECURITY FINDING (documented, not fixed here per explicit decision):
        # this view sets no permission_classes, so DRF's global default
        # (AllowAny) applies. Anyone who knows a valid username can create a
        # booking "as" them, with any price, without a token. This test
        # documents that current behavior so a future fix has a regression
        # test to flip.
        self.client.credentials()  # no Authorization header at all
        response = self.client.post('/profile/update_profile/', self._payload(), format='json')
        self.assertEqual(response.status_code, 200)


class EndToEndBookingFlowTests(TestCase):
    """Browse -> select -> book -> verify, using the actual public APIs in sequence."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='e2euser', password='pass12345')
        self.profile = Profile.objects.create(username='e2euser', email='e2e@example.com', user=self.user)
        make_trip('E2E Beach Trip', type='Beach', num=2, price=120)

    def test_browse_then_book_then_verify_in_history(self):
        browse = self.client.post('/trips/send_trip_cards/Beach/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')
        self.assertEqual(browse.status_code, 200)
        trip_name = browse.data[0]['name']
        self.assertEqual(trip_name, 'E2E Beach Trip')

        booking = self.client.post('/profile/update_profile/', {
            'username': 'e2euser', 'price': 120, 'trip_date': '2026-03-01',
            'trip_name': trip_name, 'hotel_name': 'no_name', 'hotel_reserve_date': '',
        }, format='json')
        self.assertEqual(booking.status_code, 200)

        history = self.client.get('/profile/get_profile_data/e2euser/')
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]['trip_name'], 'E2E Beach Trip')

        updated_trip = Trips.objects.get(name='E2E Beach Trip')
        self.assertEqual(updated_trip.num, 3)


class BookingLinkAuditTests(TestCase):
    """`audit_booking_links` after the conversion: the free-text columns are
    gone, so what it checks now is that every booking actually has its trip."""

    def setUp(self):
        self.user = User.objects.create_user(username='audituser', password='pass12345')
        self.profile = Profile.objects.create(username='audituser', email='a@example.com', user=self.user)
        self.trip = make_trip('Cairo Trip')
        features = Trip_features.objects.create(name=self.trip)
        self.hotel = Hotels.objects.create(trip_name=features, name='Nile Hotel', price=50)

    def audit_output(self):
        out = StringIO()
        call_command('audit_booking_links', stdout=out)
        return out.getvalue()

    def test_passes_when_every_booking_has_a_trip(self):
        Trip_per_user.objects.create(username=self.profile, trip=self.trip, hotel=self.hotel, price=100)

        output = self.audit_output()

        self.assertIn('PASS — every booking is linked to a real trip.', output)
        self.assertNotIn('FAIL', output)

    def test_passes_when_a_booking_has_a_trip_but_no_hotel(self):
        Trip_per_user.objects.create(username=self.profile, trip=self.trip, price=100)

        output = self.audit_output()

        self.assertIn('PASS', output)
        self.assertIn('Bookings with no hotel', output)

    def test_fails_and_identifies_a_booking_with_no_trip(self):
        orphan = Trip_per_user.objects.create(username=self.profile, price=100)

        output = self.audit_output()

        self.assertIn('FAIL — 1 booking(s) have no trip link.', output)
        self.assertIn(f'booking {orphan.pk}', output)

    def test_reports_the_trips_carrying_the_bookings(self):
        Trip_per_user.objects.create(username=self.profile, trip=self.trip, price=100)
        Trip_per_user.objects.create(username=self.profile, trip=self.trip, price=120)

        output = self.audit_output()

        self.assertIn("'Cairo Trip' — 2 booking(s)", output)

    def test_counts_bookings_with_neither_a_trip_nor_a_hotel(self):
        Trip_per_user.objects.create(username=self.profile, price=100)

        output = self.audit_output()

        self.assertIn('Bookings with neither a trip nor a hotel:', output)


class ProtectedDeletionTests(TestCase):
    """The FK is PROTECT, so a booked trip cannot be deleted out from under its
    bookings — which is what the old free-text column allowed."""

    def setUp(self):
        self.user = User.objects.create_user(username='protectuser', password='pass12345')
        self.profile = Profile.objects.create(username='protectuser', email='p@example.com', user=self.user)
        self.trip = make_trip('Protected Trip')

    def test_deleting_a_booked_trip_is_refused(self):
        Trip_per_user.objects.create(username=self.profile, trip=self.trip, price=100)

        with self.assertRaises(ProtectedError):
            self.trip.delete()

        self.assertTrue(Trips.objects.filter(name='Protected Trip').exists())

    def test_an_unbooked_trip_can_still_be_deleted(self):
        make_trip('Unbooked Trip').delete()

        self.assertFalse(Trips.objects.filter(name='Unbooked Trip').exists())
