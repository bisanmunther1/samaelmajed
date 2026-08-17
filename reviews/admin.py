from django.contrib import admin, messages

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):

    list_display = ['user', 'target', 'rating', 'is_approved', 'created_at']
    list_filter = ['rating', 'is_approved', 'created_at']
    list_editable = ['is_approved']
    search_fields = ['comment', 'user__username']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['user', 'trip', 'hotel']
    actions = ['approve_reviews', 'hide_reviews']

    @admin.display(description='reviewed item')
    def target(self, review):
        return review.target_name

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'trip', 'hotel')

    def _set_approval(self, request, queryset, approved, done_message):
        # Saved one by one rather than with queryset.update() so the post_save
        # receiver runs and the trip/hotel aggregates follow along.
        changed = 0
        for review in queryset:
            if review.is_approved != approved:
                review.is_approved = approved
                review.save(update_fields=['is_approved', 'updated_at'])
                changed += 1

        self.message_user(request, f'{done_message} ({changed})', messages.SUCCESS)

    @admin.action(description='اعتماد المراجعات')
    def approve_reviews(self, request, queryset):
        self._set_approval(request, queryset, True, 'تم اعتماد المراجعات المحددة')

    @admin.action(description='إخفاء المراجعات')
    def hide_reviews(self, request, queryset):
        self._set_approval(request, queryset, False, 'تم إخفاء المراجعات المحددة')
