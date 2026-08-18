"""Operations dashboard: access, correctness of each attention row, and the
query budget."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from hotels.models import Hotels
from partners.models import TOUR_OPERATOR, Partner
from profiles.models import (
    REFUND_PENDING, STATUS_CANCELLED, Profile, Trip_per_user,
)
from promotions.models import FIXED, PromoCode
from reviews.models import Review
from trip_features.models import Trip_features
from trips.models import TripAvailability, Trips

from .services import CACHE_KEY, CACHE_SECONDS, build_snapshot, get_dashboard_snapshot


def make_trip(name, **overrides):
    defaults = dict(place='Cairo', price=100, rate=4.0, num=0, discount=0,
                    desc='d', type='Beach', available=True, capacity=10)
    defaults.update(overrides)
    return Trips.objects.create(name=name, **defaults)


class DashboardTestBase(TestCase):

    def setUp(self):
        # The snapshot is cached for 60s; each test must see its own fixtures.
        cache.clear()

        self.today = timezone.localdate()
        self.staff = User.objects.create_user(username='ops', password='pass1234', is_staff=True)
        self.customer = User.objects.create_user(username='shopper', password='pass1234')
        self.profile = Profile.objects.create(
            username='shopper', email='s@example.com', user=self.customer,
        )
        self.trip = make_trip('Ops Trip')

    def booking(self, **overrides):
        values = dict(
            username=self.profile, trip=self.trip,
            trip_date=self.today + timedelta(days=5),
            price=Decimal('100.00'), seats=1, is_paid=True,
        )
        values.update(overrides)
        return Trip_per_user.objects.create(**values)

    def attention(self, key):
        rows = {row['key']: row for row in build_snapshot()['attention']}
        return rows.get(key)


class AccessTests(DashboardTestBase):

    def test_staff_get_the_dashboard(self):
        self.client.login(username='ops', password='pass1234')

        response = self.client.get('/admin/')

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'admin/dashboard_index.html')

    def test_anonymous_users_are_redirected_to_login(self):
        response = self.client.get('/admin/')

        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response['Location'])

    def test_a_non_staff_user_is_redirected(self):
        self.client.login(username='shopper', password='pass1234')

        response = self.client.get('/admin/')

        self.assertEqual(response.status_code, 302)

    def test_the_partners_app_is_reachable_from_the_admin(self):
        # Django filters the admin app grid by model permissions, so this needs
        # an account that actually has them. A staff user with no permissions
        # sees an empty grid — which is why an app can look "unregistered".
        User.objects.create_superuser(username='root', email='r@example.com', password='pass1234')
        self.client.login(username='root', password='pass1234')

        response = self.client.get('/admin/')

        app_labels = {app['app_label'] for app in response.context['app_list']}
        self.assertIn('partners', app_labels)
        self.assertContains(response, '/admin/partners/partner/')

    def test_a_staff_user_without_permissions_sees_an_empty_app_grid(self):
        # Documents the behaviour above, so the next person does not mistake it
        # for a registration bug.
        self.client.login(username='ops', password='pass1234')

        response = self.client.get('/admin/')

        self.assertEqual(response.context['app_list'], [])


class KpiTests(DashboardTestBase):

    def test_totals_split_confirmed_from_cancelled(self):
        self.booking()
        self.booking(trip_date=self.today + timedelta(days=6))
        self.booking(trip_date=self.today + timedelta(days=7), status=STATUS_CANCELLED)

        bookings = build_snapshot()['bookings']

        self.assertEqual(bookings['total'], 3)
        self.assertEqual(bookings['confirmed'], 2)
        self.assertEqual(bookings['cancelled'], 1)

    def test_revenue_excludes_cancelled_bookings(self):
        self.booking(price=Decimal('100.00'))
        self.booking(trip_date=self.today + timedelta(days=6), price=Decimal('250.00'))
        self.booking(trip_date=self.today + timedelta(days=7),
                     price=Decimal('999.00'), status=STATUS_CANCELLED)

        bookings = build_snapshot()['bookings']

        self.assertEqual(bookings['revenue'], Decimal('350.00'))
        self.assertEqual(bookings['average_value'], Decimal('175.00'))

    def test_occupancy_is_computed_across_upcoming_departures(self):
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=3),
            total_seats=10, booked_seats=5,
        )
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=4),
            total_seats=10, booked_seats=0,
        )

        catalogue = build_snapshot()['catalogue']

        self.assertEqual(catalogue['seats_booked'], 5)
        self.assertEqual(catalogue['seats_total'], 20)
        self.assertEqual(catalogue['occupancy'], 25.0)

    def test_an_empty_catalogue_reports_zero_rather_than_dividing_by_zero(self):
        catalogue = build_snapshot()['catalogue']

        self.assertEqual(catalogue['occupancy'], 0)

    def test_partner_and_review_figures(self):
        partner_user = User.objects.create_user(username='biz', password='pass1234')
        Partner.objects.create(user=partner_user, business_name='A', is_approved=True)
        other = User.objects.create_user(username='biz2', password='pass1234')
        Partner.objects.create(user=other, business_name='B', is_approved=False)

        booking = self.booking(trip_date=self.today - timedelta(days=5))
        Review.objects.create(user=self.customer, booking=booking, trip=self.trip, rating=4)

        people = build_snapshot()['people']

        self.assertEqual(people['partners_total'], 2)
        self.assertEqual(people['partners_approved'], 1)
        self.assertEqual(people['reviews_total'], 1)
        self.assertEqual(people['reviews_average'], 4.0)


class AttentionPanelTests(DashboardTestBase):

    def test_the_panel_is_empty_when_there_is_nothing_to_do(self):
        # The base trip is bookable, so it needs a seat pool or it legitimately
        # trips the "available trip with no capacity" check.
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=3),
            total_seats=10, booked_seats=1,
        )

        self.assertEqual(build_snapshot()['attention'], [])

    def test_unpaid_bookings_are_counted_and_linked(self):
        self.booking(is_paid=False)
        self.booking(trip_date=self.today + timedelta(days=6), is_paid=True)

        row = self.attention('unpaid_bookings')

        self.assertEqual(row['count'], 1)
        self.assertIn('is_paid__exact=0', row['url'])

    def test_a_cancelled_unpaid_booking_is_not_chased(self):
        self.booking(is_paid=False, status=STATUS_CANCELLED)

        self.assertIsNone(self.attention('unpaid_bookings'))

    def test_pending_refunds_carry_the_total_owed(self):
        self.booking(status=STATUS_CANCELLED, refund_status=REFUND_PENDING,
                     refund_amount=Decimal('75.00'))
        self.booking(trip_date=self.today + timedelta(days=6), status=STATUS_CANCELLED,
                     refund_status=REFUND_PENDING, refund_amount=Decimal('25.00'))

        row = self.attention('refunds_pending')

        self.assertEqual(row['count'], 2)
        self.assertEqual(row['note'], '100.00$')

    def test_partners_awaiting_approval(self):
        user = User.objects.create_user(username='waiting', password='pass1234')
        Partner.objects.create(user=user, business_name='Pending Co',
                               partner_type=TOUR_OPERATOR, is_approved=False)

        row = self.attention('partners_pending')

        self.assertEqual(row['count'], 1)
        self.assertIn('is_approved__exact=0', row['url'])

    def test_low_reviews_within_the_last_thirty_days(self):
        booking = self.booking(trip_date=self.today - timedelta(days=5))
        recent = Review.objects.create(user=self.customer, booking=booking, trip=self.trip, rating=2)

        old_booking = self.booking(trip_date=self.today - timedelta(days=6))
        old = Review.objects.create(
            user=self.customer, booking=old_booking, trip=self.trip, rating=1,
        )
        Review.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=60))

        row = self.attention('low_reviews')

        self.assertEqual(row['count'], 1)
        self.assertIsNotNone(recent)

    def test_a_good_review_is_not_flagged(self):
        booking = self.booking(trip_date=self.today - timedelta(days=5))
        Review.objects.create(user=self.customer, booking=booking, trip=self.trip, rating=5)

        self.assertIsNone(self.attention('low_reviews'))

    def test_departures_near_capacity_within_the_horizon(self):
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=3),
            total_seats=10, booked_seats=9,
        )
        # Full, but beyond the 14-day horizon.
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=40),
            total_seats=10, booked_seats=10,
        )
        # Inside the horizon but only half sold.
        TripAvailability.objects.create(
            trip=self.trip, date=self.today + timedelta(days=4),
            total_seats=10, booked_seats=5,
        )

        row = self.attention('near_capacity')

        self.assertEqual(row['count'], 1)

    def test_available_trips_with_no_upcoming_capacity(self):
        # self.trip has no availability row at all.
        covered = make_trip('Covered Trip')
        TripAvailability.objects.create(
            trip=covered, date=self.today + timedelta(days=2), total_seats=5, booked_seats=0,
        )
        make_trip('Closed Trip', available=False)

        row = self.attention('trips_without_capacity')

        self.assertEqual(row['count'], 1)

    def test_promo_codes_expiring_within_a_week(self):
        now = timezone.now()
        PromoCode.objects.create(
            code='SOON', description='d', discount_type=FIXED, discount_value=Decimal('5'),
            valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=3),
        )
        PromoCode.objects.create(
            code='LATER', description='d', discount_type=FIXED, discount_value=Decimal('5'),
            valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=30),
        )
        PromoCode.objects.create(
            code='OFF', description='d', discount_type=FIXED, discount_value=Decimal('5'),
            is_active=False,
            valid_from=now - timedelta(days=1), valid_until=now + timedelta(days=2),
        )

        row = self.attention('expiring_promos')

        self.assertEqual(row['count'], 1)


class DeparturesAndRecentBookingsTests(DashboardTestBase):

    def test_departures_are_sorted_ascending_with_revenue(self):
        later = self.today + timedelta(days=9)
        sooner = self.today + timedelta(days=2)
        TripAvailability.objects.create(trip=self.trip, date=later, total_seats=10, booked_seats=1)
        TripAvailability.objects.create(trip=self.trip, date=sooner, total_seats=10, booked_seats=2)

        self.booking(trip_date=sooner, price=Decimal('120.00'))
        self.booking(trip_date=sooner, price=Decimal('80.00'), seats=2)
        self.booking(trip_date=sooner, price=Decimal('999.00'), status=STATUS_CANCELLED)

        departures = build_snapshot()['departures']

        self.assertEqual([row['date'] for row in departures], [sooner, later])
        self.assertEqual(departures[0]['revenue'], Decimal('200.00'))
        self.assertEqual(departures[0]['occupancy'], 20)

    def test_recent_bookings_are_newest_first_and_capped(self):
        for index in range(10):
            self.booking(trip_date=self.today + timedelta(days=index + 1))

        rows = get_dashboard_snapshot()['recent_bookings']

        self.assertEqual(len(rows), 8)
        self.assertGreater(rows[0].pk, rows[-1].pk)


class QueryBudgetTests(DashboardTestBase):
    """The dashboard renders on every admin page view, so its cost is the cost
    of using the admin at all."""

    def seed(self):
        for index in range(6):
            trip = make_trip(f'Budget Trip {index}')
            TripAvailability.objects.create(
                trip=trip, date=self.today + timedelta(days=index + 1),
                total_seats=10, booked_seats=index,
            )
            self.booking(trip=trip, trip_date=self.today + timedelta(days=index + 1))

        features = Trip_features.objects.create(name=self.trip)
        Hotels.objects.create(trip_name=features, name='Budget Hotel', price=50)

    def test_the_snapshot_stays_within_its_query_budget(self):
        self.seed()
        cache.clear()

        # 12 aggregate/list queries; the budget is 15.
        with self.assertNumQueries(12):
            get_dashboard_snapshot()

    def test_the_cache_ttl_stays_short_enough_to_feel_live(self):
        # Pinned deliberately: the attention panel is only trustworthy if an
        # admin action shows up on the next refresh. Nothing asserted this
        # before, so the value could drift without anyone noticing.
        self.assertEqual(CACHE_SECONDS, 5)

    def test_the_snapshot_is_stored_under_its_cache_key(self):
        self.seed()
        cache.clear()
        self.assertIsNone(cache.get(CACHE_KEY))

        get_dashboard_snapshot()

        self.assertIsNotNone(cache.get(CACHE_KEY))

    def test_the_cache_removes_the_aggregate_cost_on_the_next_render(self):
        self.seed()
        cache.clear()
        get_dashboard_snapshot()

        # Only the deliberately uncached recent-bookings query remains.
        with self.assertNumQueries(1):
            get_dashboard_snapshot()

    def test_the_query_count_does_not_grow_with_the_number_of_rows(self):
        self.seed()
        cache.clear()
        with self.assertNumQueries(12):
            get_dashboard_snapshot()

        for index in range(20):
            trip = make_trip(f'Extra Trip {index}')
            TripAvailability.objects.create(
                trip=trip, date=self.today + timedelta(days=index + 1),
                total_seats=10, booked_seats=1,
            )
            self.booking(trip=trip, trip_date=self.today + timedelta(days=index + 1))

        cache.clear()
        with self.assertNumQueries(12):
            get_dashboard_snapshot()
