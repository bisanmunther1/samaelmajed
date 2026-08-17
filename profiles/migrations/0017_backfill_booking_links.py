"""Backfills Trip_per_user.trip / .hotel from the legacy name strings.

Matching runs in two passes. The exact pass is the one we trust. The fuzzy pass
(strip + case-insensitive) exists because the name columns were free text for
the whole life of the project, so leading spaces and casing drift are likely —
and every row it rescues is a row the old string joins were silently getting
wrong. Those are logged individually.

An ambiguous fuzzy key (two catalogue records normalising to the same string) is
never guessed at: the row is left unlinked for the audit command to report.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def _build_indexes(model):
    """Returns (exact, fuzzy) name lookups. Fuzzy keys that more than one
    record claims are dropped rather than resolved arbitrarily."""
    names = list(model.objects.values_list('pk', flat=True))

    exact = {name: name for name in names}

    candidates = {}
    for name in names:
        candidates.setdefault(name.strip().casefold(), []).append(name)
    fuzzy = {key: found[0] for key, found in candidates.items() if len(found) == 1}
    ambiguous = {key for key, found in candidates.items() if len(found) > 1}

    return exact, fuzzy, ambiguous


def _link(bookings, name_field, fk_field, exact, fuzzy, ambiguous, label):
    linked_exact = 0
    linked_fuzzy = 0
    unmatched = 0

    # Only ever fills blanks, so re-running changes nothing.
    pending = bookings.filter(**{f'{fk_field}__isnull': True}).exclude(
        **{f'{name_field}__isnull': True}
    ).exclude(**{f'{name_field}': ''})

    for booking in pending.iterator():
        raw_name = getattr(booking, name_field)
        resolved = exact.get(raw_name)

        if resolved is not None:
            setattr(booking, f'{fk_field}_id', resolved)
            booking.save(update_fields=[f'{fk_field}_id'])
            linked_exact += 1
            continue

        key = raw_name.strip().casefold()
        resolved = fuzzy.get(key)

        if resolved is not None:
            setattr(booking, f'{fk_field}_id', resolved)
            booking.save(update_fields=[f'{fk_field}_id'])
            linked_fuzzy += 1
            logger.warning(
                'backfill_booking_links: booking %s matched %s %r only on the '
                'fuzzy pass (linked to %r) — this join was previously wrong.',
                booking.pk, label, raw_name, resolved,
            )
            continue

        unmatched += 1
        logger.warning(
            'backfill_booking_links: booking %s has %s %r with no matching '
            'record%s — left unlinked.',
            booking.pk, label, raw_name,
            ' (ambiguous name)' if key in ambiguous else '',
        )

    logger.info(
        'backfill_booking_links: %s — %s exact, %s fuzzy, %s unmatched.',
        label, linked_exact, linked_fuzzy, unmatched,
    )


def link_bookings(apps, schema_editor):
    Trip_per_user = apps.get_model('profiles', 'Trip_per_user')
    Trips = apps.get_model('trips', 'Trips')
    Hotels = apps.get_model('hotels', 'Hotels')

    bookings = Trip_per_user.objects.all()

    trip_exact, trip_fuzzy, trip_ambiguous = _build_indexes(Trips)
    _link(bookings, 'trip_name', 'trip', trip_exact, trip_fuzzy, trip_ambiguous, 'trip')

    hotel_exact, hotel_fuzzy, hotel_ambiguous = _build_indexes(Hotels)
    _link(bookings, 'hotel_name', 'hotel', hotel_exact, hotel_fuzzy, hotel_ambiguous, 'hotel')


def unlink_bookings(apps, schema_editor):
    """Reverse: drop the links. The name columns are untouched by this
    migration in either direction, so no booking data is lost."""
    Trip_per_user = apps.get_model('profiles', 'Trip_per_user')
    Trip_per_user.objects.update(trip=None, hotel=None)


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0016_trip_per_user_hotel_trip_per_user_trip'),
    ]

    operations = [
        migrations.RunPython(link_bookings, unlink_bookings),
    ]
