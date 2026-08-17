from decimal import Decimal

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


class HotelFilterTests(TestCase):
    """FR-39 on the hotel listing — additive, and the [[prices], [names]]
    response shape is untouched."""

    def setUp(self):
        self.client = APIClient()
        self.trip = Trips.objects.create(
            name='Filter Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        self.features = Trip_features.objects.create(name=self.trip)
        cheap = Hotels.objects.create(trip_name=self.features, name='Budget Filter Inn', price=40)
        pricey = Hotels.objects.create(trip_name=self.features, name='Grand Filter Palace', price=400)

        Hotels.objects.filter(pk=cheap.pk).update(average_rating=Decimal('2.00'))
        Hotels.objects.filter(pk=pricey.pk).update(average_rating=Decimal('4.80'))

    def listing(self, query=''):
        url = '/hotels/get_prices/Filter Trip/'
        if query:
            url = f'{url}?{query}'
        return self.client.get(url)

    def names(self, response):
        return set(response.data[1])

    def test_no_query_params_returns_both_lists_as_before(self):
        response = self.listing()

        self.assertEqual(response.status_code, 200)
        prices, names = response.data
        self.assertEqual(set(names), {'Budget Filter Inn', 'Grand Filter Palace'})
        self.assertEqual(len(prices), 2)

    def test_search_narrows_by_hotel_name(self):
        self.assertEqual(self.names(self.listing('search=budget')), {'Budget Filter Inn'})

    def test_price_range_narrows_the_list(self):
        self.assertEqual(self.names(self.listing('max_price=100')), {'Budget Filter Inn'})

    def test_min_rating_uses_the_review_aggregate(self):
        self.assertEqual(self.names(self.listing('min_rating=4')), {'Grand Filter Palace'})

    def test_ordering_by_price_descending(self):
        _, names = self.listing('ordering=-price').data
        self.assertEqual(names, ['Grand Filter Palace', 'Budget Filter Inn'])

    def test_invalid_price_is_a_coded_400(self):
        response = self.listing('min_price=nope')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_price')
