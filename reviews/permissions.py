from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAuthorOrStaff(BasePermission):
    """Object-level guard for editing and deleting a review.

    Editing is the author's alone; deleting is allowed to the author or to
    staff (so an abusive review can be removed outright rather than only
    hidden). The 14-day edit window itself lives in the serializer, with the
    rest of the business rules.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False

        if request.method == 'DELETE' and user.is_staff:
            return True

        return obj.user_id == user.pk
