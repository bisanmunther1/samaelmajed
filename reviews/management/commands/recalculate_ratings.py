from django.core.management.base import BaseCommand

from reviews.services import recalculate_all_ratings


class Command(BaseCommand):
    help = (
        'Recomputes average_rating and reviews_count on every trip and hotel '
        'from the approved reviews. Use it to backfill after deploying FR-38, '
        'or to repair the aggregates if reviews were changed with bulk queries '
        '(which do not fire the signals).'
    )

    def handle(self, *args, **options):
        trips_updated, hotels_updated = recalculate_all_ratings()

        self.stdout.write(self.style.SUCCESS(
            f'Recalculated ratings for {trips_updated} trip(s) and {hotels_updated} hotel(s).'
        ))
