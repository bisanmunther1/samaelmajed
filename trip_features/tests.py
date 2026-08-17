from django.test import TestCase
from rest_framework.test import APIClient

from trips.models import Trips
from .models import Trip_features


class TripFeaturesModelTests(TestCase):

    def test_str_returns_trip_name(self):
        trip = Trips.objects.create(
            name='Feature Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        features = Trip_features.objects.create(name=trip)
        self.assertEqual(str(features), 'Feature Trip')

    def test_access_plane_defaults_to_false(self):
        trip = Trips.objects.create(
            name='Default Feature Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        features = Trip_features.objects.create(name=trip)
        self.assertFalse(features.access_plane_1)
        self.assertFalse(features.access_bus_1)


class GetFeaturesViewTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.trip = Trips.objects.create(
            name='Viewed Trip', place='X', price=1, rate=1, num=1, discount=0, desc='d',
        )
        Trip_features.objects.create(
            name=self.trip,
            access_plane_1=True, access_plane_name_1='EgyptAir', access_plane_price_1=200,
        )

    def test_returns_features_for_existing_trip(self):
        response = self.client.get('/trip_features/Viewed Trip/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['access_plane_name_1'], 'EgyptAir')

    def test_unknown_trip_name_crashes_with_500(self):
        # Documents existing behavior: get_features does features[0] on a
        # possibly-empty queryset with no existence check, raising an
        # uncaught IndexError instead of returning 404. Not fixed per the
        # "document, don't silently fix" decision for this pass.
        with self.assertRaises(IndexError):
            self.client.get('/trip_features/Does Not Exist/')
