from django.contrib import admin

from .models import PromoCode, PromoCodeUsage


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'description', 'discount_type', 'discount_value',
        'valid_from', 'valid_until', 'times_used', 'usage_limit', 'is_active',
    ]
    list_editable = ['is_active']
    list_filter = ['is_active', 'discount_type', 'valid_from', 'valid_until']
    search_fields = ['code', 'description']
    ordering = ['-valid_until']
    filter_horizontal = ['applicable_trips']
    # Maintained by the booking flow; editing it by hand would desync the
    # counter from the usage rows.
    readonly_fields = ['times_used']
    fieldsets = [
        (None, {'fields': ['code', 'description', 'is_active']}),
        ('Discount', {'fields': ['discount_type', 'discount_value', 'max_discount', 'min_booking_amount']}),
        ('Validity', {'fields': ['valid_from', 'valid_until']}),
        ('Usage', {'fields': ['usage_limit', 'usage_limit_per_user', 'times_used']}),
        ('Scope', {'fields': ['applicable_trips']}),
    ]


@admin.register(PromoCodeUsage)
class PromoCodeUsageAdmin(admin.ModelAdmin):
    """Read-only: these rows are the audit trail of what was actually redeemed."""

    list_display = ['promo_code', 'user', 'booking', 'discount_amount', 'used_at']
    list_filter = ['promo_code', 'used_at']
    search_fields = ['promo_code__code', 'user__username']
    list_select_related = ['promo_code', 'user', 'booking']
    date_hierarchy = 'used_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
