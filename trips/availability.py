"""FR-43 — seat accounting for a trip on a date.

Every reservation and release goes through here so the arithmetic lives in one
place and the booking flow never touches `booked_seats` directly.

CONCURRENCY, STATED PLAINLY: `select_for_update()` below is compiled away by
Django on SQLite, which has no SELECT ... FOR UPDATE. On this project's default
database the guarantee therefore rests entirely on SQLite's whole-database
write lock plus the surrounding `transaction.atomic()` — adequate because
SQLite serialises writers, but it is not row-level locking. On PostgreSQL or
MySQL the lock is real and is what stops two concurrent bookings from both
passing the capacity check.
"""

from django.db.models import F

from .models import TripAvailability


class CapacityError(Exception):
    """Not enough seats left. Carries the remainder so the caller can say so."""

    def __init__(self, remaining):
        self.remaining = remaining
        super().__init__(f'only {remaining} seat(s) remaining')


def availability_row(trip, date, lock=False):
    """The row for (trip, date), created from the trip's default capacity the
    first time anyone books that date."""
    row, _ = TripAvailability.objects.get_or_create(
        trip=trip, date=date, defaults={'total_seats': trip.capacity},
    )

    if lock:
        # Re-read under the lock: get_or_create cannot both create and lock.
        row = TripAvailability.objects.select_for_update().get(pk=row.pk)

    return row


def remaining_for(trip, date):
    """Seats left without creating a row — used by the read endpoint, which
    must not materialise a row for every date someone merely looks at."""
    row = TripAvailability.objects.filter(trip=trip, date=date).first()
    if row is None:
        return trip.capacity
    return row.remaining_seats


def reserve_seats(trip, date, seats):
    """Takes `seats` for that date or raises CapacityError. Call inside an
    open transaction."""
    row = availability_row(trip, date, lock=True)

    if row.booked_seats + seats > row.total_seats:
        raise CapacityError(remaining=row.remaining_seats)

    TripAvailability.objects.filter(pk=row.pk).update(booked_seats=F('booked_seats') + seats)


def release_seats(trip, date, seats):
    """Gives `seats` back. Never drops below zero, so a double release cannot
    manufacture capacity."""
    row = TripAvailability.objects.select_for_update().filter(trip=trip, date=date).first()
    if row is None:
        return

    TripAvailability.objects.filter(pk=row.pk).update(
        booked_seats=max(0, row.booked_seats - seats),
    )
