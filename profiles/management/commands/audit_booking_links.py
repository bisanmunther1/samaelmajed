"""Health check on the booking -> trip / hotel links.

Before the conversion this command compared the free-text trip_name /
hotel_name columns against the catalogue and reported names that matched
nothing. Those columns are gone: a foreign key either points at a real row or
is null, so "a name that resolves to nothing" is no longer a state the database
can be in — the orphan and fuzzy-match sections retired with them.

What is still worth checking is completeness. Booking creation always resolves a
trip, so a booking without one can now only come from a direct database edit.
"""

from collections import Counter

from django.core.management.base import BaseCommand

from profiles.models import Trip_per_user


class Command(BaseCommand):
    help = (
        'Audits Trip_per_user.trip / .hotel for completeness and reports any '
        'booking that is missing its trip link.'
    )

    def handle(self, *args, **options):
        bookings = Trip_per_user.objects.all()
        total = bookings.count()

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'Booking link audit — {total} booking(s)'
        ))

        linked_trips = bookings.filter(trip__isnull=False).count()
        linked_hotels = bookings.filter(hotel__isnull=False).count()
        self.stdout.write(f'Linked: {linked_trips} trip(s), {linked_hotels} hotel(s).')

        self.stdout.write('Bookings with no trip:')
        missing_trip = bookings.filter(trip__isnull=True)
        missing_trip_count = missing_trip.count()
        if missing_trip_count:
            self.stdout.write(self.style.ERROR(f'  {missing_trip_count} booking(s):'))
            for pk, hotel_id in missing_trip.values_list('pk', 'hotel_id'):
                self.stdout.write(f'    booking {pk} (hotel: {hotel_id or "—"})')
        else:
            self.stdout.write(self.style.SUCCESS('  none'))

        self.stdout.write('Bookings with no hotel (expected — a hotel is optional):')
        self.stdout.write(f'  {bookings.filter(hotel__isnull=True).count()} booking(s)')

        self.stdout.write('Bookings with neither a trip nor a hotel:')
        neither = bookings.filter(trip__isnull=True, hotel__isnull=True).count()
        if neither:
            self.stdout.write(self.style.WARNING(f'  {neither} booking(s)'))
        else:
            self.stdout.write(self.style.SUCCESS('  none'))

        # Which trips carry the bookings — the grouping FR-37 statistics now
        # runs on, shown here so an operator can eyeball it against the report.
        top = Counter(
            bookings.filter(trip__isnull=False).values_list('trip__name', flat=True)
        ).most_common(5)
        if top:
            self.stdout.write('Most booked trips (top 5):')
            for name, count in top:
                self.stdout.write(f'    {name!r} — {count} booking(s)')

        if missing_trip_count:
            self.stdout.write(self.style.ERROR(
                f'FAIL — {missing_trip_count} booking(s) have no trip link.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                'PASS — every booking is linked to a real trip.'
            ))
