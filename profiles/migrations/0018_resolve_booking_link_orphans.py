"""Resolves the orphans 0017 deliberately refused to guess at.

Added as a new migration rather than amending 0017 because 0017 has already been
applied; editing an applied migration means the new logic silently never runs
for anyone who is already migrated.

Policy (approved):
  * A trip/hotel name with no catalogue record gets that record created, flagged
    not-bookable, and the booking linked to it. Booking history is preserved and
    the rows keep counting in FR-37 statistics.
  * 'no_name' is the legacy "no hotel selected" sentinel from
    profiles.views.Update_profile_data, not a hotel. It is treated as blank.

Placeholders are created with the name exactly as the booking recorded it —
including any stray whitespace — because 0017 already tried every safe
normalisation. Rewriting the name here could silently collide with the very
records 0017 refused to choose between.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)

# profiles.views.Update_profile_data maps this to None before saving, so it
# should never reach the database from current code — older rows may carry it.
NO_HOTEL_SENTINEL = 'no_name'

TRIP_PLACEHOLDER_DEFAULTS = {
    'place': '',
    'price': 0,
    'rate': 0,
    'num': 0,
    'discount': 0,
    'desc': 'Placeholder created for existing booking history (migration 0018).',
    'type': 'Beach',
    # Trips.available is the "not bookable" flag — the placeholder must never
    # show up as something a customer can book.
    'available': False,
    'img': '',
}


def _blank(value):
    return value is None or value == ''


def resolve_orphans(apps, schema_editor):
    Trip_per_user = apps.get_model('profiles', 'Trip_per_user')
    Trips = apps.get_model('trips', 'Trips')
    Hotels = apps.get_model('hotels', 'Hotels')
    Trip_features = apps.get_model('trip_features', 'Trip_features')

    created_trips = 0
    created_hotels = 0
    created_features = 0

    # --- trips -----------------------------------------------------------
    orphan_trips = Trip_per_user.objects.filter(trip__isnull=True).exclude(
        trip_name__isnull=True
    ).exclude(trip_name='')

    for booking in orphan_trips.iterator():
        trip, was_created = Trips.objects.get_or_create(
            name=booking.trip_name, defaults=TRIP_PLACEHOLDER_DEFAULTS,
        )
        if was_created:
            created_trips += 1
            logger.warning(
                'resolve_booking_link_orphans: created placeholder Trip %r '
                '(available=False) for booking %s.', trip.name, booking.pk,
            )
        booking.trip_id = trip.pk
        booking.save(update_fields=['trip_id'])

    # --- hotels ----------------------------------------------------------
    orphan_hotels = Trip_per_user.objects.filter(hotel__isnull=True).exclude(
        hotel_name__isnull=True
    ).exclude(hotel_name='').exclude(hotel_name=NO_HOTEL_SENTINEL)

    for booking in orphan_hotels.iterator():
        # Hotels.trip_name is a required FK to Trip_features (a different field
        # from Trip_per_user.trip_name), so a placeholder hotel needs a parent
        # to hang off: the trip this booking is for.
        if booking.trip_id is None:
            logger.warning(
                'resolve_booking_link_orphans: booking %s has hotel %r but no '
                'trip to attach a placeholder hotel to — left unlinked.',
                booking.pk, booking.hotel_name,
            )
            continue

        features = Trip_features.objects.filter(name_id=booking.trip_id).first()
        if features is None:
            features = Trip_features.objects.create(
                name_id=booking.trip_id, img1='', img2='', img3='', img4='',
            )
            created_features += 1

        hotel, was_created = Hotels.objects.get_or_create(
            name=booking.hotel_name,
            defaults={'trip_name': features, 'price': 0, 'rate': 0},
        )
        if was_created:
            created_hotels += 1
            logger.warning(
                'resolve_booking_link_orphans: created placeholder Hotel %r '
                'under trip %r for booking %s. Hotels has no availability flag, '
                'so this record cannot be marked not-bookable.',
                hotel.name, booking.trip_id, booking.pk,
            )
        booking.hotel_id = hotel.pk
        booking.save(update_fields=['hotel_id'])

    logger.info(
        'resolve_booking_link_orphans: created %s trip(s), %s hotel(s), '
        '%s trip-feature row(s).', created_trips, created_hotels, created_features,
    )


def unlink_orphans(apps, schema_editor):
    """Reverse: drop links to the placeholders and delete the placeholders.

    Only records this migration could have created are removed — a placeholder
    Trip is identified by its marker description, and only deleted once nothing
    points at it. Real catalogue records are never touched.
    """
    Trip_per_user = apps.get_model('profiles', 'Trip_per_user')
    Trips = apps.get_model('trips', 'Trips')
    Hotels = apps.get_model('hotels', 'Hotels')

    placeholders = list(
        Trips.objects.filter(desc=TRIP_PLACEHOLDER_DEFAULTS['desc'])
        .values_list('name', flat=True)
    )

    hotels_under_placeholders = list(
        Hotels.objects.filter(trip_name__name__in=placeholders)
        .values_list('name', flat=True)
    )

    Trip_per_user.objects.filter(hotel__in=hotels_under_placeholders).update(hotel=None)
    Trip_per_user.objects.filter(trip__in=placeholders).update(trip=None)

    Hotels.objects.filter(name__in=hotels_under_placeholders).delete()
    Trips.objects.filter(name__in=placeholders).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0017_backfill_booking_links'),
        ('trip_features', '0008_alter_trip_features_img1_alter_trip_features_img2_and_more'),
        ('hotels', '0009_hotels_average_rating_hotels_reviews_count_and_more'),
        ('trips', '0020_trips_average_rating_trips_reviews_count_and_more'),
    ]

    operations = [
        migrations.RunPython(resolve_orphans, unlink_orphans),
    ]
