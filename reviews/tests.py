from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from hotels.models import Hotels
from profiles.models import Profile, Trip_per_user
from trip_features.models import Trip_features
from trips.models import Trips

from .models import EDIT_WINDOW_DAYS, Review

REVIEWS_URL = '/api/reviews/'
SUMMARY_URL = '/api/reviews/summary/'
MY_URL = '/api/reviews/my/'
PENDING_URL = '/api/reviews/pending/'


def error_code(response):
    """The stable machine-readable code out of a rejected write."""
    return response.json().get('code')


class ReviewsTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()
        self.past = self.today - timedelta(days=10)
        self.future = self.today + timedelta(days=10)

        self.user = User.objects.create_user(username='rana', password='pass1234', email='rana@example.com')
        self.other_user = User.objects.create_user(username='omar', password='pass1234', email='omar@example.com')
        self.staff_user = User.objects.create_user(username='admin', password='pass1234', is_staff=True)

        self.profile = Profile.objects.create(username='rana', email='rana@example.com', user=self.user)
        self.other_profile = Profile.objects.create(username='omar', email='omar@example.com', user=self.other_user)

        self.trip = Trips.objects.create(
            name='Cairo Trip', place='Cairo', price=100, rate=4.5, num=2,
            discount=0, desc='desc', type='City', available=True,
        )
        self.other_trip = Trips.objects.create(
            name='Aswan Trip', place='Aswan', price=80, rate=4.0, num=1,
            discount=0, desc='desc', type='Nature', available=True,
        )

        self.features = Trip_features.objects.create(name=self.trip)
        self.hotel = Hotels.objects.create(trip_name=self.features, name='Nile Hotel', price=50)

        # A finished, paid booking of Cairo Trip + Nile Hotel.
        self.finished_booking = Trip_per_user.objects.create(
            username=self.profile, trip=self.trip, trip_date=self.past,
            hotel=self.hotel, hotel_reserve_date=self.past, price=150, is_paid=True,
        )

    def create_booking(self, profile=None, **overrides):
        values = dict(
            username=profile or self.profile, trip=self.trip, trip_date=self.past,
            hotel=None, hotel_reserve_date=None, price=100, is_paid=True,
        )
        values.update(overrides)
        return Trip_per_user.objects.create(**values)

    def post_review(self, **overrides):
        payload = dict(booking=self.finished_booking.pk, trip='Cairo Trip', rating=5, comment='رحلة رائعة')
        payload.update(overrides)
        return self.client.post(REVIEWS_URL, payload, format='json')

    def make_review(self, user=None, booking=None, **overrides):
        values = dict(
            user=user or self.user, booking=booking or self.finished_booking,
            trip=self.trip, rating=4, comment='جيدة',
        )
        values.update(overrides)
        return Review.objects.create(**values)


