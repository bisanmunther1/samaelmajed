from rest_framework.permissions import BasePermission


class IsStaffUser(BasePermission):
    """Staff-only access — the tier used for business-data CRUD
    (Trips, Hotels, Trip Features, Bookings, Profiles)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsSuperUser(BasePermission):
    """Superuser-only access — the tier used for anything that can grant
    access to other people (Users, Groups, Permissions, Token Blacklist)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
