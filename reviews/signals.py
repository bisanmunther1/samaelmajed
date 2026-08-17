from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Review
from .services import recalculate_hotel_rating, recalculate_trip_rating


@receiver(post_save, sender=Review, dispatch_uid='reviews_recalculate_on_save')
@receiver(post_delete, sender=Review, dispatch_uid='reviews_recalculate_on_delete')
def recalculate_target_aggregates(sender, instance, **kwargs):
    """Keeps Trips/Hotels.average_rating + reviews_count in step with the
    reviews — on create, edit, approval changes and deletion alike."""
    if instance.trip_id:
        recalculate_trip_rating(instance.trip_id)
    if instance.hotel_id:
        recalculate_hotel_rating(instance.hotel_id)