class ReviewCreationTests(ReviewsTestBase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def test_creates_a_review_on_a_completed_past_booking(self):
        response = self.post_review()

        self.assertEqual(response.status_code, 201, response.content)
        review = Review.objects.get()
        self.assertEqual(review.user, self.user)
        self.assertEqual(review.trip, self.trip)
        self.assertIsNone(review.hotel)
        self.assertEqual(review.rating, 5)
        self.assertTrue(review.is_approved)

    def test_creates_a_hotel_review_on_a_finished_stay(self):
        response = self.post_review(trip=None, hotel='Nile Hotel')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Review.objects.get().hotel, self.hotel)

    def test_anonymous_user_cannot_create_a_review(self):
        self.client.force_authenticate(user=None)
        response = self.post_review()

        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(Review.objects.exists())

    def test_rejects_an_unpaid_booking(self):
        booking = self.create_booking(is_paid=False)
        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'booking_not_completed')

    def test_rejects_someone_elses_booking(self):
        booking = self.create_booking(profile=self.other_profile)
        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'booking_not_owned')

    def test_rejects_a_trip_that_has_not_happened_yet(self):
        booking = self.create_booking(trip_date=self.future)
        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'trip_not_finished')

    def test_rejects_a_trip_that_is_still_running_today(self):
        booking = self.create_booking(trip_date=self.today)
        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'trip_not_finished')

    def test_rejects_a_hotel_stay_that_has_not_finished(self):
        booking = self.create_booking(hotel=self.hotel, hotel_reserve_date=self.future)
        response = self.post_review(booking=booking.pk, trip=None, hotel='Nile Hotel')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'hotel_stay_not_finished')

    def test_one_booking_accepts_both_a_trip_review_and_a_hotel_review(self):
        trip_review = self.post_review()
        hotel_review = self.post_review(trip=None, hotel='Nile Hotel', comment='فندق ممتاز')

        self.assertEqual(trip_review.status_code, 201, trip_review.content)
        self.assertEqual(hotel_review.status_code, 201, hotel_review.content)
        self.assertEqual(Review.objects.filter(booking=self.finished_booking).count(), 2)

    def test_reviewing_the_trip_does_not_lock_the_hotel(self):
        self.assertEqual(self.post_review().status_code, 201)

        response = self.post_review(trip=None, hotel='Nile Hotel')

        self.assertEqual(response.status_code, 201, response.content)

    def test_rejects_a_second_review_of_the_same_trip(self):
        self.assertEqual(self.post_review().status_code, 201)
        response = self.post_review(comment='مرة ثانية')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'duplicate_trip_review')
        self.assertEqual(Review.objects.filter(trip=self.trip).count(), 1)

    def test_rejects_a_second_review_of_the_same_hotel(self):
        self.assertEqual(self.post_review(trip=None, hotel='Nile Hotel').status_code, 201)
        response = self.post_review(trip=None, hotel='Nile Hotel', comment='مرة ثانية')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'duplicate_hotel_review')
        self.assertEqual(Review.objects.filter(hotel=self.hotel).count(), 1)

    def test_duplicate_messages_name_the_target_not_the_booking(self):
        self.post_review()
        trip_again = self.post_review()

        self.post_review(trip=None, hotel='Nile Hotel')
        hotel_again = self.post_review(trip=None, hotel='Nile Hotel')

        self.assertEqual(trip_again.json()['detail'], 'لقد قمت بتقييم هذه الرحلة مسبقاً.')
        self.assertEqual(hotel_again.json()['detail'], 'لقد قمت بتقييم هذا الفندق مسبقاً.')

    def test_the_same_trip_can_be_reviewed_again_on_a_different_booking(self):
        second_booking = self.create_booking()
        self.assertEqual(self.post_review().status_code, 201)

        response = self.post_review(booking=second_booking.pk, comment='زرتها مرتين')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Review.objects.filter(trip=self.trip).count(), 2)

    def test_rejects_rating_zero(self):
        response = self.post_review(rating=0)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'invalid_rating')

    def test_rejects_rating_six(self):
        response = self.post_review(rating=6)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'invalid_rating')

    def test_rejects_a_trip_that_does_not_match_the_booking(self):
        response = self.post_review(trip='Aswan Trip')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'target_mismatch')

    def test_rejects_a_hotel_that_does_not_match_the_booking(self):
        other_hotel = Hotels.objects.create(trip_name=self.features, name='Desert Inn', price=20)
        response = self.post_review(trip=None, hotel=other_hotel.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'target_mismatch')

    def test_rejects_a_review_with_no_target(self):
        response = self.post_review(trip=None)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'target_required')

    def test_rejects_a_review_targeting_both_a_trip_and_a_hotel(self):
        response = self.post_review(hotel='Nile Hotel')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'target_ambiguous')

    def test_rejects_a_comment_longer_than_the_limit(self):
        response = self.post_review(comment='ا' * 1001)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'comment_too_long')

    def test_rejections_carry_an_arabic_message_alongside_the_code(self):
        response = self.post_review(trip='Aswan Trip')

        self.assertEqual(
            response.json()['detail'],
            'العنصر الذي تحاول تقييمه لا يطابق الحجز المحدد.',
        )

    def test_accepts_an_empty_comment(self):
        response = self.post_review(comment='')

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Review.objects.get().comment, '')


