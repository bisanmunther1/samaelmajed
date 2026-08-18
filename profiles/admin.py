from django.contrib import admin, messages
from .models import REFUND_COMPLETED, REFUND_PENDING, Profile   , Trip_per_user

 
class Search(admin.ModelAdmin):

    list_filter =['username' ,'email' ,'role']
    list_display = ['username' ,'email','first_name' , 'last_name','phone' ,'role' ]


class BookingAdmin(admin.ModelAdmin):
    # is_paid decides whether the booking can be reviewed (FR-38) and status
    # decides whether it counts at all (FR-40), so both are visible here.
    list_display = [
        'id', 'username', 'trip', 'trip_date', 'hotel', 'seats', 'price',
        'is_paid', 'status', 'refund_amount', 'refund_status',
    ]
    list_editable = ['is_paid']
    list_filter = ['is_paid', 'status', 'refund_status', 'trip_date']
    search_fields = ['username__username', 'trip__name', 'hotel__name']
    # Both are real relations now, so the changelist would otherwise issue a
    # query per row to render the trip and hotel columns.
    list_select_related = ['username', 'trip', 'hotel']
    autocomplete_fields = ['trip', 'hotel']
    # Written by the cancellation flow, not by hand.
    readonly_fields = ['cancelled_at', 'refund_amount']
    actions = ['mark_refunded']

    @admin.action(description='تمييز كمسترد')
    def mark_refunded(self, request, queryset):
        # The only way a refund is ever settled in this project: there is no
        # payment capture to reverse programmatically, so an operator pays the
        # customer out of band and records it here.
        updated = queryset.filter(refund_status=REFUND_PENDING).update(
            refund_status=REFUND_COMPLETED,
        )
        self.message_user(request, f'تم تمييز {updated} استرداد كمكتمل', messages.SUCCESS)


admin.site.register(Profile,Search)
admin.site.register(Trip_per_user, BookingAdmin)
