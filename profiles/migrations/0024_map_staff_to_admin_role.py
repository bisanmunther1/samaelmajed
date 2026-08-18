"""Maps existing accounts onto the new FR-46 role field.

Everyone defaults to `customer` from the field default; this only promotes the
profiles whose user is already `is_staff`, so the people who administer the site
today keep saying so under the new vocabulary. Nobody gains access from this:
`is_staff` remains what Django admin and Jazzmin actually check.

Reversible — the reverse puts every profile back to `customer`, which is the
field default and therefore the pre-migration state.
"""

from django.db import migrations


def promote_staff_to_admin(apps, schema_editor):
    Profile = apps.get_model('profiles', 'Profile')
    Profile.objects.filter(user__is_staff=True).update(role='admin')


def demote_all_to_customer(apps, schema_editor):
    Profile = apps.get_model('profiles', 'Profile')
    Profile.objects.update(role='customer')


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0023_profile_role'),
    ]

    operations = [
        migrations.RunPython(promote_staff_to_admin, demote_all_to_customer),
    ]