class ReviewEditingTests(ReviewsTestBase):

    def setUp(self):
        super().setUp()
        self.review = self.make_review()
        self.url = f'{REVIEWS_URL}{self.review.pk}/'

    def backdate(self, days):
        Review.objects.filter(pk=self.review.pk).update(
            created_at=timezone.now() - timedelta(days=days),
        )

    def test_author_can_edit_inside_the_window(self):
        self.client.force_authenticate(user=self.user)
        self.backdate(EDIT_WINDOW_DAYS - 1)

        response = self.client.patch(self.url, {'rating': 2, 'comment': 'تغيّر رأيي'}, format='json')

        self.assertEqual(response.status_code, 200, response.content)
        self.review.refresh_from_db()
        self.assertEqual(self.review.rating, 2)
        self.assertEqual(self.review.comment, 'تغيّر رأيي')

    def test_author_cannot_edit_outside_the_window(self):
        self.client.force_authenticate(user=self.user)
        self.backdate(EDIT_WINDOW_DAYS + 1)

        response = self.client.patch(self.url, {'rating': 2}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'edit_window_expired')
        self.review.refresh_from_db()
        self.assertEqual(self.review.rating, 4)

    def test_another_user_cannot_edit_the_review(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.patch(self.url, {'rating': 1}, format='json')

        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_edit_someone_elses_review(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.patch(self.url, {'rating': 1}, format='json')

        self.assertEqual(response.status_code, 403)

    def test_editing_cannot_move_the_review_to_another_trip(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(self.url, {'trip': 'Aswan Trip'}, format='json')

        self.assertEqual(response.status_code, 200, response.content)
        self.review.refresh_from_db()
        self.assertEqual(self.review.trip_id, 'Cairo Trip')


class ReviewDeletionTests(ReviewsTestBase):

    def setUp(self):
        super().setUp()
        self.review = self.make_review()
        self.url = f'{REVIEWS_URL}{self.review.pk}/'

    def test_author_can_delete_their_review(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Review.objects.exists())

    def test_staff_can_delete_any_review(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Review.objects.exists())

    def test_another_user_cannot_delete_the_review(self):
        self.client.force_authenticate(user=self.other_user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Review.objects.exists())

    def test_author_can_delete_a_review_staff_have_hidden(self):
        Review.objects.filter(pk=self.review.pk).update(is_approved=False)
        self.client.force_authenticate(user=self.user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, 204)


class AggregateTests(ReviewsTestBase):

    def trip_aggregates(self):
        self.trip.refresh_from_db()
        return self.trip.average_rating, self.trip.reviews_count

    def test_aggregates_start_at_zero(self):
        self.assertEqual(self.trip_aggregates(), (Decimal('0.00'), 0))

    def test_aggregates_update_on_create(self):
        self.make_review(rating=4)
        self.make_review(user=self.other_user, booking=self.create_booking(profile=self.other_profile), rating=5)

        self.assertEqual(self.trip_aggregates(), (Decimal('4.50'), 2))

    def test_aggregates_update_on_edit(self):
        review = self.make_review(rating=4)

        review.rating = 2
        review.save()

        self.assertEqual(self.trip_aggregates(), (Decimal('2.00'), 1))

    def test_aggregates_update_on_delete(self):
        review = self.make_review(rating=4)
        self.make_review(user=self.other_user, booking=self.create_booking(profile=self.other_profile), rating=2)

        review.delete()

        self.assertEqual(self.trip_aggregates(), (Decimal('2.00'), 1))

    def test_unapproved_reviews_are_excluded_from_the_aggregates(self):
        review = self.make_review(rating=4)
        self.make_review(user=self.other_user, booking=self.create_booking(profile=self.other_profile), rating=2)

        review.is_approved = False
        review.save()

        self.assertEqual(self.trip_aggregates(), (Decimal('2.00'), 1))

    def test_re_approving_a_review_puts_it_back_in_the_aggregates(self):
        review = self.make_review(rating=4, is_approved=False)
        self.assertEqual(self.trip_aggregates(), (Decimal('0.00'), 0))

        review.is_approved = True
        review.save()

        self.assertEqual(self.trip_aggregates(), (Decimal('4.00'), 1))

    def test_hotel_aggregates_are_maintained_too(self):
        self.make_review(trip=None, hotel=self.hotel, rating=3)

        self.hotel.refresh_from_db()
        self.assertEqual(self.hotel.average_rating, Decimal('3.00'))
        self.assertEqual(self.hotel.reviews_count, 1)

    def test_recalculate_ratings_command_repairs_drifted_aggregates(self):
        self.make_review(rating=4)
        Trips.objects.filter(pk=self.trip.pk).update(average_rating=Decimal('1.00'), reviews_count=99)

        output = StringIO()
        call_command('recalculate_ratings', stdout=output)

        self.assertEqual(self.trip_aggregates(), (Decimal('4.00'), 1))
        self.assertIn('Recalculated ratings', output.getvalue())


class PublicListTests(ReviewsTestBase):

    def setUp(self):
        super().setUp()
        self.approved = self.make_review(rating=5, comment='ممتازة')
        self.hidden = self.make_review(
            user=self.other_user, booking=self.create_booking(profile=self.other_profile),
            rating=1, comment='مسيئة', is_approved=False,
        )

    def test_list_is_public_and_hides_unapproved_reviews(self):
        response = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'})

        self.assertEqual(response.status_code, 200)
        ids = [row['id'] for row in response.json()['results']]
        self.assertEqual(ids, [self.approved.pk])

    def test_list_filters_by_trip(self):
        other_booking = self.create_booking(trip=self.other_trip)
        self.make_review(booking=other_booking, trip=self.other_trip, rating=3)

        response = self.client.get(REVIEWS_URL, {'trip': 'Aswan Trip'})

        targets = {row['target_id'] for row in response.json()['results']}
        self.assertEqual(targets, {'Aswan Trip'})

    def test_list_filters_by_hotel(self):
        booking = self.create_booking(hotel=self.hotel, hotel_reserve_date=self.past)
        self.make_review(booking=booking, trip=None, hotel=self.hotel, rating=3)

        response = self.client.get(REVIEWS_URL, {'hotel': 'Nile Hotel'})

        results = response.json()['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['target_type'], 'hotel')

    def test_list_is_paginated(self):
        payload = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()

        self.assertIn('count', payload)
        self.assertIn('results', payload)
        self.assertEqual(payload['count'], 1)

    def test_list_can_be_ordered_by_rating(self):
        booking = self.create_booking()
        self.make_review(user=self.staff_user, booking=booking, rating=2)

        ascending = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip', 'ordering': 'rating'}).json()
        descending = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip', 'ordering': '-rating'}).json()

        self.assertEqual([row['rating'] for row in ascending['results']], [2, 5])
        self.assertEqual([row['rating'] for row in descending['results']], [5, 2])

    def test_serialized_review_shows_a_display_name_and_never_the_email(self):
        self.profile.first_name = 'رنا'
        self.profile.last_name = 'مراد'
        self.profile.save()

        row = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()['results'][0]

        self.assertEqual(row['user_display_name'], 'رنا مراد')
        self.assertNotIn('rana@example.com', str(row))

    def test_display_name_falls_back_to_the_username(self):
        row = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()['results'][0]

        self.assertEqual(row['user_display_name'], 'rana')

    def test_permission_flags_are_false_for_anonymous_readers(self):
        row = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()['results'][0]

        self.assertFalse(row['can_edit'])
        self.assertFalse(row['can_delete'])

    def test_permission_flags_are_true_for_the_author(self):
        self.client.force_authenticate(user=self.user)

        row = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()['results'][0]

        self.assertTrue(row['can_edit'])
        self.assertTrue(row['can_delete'])

    def test_can_edit_is_false_once_the_window_has_closed(self):
        Review.objects.filter(pk=self.approved.pk).update(
            created_at=timezone.now() - timedelta(days=EDIT_WINDOW_DAYS + 1),
        )
        self.client.force_authenticate(user=self.user)

        row = self.client.get(REVIEWS_URL, {'trip': 'Cairo Trip'}).json()['results'][0]

        self.assertFalse(row['can_edit'])
        self.assertTrue(row['can_delete'])


class SummaryTests(ReviewsTestBase):

    def test_summary_reports_average_count_and_distribution(self):
        self.make_review(rating=5)
        self.make_review(user=self.other_user, booking=self.create_booking(profile=self.other_profile), rating=3)
        self.make_review(user=self.staff_user, booking=self.create_booking(), rating=3)

        response = self.client.get(SUMMARY_URL, {'trip': 'Cairo Trip'})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['count'], 3)
        self.assertAlmostEqual(payload['average'], 3.67, places=2)
        self.assertEqual(payload['distribution'], {'1': 0, '2': 0, '3': 2, '4': 0, '5': 1})

    def test_summary_ignores_unapproved_reviews(self):
        self.make_review(rating=5, is_approved=False)

        payload = self.client.get(SUMMARY_URL, {'trip': 'Cairo Trip'}).json()

        self.assertEqual(payload['count'], 0)
        self.assertEqual(payload['average'], 0)

    def test_summary_without_a_target_is_rejected(self):
        response = self.client.get(SUMMARY_URL)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'target_required')


class MyReviewsTests(ReviewsTestBase):

    def test_my_requires_authentication(self):
        response = self.client.get(MY_URL)

        self.assertIn(response.status_code, (401, 403))

    def test_my_returns_only_the_current_users_reviews_including_hidden_ones(self):
        mine = self.make_review(rating=5, is_approved=False)
        self.make_review(user=self.other_user, booking=self.create_booking(profile=self.other_profile), rating=1)

        self.client.force_authenticate(user=self.user)
        payload = self.client.get(MY_URL).json()

        self.assertEqual([row['id'] for row in payload['results']], [mine.pk])


class PendingReviewsTests(ReviewsTestBase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def test_pending_requires_authentication(self):
        self.client.force_authenticate(user=None)

        self.assertIn(self.client.get(PENDING_URL).status_code, (401, 403))

    def test_pending_returns_one_entry_per_outstanding_target(self):
        rows = self.client.get(PENDING_URL).json()

        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row['booking'] == self.finished_booking.pk for row in rows))
        self.assertEqual(
            {(row['target_type'], row['target_id']) for row in rows},
            {('trip', 'Cairo Trip'), ('hotel', 'Nile Hotel')},
        )

    def test_pending_entries_carry_the_name_and_date_of_their_target(self):
        rows = self.client.get(PENDING_URL).json()

        by_type = {row['target_type']: row for row in rows}
        self.assertEqual(by_type['trip']['target_name'], 'Cairo Trip')
        self.assertEqual(by_type['trip']['target_date'], str(self.past))
        self.assertEqual(by_type['hotel']['target_name'], 'Nile Hotel')
        self.assertEqual(by_type['hotel']['target_date'], str(self.past))

    def test_reviewing_the_trip_leaves_the_hotel_pending(self):
        self.make_review()

        rows = self.client.get(PENDING_URL).json()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['target_type'], 'hotel')
        self.assertEqual(rows[0]['target_id'], 'Nile Hotel')

    def test_pending_is_empty_once_both_halves_are_reviewed(self):
        self.make_review()
        self.make_review(trip=None, hotel=self.hotel)

        self.assertEqual(self.client.get(PENDING_URL).json(), [])

    def test_pending_excludes_unpaid_bookings(self):
        Trip_per_user.objects.filter(pk=self.finished_booking.pk).update(is_paid=False)

        self.assertEqual(self.client.get(PENDING_URL).json(), [])

    def test_pending_excludes_trips_that_have_not_happened_yet(self):
        Trip_per_user.objects.filter(pk=self.finished_booking.pk).update(
            trip_date=self.future, hotel=None, hotel_reserve_date=None,
        )

        self.assertEqual(self.client.get(PENDING_URL).json(), [])

    def test_pending_excludes_other_users_bookings(self):
        self.create_booking(profile=self.other_profile)

        rows = self.client.get(PENDING_URL).json()

        self.assertEqual({row['booking'] for row in rows}, {self.finished_booking.pk})

    def test_pending_ignores_a_booking_with_no_linked_trip(self):
        Trip_per_user.objects.filter(pk=self.finished_booking.pk).update(
            trip=None, hotel=None, hotel_reserve_date=None,
        )

        self.assertEqual(self.client.get(PENDING_URL).json(), [])

    def test_pending_offers_only_the_finished_half_of_a_booking(self):
        Trip_per_user.objects.filter(pk=self.finished_booking.pk).update(
            hotel_reserve_date=self.future,
        )

        rows = self.client.get(PENDING_URL).json()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['target_type'], 'trip')
        self.assertEqual(rows[0]['target_id'], 'Cairo Trip')


