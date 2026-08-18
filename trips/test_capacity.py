"""FR-43 — capacity enforcement and the availability read endpoint."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from profiles.models import Profile, Trip_per_user
from trips.models import TripAvailability, Trips

BOOKING_URL = '/profile/update_profile/'


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=0, discount=0,
                    desc='d', type='Beach', available=True, capacity=30)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class CapacityTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='traveller', password='pass1234')
        self.profile = Profile.objects.create(username='traveller', email='t@example.com', user=self.user)
        # A second customer: the booking endpoint short-circuits a repeat
        # booking of the same trip+date by the same person, so filling a
        # departure means more than one traveller.
        self.other_user = User.objects.create_user(username='companion', password='pass1234')
        self.other_profile = Profile.objects.create(
            username='companion', email='c@example.com', user=self.other_user,
        )
        self.trip = make_trip('Capacity Trip', capacity=5)
        self.departure = timezone.localdate() + timedelta(days=20)

    def book(self, **overrides):
        payload = dict(
            username='traveller', price=100, trip_date=str(self.departure),
            trip_name='Capacity Trip', hotel_name='no_name', hotel_reserve_date='',
        )
        payload.update(overrides)
        return self.client.post(BOOKING_URL, payload, format='json')

    def availability(self):
        return TripAvailability.objects.get(trip=self.trip, date=self.departure)


class SeatReservationTests(CapacityTestBase):

    def test_a_booking_without_seats_takes_one(self):
        self.assertEqual(self.book().status_code, 200)

        booking = Trip_per_user.objects.get()
        self.assertEqual(booking.seats, 1)
        self.assertEqual(self.availability().booked_seats, 1)

    def test_the_availability_row_is_created_from_the_trip_capacity(self):
        self.book()

        self.assertEqual(self.availability().total_seats, 5)

    def test_seats_are_taken_in_the_requested_quantity(self):
        self.assertEqual(self.book(seats=3).status_code, 200)

        self.assertEqual(self.availability().booked_seats, 3)
        self.assertEqual(Trip_per_user.objects.get().seats, 3)

    def test_a_booking_beyond_capacity_is_rejected_and_names_the_remainder(self):
        self.book(seats=4)

        response = self.book(username='companion', seats=3, price=120)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'no_seats_available')
        self.assertIn('1', response.data['detail'])
        self.assertEqual(self.availability().booked_seats, 4)

    def test_a_rejected_booking_creates_nothing(self):
        self.book(seats=5)
        before = Trip_per_user.objects.count()

        self.book(username='companion', seats=1, price=150)

        self.assertEqual(Trip_per_user.objects.count(), before)

    def test_filling_the_last_seat_is_allowed(self):
        self.book(seats=4)

        self.assertEqual(self.book(username='companion', seats=1, price=150).status_code, 200)
        self.assertEqual(self.availability().remaining_seats, 0)

    def test_a_different_date_has_its_own_pool(self):
        self.book(seats=5)

        other = self.departure + timedelta(days=1)
        self.assertEqual(self.book(trip_date=str(other), seats=5).status_code, 200)

    def test_zero_or_negative_seats_are_rejected(self):
        self.assertEqual(self.book(seats=0).data['code'], 'invalid_seats')
        self.assertEqual(self.book(seats=-2).data['code'], 'invalid_seats')

    def test_a_non_numeric_seat_count_is_rejected(self):
        self.assertEqual(self.book(seats='many').data['code'], 'invalid_seats')


class AvailabilityEndpointTests(CapacityTestBase):

    def url(self, **params):
        query = '&'.join(f'{key}={value}' for key, value in params.items())
        base = f'/api/trips/{self.trip.name}/availability/'
        return f'{base}?{query}' if query else base

    def test_reports_capacity_for_dates_nobody_has_booked(self):
        response = self.client.get(self.url(**{'from': str(self.departure), 'to': str(self.departure)}))

        self.assertEqual(response.status_code, 200)
        day = response.data['days'][0]
        self.assertEqual(day['remaining_seats'], 5)
        self.assertFalse(day['is_sold_out'])

    def test_merely_reading_availability_creates_no_rows(self):
        self.client.get(self.url())

        self.assertFalse(TripAvailability.objects.exists())

    def test_reflects_seats_already_taken(self):
        self.book(seats=4)

        response = self.client.get(self.url(**{'from': str(self.departure), 'to': str(self.departure)}))

        self.assertEqual(response.data['days'][0]['remaining_seats'], 1)

    def test_marks_a_sold_out_date(self):
        self.book(seats=5)

        response = self.client.get(self.url(**{'from': str(self.departure), 'to': str(self.departure)}))

        self.assertTrue(response.data['days'][0]['is_sold_out'])
        self.assertEqual(response.data['days'][0]['remaining_seats'], 0)

    def test_is_public(self):
        self.assertEqual(self.client.get(self.url()).status_code, 200)

    def test_an_unknown_trip_is_a_coded_404(self):
        response = self.client.get('/api/trips/Ghost Trip/availability/')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'trip_not_found')

    def test_an_inverted_range_is_a_coded_400(self):
        response = self.client.get(self.url(**{
            'from': str(self.departure), 'to': str(self.departure - timedelta(days=5)),
        }))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_date_range')
