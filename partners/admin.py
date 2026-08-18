from django.contrib import admin, messages

from .models import Partner


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = [
        'business_name', 'user', 'partner_type', 'contact_email',
        'contact_phone', 'is_approved', 'created_at',
    ]
    list_editable = ['is_approved']
    list_filter = ['partner_type', 'is_approved', 'created_at']
    search_fields = ['business_name', 'user__username', 'contact_email']
    ordering = ['-created_at']
    list_select_related = ['user']
    readonly_fields = ['created_at']
    actions = ['approve_partners']

    @admin.action(description='اعتماد الشركاء')
    def approve_partners(self, request, queryset):
        updated = queryset.filter(is_approved=False).update(is_approved=True)
        self.message_user(request, f'تم اعتماد {updated} شريك', messages.SUCCESS)