class ExistingEndpointsStillWorkTests(ReviewsTestBase):
    """FR-38 must not disturb what was already there."""

    def test_booking_creation_still_works_and_leaves_the_booking_unpaid(self):
        response = self.client.post('/profile/update_profile/', {
            'username': 'rana', 'price': 120, 'trip_date': str(self.today),
            'trip_name': 'Cairo Trip', 'hotel_name': 'no_name', 'hotel_reserve_date': '',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        booking = Trip_per_user.objects.filter(trip=self.trip, price=120).first()
        self.assertIsNotNone(booking)
        # Nothing in the PayPal flow reports a completed payment, so a new
        # booking starts unpaid and is confirmed by staff in the admin.
        self.assertFalse(booking.is_paid)

    def test_trip_cards_endpoint_now_also_exposes_the_review_aggregates(self):
        self.make_review(rating=4)

        response = self.client.post('/trips/send_trip_cards/City/', {
            'price': 100000, 'rate': 0, 'order_by': 'name', 'place': 'Any',
            'reverse': False, 'number_of_images': 10,
        }, format='json')

        card = next(row for row in response.data if row['name'] == 'Cairo Trip')
        self.assertEqual(card['average_rating'], Decimal('4.00'))
        self.assertEqual(card['reviews_count'], 1)
        # the editorial rate is untouched by reviews
        self.assertEqual(card['rate'], Decimal('4.5'))


class PaymentGatesReviewingTests(ReviewsTestBase):
    """`is_paid` has to be a real gate, not a formality: a booking created
    through the normal flow starts unpaid and cannot be reviewed until staff
    confirm the payment."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def book_through_the_public_endpoint(self):
        self.client.post('/profile/update_profile/', {
            'username': 'rana', 'price': 90, 'trip_date': str(self.past),
            'trip_name': 'Cairo Trip', 'hotel_name': 'no_name', 'hotel_reserve_date': '',
        }, format='json')
        return Trip_per_user.objects.get(trip=self.trip, price=90)

    def test_a_freshly_created_booking_cannot_be_reviewed(self):
        booking = self.book_through_the_public_endpoint()

        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(error_code(response), 'booking_not_completed')
        self.assertFalse(Review.objects.filter(booking=booking).exists())

    def test_the_same_booking_becomes_reviewable_once_it_is_marked_paid(self):
        booking = self.book_through_the_public_endpoint()
        Trip_per_user.objects.filter(pk=booking.pk).update(is_paid=True)

        response = self.post_review(booking=booking.pk)

        self.assertEqual(response.status_code, 201, response.content)

    def test_pending_omits_a_freshly_created_booking(self):
        booking = self.book_through_the_public_endpoint()

        rows = self.client.get(PENDING_URL).json()

        self.assertNotIn(booking.pk, [row['booking'] for row in rows])

    def test_pending_includes_the_booking_after_payment_is_confirmed(self):
        booking = self.book_through_the_public_endpoint()
        Trip_per_user.objects.filter(pk=booking.pk).update(is_paid=True)

        rows = self.client.get(PENDING_URL).json()

        self.assertIn(booking.pk, [row['booking'] for row in rows])
