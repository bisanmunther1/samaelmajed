import base64
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from rest_framework.test import APIClient

from trip_features.models import Trip_features
from .models import Trips

# A minimal valid 1x1 transparent PNG, so Django's ImageField validation
# (which actually opens the file with Pillow) accepts it.
ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def make_trip(name, **overrides):
    defaults = dict(
        place='Cairo', price=100, rate=4.0, num=10, discount=10,
        desc='A nice trip', type='Beach', available=True,
    )
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class TripsModelTests(TestCase):

    def test_str_returns_name(self):
        trip = make_trip('Cairo Trip')
        self.assertEqual(str(trip), 'Cairo Trip')

    def test_default_type_is_beach(self):
        trip = Trips.objects.create(
            name='Default Type Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        self.assertEqual(trip.type, 'Beach')

    def test_default_available_is_true(self):
        trip = Trips.objects.create(
            name='Default Availability Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        self.assertTrue(trip.available)

    def test_net_profit_property(self):
        trip = make_trip('Profit Trip', num=Decimal('10'), price=Decimal('100'))
        # (num * price * 2) / 100  ==  (10 * 100 * 2) / 100  ==  20
        self.assertEqual(trip.Net_Profit, Decimal('20'))


class SendTripCardsTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        make_trip('Cheap Beach', place='Cairo', price=50, rate=3.0, num=5, type='Beach')
        make_trip('Expensive Beach', place='Aswan', price=900, rate=4.5, num=20, type='Beach')
        make_trip('Unavailable Beach', place='Cairo', price=50, rate=5.0, num=1, type='Beach', available=False)
        make_trip('A Nature Trip', place='Cairo', price=50, rate=4.0, num=3, type='Nature')

    def _body(self, **overrides):
        body = dict(price=100000, rate=0, order_by='name', place='Any', reverse=False, number_of_images=10)
        body.update(overrides)
        return body

    def test_filters_by_type(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(), format='json')
        names = {t['name'] for t in response.data}
        self.assertEqual(response.status_code, 200)
        self.assertEqual(names, {'Cheap Beach', 'Expensive Beach'})

    def test_excludes_unavailable_trips(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(), format='json')
        names = {t['name'] for t in response.data}
        self.assertNotIn('Unavailable Beach', names)

    def test_filters_by_price_ceiling(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(price=100), format='json')
        names = {t['name'] for t in response.data}
        self.assertEqual(names, {'Cheap Beach'})

    def test_filters_by_place(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(place='Aswan'), format='json')
        names = {t['name'] for t in response.data}
        self.assertEqual(names, {'Expensive Beach'})

    def test_no_matching_results_returns_empty_list(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(place='Nowhere'), format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_number_of_images_caps_result_count(self):
        response = self.client.post('/trips/send_trip_cards/Beach/', self._body(number_of_images=1), format='json')
        self.assertEqual(len(response.data), 1)


class TrendingPlacesTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        make_trip('Low Visitors', type='Beach', num=1)
        make_trip('High Visitors', type='Beach', num=50)
        make_trip('Unavailable', type='Beach', num=100, available=False)

    def test_returns_only_available_trips_of_requested_type(self):
        response = self.client.get('/trips/trending/Beach/')
        names = [t['name'] for t in response.data]
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('Unavailable', names)

    def test_ordered_by_num_ascending(self):
        response = self.client.get('/trips/trending/Beach/')
        names = [t['name'] for t in response.data]
        self.assertEqual(names, ['Low Visitors', 'High Visitors'])

    def test_no_trips_for_type_returns_empty_list(self):
        response = self.client.get('/trips/trending/City/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])


class DiscountedPlacesTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        make_trip('Small Discount', discount=5)
        make_trip('Big Discount', discount=40)
        make_trip('Unavailable Discount', discount=99, available=False)

    def test_returns_only_available_trips_ordered_by_discount_desc(self):
        response = self.client.post('/trips/discount/')
        names = [t['name'] for t in response.data]
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('Unavailable Discount', names)
        self.assertEqual(names, ['Big Discount', 'Small Discount'])


class BrowseFilterSortThenDetailIntegrationTests(TestCase):
    """Browse -> filter/sort -> view trip detail, through the real API sequence."""

    def setUp(self):
        self.client = APIClient()
        trip = make_trip('Detail Trip', type='Beach', price=80, rate=4.2, num=7)
        Trip_features.objects.create(
            name=trip, access_bus_1=True, access_bus_name_1='GoBus', access_bus_price_1=30,
        )
        make_trip('Other Beach Trip', type='Beach', price=500, rate=2.0, num=1)

    def test_browse_filter_sort_then_view_detail(self):
        browse = self.client.post('/trips/send_trip_cards/Beach/', {
            'price': 100, 'rate': 0, 'order_by': 'price', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')
        self.assertEqual(browse.status_code, 200)
        names = [t['name'] for t in browse.data]
        self.assertEqual(names, ['Detail Trip'])  # the 500-price trip is filtered out

        detail = self.client.get('/trip_features/Detail Trip/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['access_bus_name_1'], 'GoBus')


class AdminCrudReflectedInPublicEndpointsTests(TestCase):
    """Create/edit/delete a Trip through the real Django admin, and confirm
    the change is reflected via the public trips API — not just the ORM."""

    def setUp(self):
        self.client = Client()
        self.admin_user = User.objects.create_superuser(username='crudsadmin', email='a@example.com', password='pass12345')
        self.client.login(username='crudsadmin', password='pass12345')
        self.api = APIClient()

    def test_create_via_admin_appears_in_public_endpoint(self):
        response = self.client.post('/admin/trips/trips/add/', {
            'name': 'Admin Created Trip',
            'img': SimpleUploadedFile('trip.png', ONE_PIXEL_PNG, content_type='image/png'),
            'place': 'Luxor', 'price': 300, 'rate': 4, 'num': 0, 'discount': 0,
            'desc': 'created via admin', 'type': 'City', 'available': 'on',
        })
        self.assertEqual(response.status_code, 302)  # redirect on successful save
        self.assertTrue(Trips.objects.filter(name='Admin Created Trip').exists())

        public = self.api.post('/trips/send_trip_cards/City/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')
        names = [t['name'] for t in public.data]
        self.assertIn('Admin Created Trip', names)

    def test_edit_via_admin_is_reflected_in_public_endpoint(self):
        trip = Trips.objects.create(
            name='Editable Trip',
            img=SimpleUploadedFile('trip.png', ONE_PIXEL_PNG, content_type='image/png'),
            place='Giza', price=100, rate=3, num=0, discount=0, desc='before edit', type='City',
        )

        response = self.client.post(f'/admin/trips/trips/{trip.pk}/change/', {
            'name': 'Editable Trip', 'place': 'Giza', 'price': 999, 'rate': 3, 'num': 0, 'discount': 0,
            'desc': 'after edit', 'type': 'City', 'available': 'on',
        })
        self.assertEqual(response.status_code, 302)

        trip.refresh_from_db()
        self.assertEqual(trip.price, 999)

        public = self.api.post('/trips/send_trip_cards/City/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')
        edited = next(t for t in public.data if t['name'] == 'Editable Trip')
        self.assertEqual(edited['price'], Decimal('999'))

    def test_delete_via_admin_removes_it_from_public_endpoint(self):
        trip = Trips.objects.create(
            name='Deletable Trip',
            img=SimpleUploadedFile('trip.png', ONE_PIXEL_PNG, content_type='image/png'),
            place='Aswan', price=100, rate=3, num=0, discount=0, desc='to delete', type='City',
        )

        response = self.client.post(f'/admin/trips/trips/{trip.pk}/delete/', {'post': 'yes'})
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Trips.objects.filter(name='Deletable Trip').exists())

        public = self.api.post('/trips/send_trip_cards/City/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')
        names = [t['name'] for t in public.data]
        self.assertNotIn('Deletable Trip', names)


class AdvancedFilterTests(TestCase):
    """FR-39 — query-string filters on the trip listing. They are additive, so
    the no-params response must stay byte-identical to the pre-FR-39 one."""

    def setUp(self):
        self.client = APIClient()
        self.cheap = make_trip('Cheap Cairo', place='Cairo', price=50, rate=3.0, type='Beach')
        self.mid = make_trip('Mid Aswan', place='Aswan', price=300, rate=4.0, type='Beach')
        self.pricey = make_trip('Pricey Luxor', place='Luxor', price=900, rate=5.0, type='Beach')
        self.closed = make_trip('Closed Cairo', place='Cairo', price=120, rate=4.0,
                                type='Beach', available=False)

        Trips.objects.filter(pk=self.cheap.pk).update(average_rating=Decimal('2.00'), reviews_count=3)
        Trips.objects.filter(pk=self.mid.pk).update(average_rating=Decimal('4.50'), reviews_count=9)
        Trips.objects.filter(pk=self.pricey.pk).update(average_rating=Decimal('5.00'), reviews_count=1)

    def _body(self, **overrides):
        body = dict(price=100000, rate=0, order_by='name', place='Any',
                    reverse=False, number_of_images=50)
        body.update(overrides)
        return body

    def listing(self, query='', **body_overrides):
        url = '/trips/send_trip_cards/Beach/'
        if query:
            url = f'{url}?{query}'
        return self.client.post(url, self._body(**body_overrides), format='json')

    def names(self, response):
        return {row['name'] for row in response.data}

    def test_no_query_params_returns_exactly_what_it_did_before(self):
        response = self.listing()

        self.assertEqual(response.status_code, 200)
        # available=True still implicit, unavailable trip still excluded
        self.assertEqual(self.names(response), {'Cheap Cairo', 'Mid Aswan', 'Pricey Luxor'})

    def test_search_matches_name_case_insensitively(self):
        self.assertEqual(self.names(self.listing('search=cairo')), {'Cheap Cairo'})

    def test_search_also_matches_the_destination(self):
        self.assertEqual(self.names(self.listing('search=luxor')), {'Pricey Luxor'})

    def test_place_filters_on_an_exact_destination(self):
        self.assertEqual(self.names(self.listing('place=Aswan')), {'Mid Aswan'})

    def test_min_price_and_max_price_bound_the_range(self):
        self.assertEqual(self.names(self.listing('min_price=100')), {'Mid Aswan', 'Pricey Luxor'})
        self.assertEqual(self.names(self.listing('max_price=100')), {'Cheap Cairo'})

    def test_min_rating_uses_the_review_aggregate_not_the_editorial_rate(self):
        # Cheap Cairo has editorial rate 3.0 but an average_rating of 2.00.
        self.assertEqual(self.names(self.listing('min_rating=4')), {'Mid Aswan', 'Pricey Luxor'})

    def test_available_false_surfaces_the_unavailable_trips(self):
        self.assertEqual(self.names(self.listing('available=false')), {'Closed Cairo'})

    def test_ordering_by_price_descending(self):
        response = self.listing('ordering=-price')
        self.assertEqual([row['name'] for row in response.data],
                         ['Pricey Luxor', 'Mid Aswan', 'Cheap Cairo'])

    def test_ordering_by_reviews_count_descending(self):
        response = self.listing('ordering=-reviews_count')
        self.assertEqual([row['name'] for row in response.data][0], 'Mid Aswan')

    def test_filters_combine(self):
        response = self.listing('search=a&min_price=100&max_price=500&min_rating=4')
        self.assertEqual(self.names(response), {'Mid Aswan'})

    def test_unknown_params_are_ignored(self):
        response = self.listing('colour=blue&sort_by=magic')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.names(response), {'Cheap Cairo', 'Mid Aswan', 'Pricey Luxor'})

    def test_non_numeric_price_is_a_coded_400(self):
        response = self.listing('min_price=abc')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_price')
        self.assertEqual(response.data['detail'], 'قيمة السعر يجب أن تكون رقماً موجباً.')

    def test_rating_above_five_is_a_coded_400(self):
        response = self.listing('min_rating=9')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_rating')

    def test_inverted_price_range_is_a_coded_400(self):
        response = self.listing('min_price=500&max_price=100')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_price_range')

    def test_unsupported_ordering_is_a_coded_400(self):
        response = self.listing('ordering=desc__drop_table')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_ordering')

    def test_non_boolean_available_is_a_coded_400(self):
        response = self.listing('available=maybe')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_boolean')


class FilterOptionsTests(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_returns_distinct_places_and_the_real_price_bounds(self):
        make_trip('A', place='Cairo', price=50)
        make_trip('B', place='Cairo', price=400)
        make_trip('C', place='Aswan', price=900)

        response = self.client.get('/api/trips/filter-options/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['places'], ['Aswan', 'Cairo'])
        self.assertEqual(response.data['min_price'], Decimal('50'))
        self.assertEqual(response.data['max_price'], Decimal('900'))

    def test_is_public_and_copes_with_an_empty_catalogue(self):
        response = self.client.get('/api/trips/filter-options/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['places'], [])
        self.assertEqual(response.data['min_price'], 0)


class MigratedOrderingTests(TestCase):
    """The sorts the retired Gallery filter panel used to offer, now expressed
    as `ordering` values."""

    def setUp(self):
        self.client = APIClient()
        self.quiet = make_trip('Quiet Trip', place='Cairo', price=100, rate=2.0, num=1, type='Beach')
        self.busy = make_trip('Busy Trip', place='Cairo', price=100, rate=5.0, num=99, type='Beach')

    def order(self, value):
        response = self.client.post(
            f'/trips/send_trip_cards/Beach/?ordering={value}',
            dict(price=100000, rate=0, order_by='name', place='Any',
                 reverse=False, number_of_images=50),
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        return [row['name'] for row in response.data]

    def test_most_visited_first(self):
        self.assertEqual(self.order('-num')[0], 'Busy Trip')

    def test_editorial_rate_descending(self):
        self.assertEqual(self.order('-rate')[0], 'Busy Trip')

    def test_reverse_alphabetical(self):
        self.assertEqual(self.order('-name'), ['Quiet Trip', 'Busy Trip'])

    def test_alphabetical(self):
        self.assertEqual(self.order('name'), ['Busy Trip', 'Quiet Trip'])
