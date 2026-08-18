"""Object-level access control for the partner area.

Two rules, both enforced server-side on every request:
  * the caller must be an approved partner
  * a listing is theirs only if `listing.partner_id == partner.pk`

An **unowned** listing (`partner` is NULL) belongs to the platform and is
admin-managed. It is not "everyone's" — no partner may read, edit or delete it
through these endpoints. That keeps the pre-FR-46 catalogue exactly as it was.
"""

from rest_framework.permissions import BasePermission

from .models import Partner


def partner_for(user):
    """The caller's Partner row, or None. Never trusts a client-supplied id."""
    if not (user and user.is_authenticated):
        return None
    return Partner.objects.filter(user=user).first()


class IsApprovedPartner(BasePermission):
    """Gate for every partner endpoint that touches business data."""

    def has_permission(self, request, view):
        partner = partner_for(request.user)
        if partner is None:
            return False
        # Cached on the request so views do not re-query.
        request.partner = partner
        return partner.is_approved


def owns(partner, listing):
    """True only for a listing this partner owns. An unowned listing is never
    owned by anybody, so this returns False for it."""
    return listing is not None and listing.partner_id == partner.pk
