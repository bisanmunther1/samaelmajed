from django.test import TestCase
from rest_framework.test import APIClient

from trips.models import Trips
from trip_features.models import Trip_features
from .models import Hotels


class HotelsModelTests(TestCase):

    def setUp(self):
        self.trip = Trips.objects.create(
            name='Hotel Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        self.features = Trip_features.objects.create(name=self.trip)

    def test_str_returns_hotel_name(self):
        hotel = Hotels.objects.create(trip_name=self.features, name='Nile View', price=100)
        self.assertEqual(str(hotel), 'Nile View')

    def test_amenity_defaults_to_false(self):
        hotel = Hotels.objects.create(trip_name=self.features, name='Plain Hotel')
        self.assertFalse(hotel.wifi)
        self.assertFalse(hotel.pool)


class HotelViewsTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.trip = Trips.objects.create(
            name='Hotel Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        self.features = Trip_features.objects.create(name=self.trip)
        Hotels.objects.create(trip_name=self.features, name='Nile View', price=150, rate=4.5, wifi=True)
        Hotels.objects.create(trip_name=self.features, name='Budget Inn', price=50, rate=3.0)

    def test_get_hotel_returns_matching_hotel(self):
        response = self.client.post('/hotels/send_hotel/', {'name': 'Nile View', 'trip_name': 'Hotel Trip'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Nile View')

    def test_get_hotel_no_match_returns_empty_list(self):
        response = self.client.post('/hotels/send_hotel/', {'name': 'Ghost Hotel', 'trip_name': 'Hotel Trip'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_get_hotels_price_returns_price_and_name_lists(self):
        response = self.client.get('/hotels/get_prices/Hotel Trip/')
        self.assertEqual(response.status_code, 200)
        prices, names = response.data
        self.assertEqual(set(names), {'Nile View', 'Budget Inn'})
        self.assertEqual(len(prices), 2)

    def test_get_hotels_price_no_hotels_returns_empty_lists(self):
        other_trip = Trips.objects.create(
            name='No Hotels Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        Trip_features.objects.create(name=other_trip)

        response = self.client.get('/hotels/get_prices/No Hotels Trip/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [[], []])
