from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reviews'
    verbose_name = 'Reviews'

    def ready(self):
        # Connects the post_save/post_delete receivers that keep
        # Trips.average_rating / Hotels.average_rating in step with the reviews.
        from . import signals  # noqa: F401
