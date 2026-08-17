from django.contrib.auth.models import User, Group, Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken

from trips.models import Trips


class AdminApiTestBase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.superuser = User.objects.create_user(
            username='super', password='pass1234', is_staff=True, is_superuser=True,
        )
        self.staff_user = User.objects.create_user(
            username='staffer', password='pass1234', is_staff=True, is_superuser=False,
        )
        self.regular_user = User.objects.create_user(
            username='regular', password='pass1234', is_staff=False, is_superuser=False,
        )

        self.trip = Trips.objects.create(
            name='Cairo Trip', place='Cairo', price=100, rate=4.5, num=2,
            discount=0, desc='desc', type='City', available=True,
        )


class LoginClaimsTests(TestCase):

    def test_token_includes_staff_and_superuser_claims(self):
        User.objects.create_user(username='super', password='pass1234', is_staff=True, is_superuser=True)
        client = APIClient()

        response = client.post('/token/', {'username': 'super', 'password': 'pass1234'})

        self.assertEqual(response.status_code, 200)
        access = response.data['access']
        payload = AccessToken(access)
        self.assertEqual(payload['username'], 'super')
        self.assertTrue(payload['is_staff'])
        self.assertTrue(payload['is_superuser'])

    def test_token_claims_false_for_regular_user(self):
        User.objects.create_user(username='regular', password='pass1234')
        client = APIClient()

        response = client.post('/token/', {'username': 'regular', 'password': 'pass1234'})

        payload = AccessToken(response.data['access'])
        self.assertFalse(payload['is_staff'])
        self.assertFalse(payload['is_superuser'])


class MeEndpointTests(AdminApiTestBase):

    def test_anonymous_is_rejected(self):
        response = self.client.get('/admin-api/me/')
        self.assertEqual(response.status_code, 401)

    def test_non_staff_is_forbidden(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/admin-api/me/')
        self.assertEqual(response.status_code, 403)

    def test_staff_gets_own_info(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/admin-api/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'staffer')
        self.assertFalse(response.data['is_superuser'])


class TripsAdminCrudTests(AdminApiTestBase):

    def test_anonymous_cannot_list(self):
        response = self.client.get('/admin-api/trips/')
        self.assertEqual(response.status_code, 401)

    def test_regular_user_cannot_list(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/admin-api/trips/')
        self.assertEqual(response.status_code, 403)

    def test_staff_can_list(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/admin-api/trips/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_staff_can_create_update_and_delete(self):
        self.client.force_authenticate(user=self.staff_user)

        tiny_gif = SimpleUploadedFile(
            'trip.gif', b'GIF87a\x01\x00\x01\x00\x80\x01\x00\x00\x00\x00ccc,\x00'
            b'\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;', content_type='image/gif',
        )
        create_response = self.client.post('/admin-api/trips/', {
            'name': 'Luxor Trip', 'place': 'Luxor', 'price': 150, 'rate': 4.2,
            'num': 0, 'discount': 0, 'desc': 'desc', 'type': 'City', 'available': True,
            'img': tiny_gif,
        }, format='multipart')
        self.assertEqual(create_response.status_code, 201, create_response.data)
        self.assertTrue(Trips.objects.filter(name='Luxor Trip').exists())

        update_response = self.client.patch('/admin-api/trips/Luxor Trip/', {'price': 175})
        self.assertEqual(update_response.status_code, 200, update_response.data)
        self.assertEqual(Trips.objects.get(name='Luxor Trip').price, 175)

        delete_response = self.client.delete('/admin-api/trips/Luxor Trip/')
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Trips.objects.filter(name='Luxor Trip').exists())


class UserManagementPermissionTests(AdminApiTestBase):

    def test_staff_without_superuser_cannot_list_users(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/admin-api/users/')
        self.assertEqual(response.status_code, 403)

    def test_superuser_can_list_and_create_users(self):
        self.client.force_authenticate(user=self.superuser)

        list_response = self.client.get('/admin-api/users/')
        self.assertEqual(list_response.status_code, 200)

        create_response = self.client.post('/admin-api/users/', {
            'username': 'newstaff', 'email': 'newstaff@example.com',
            'password': 'pass1234', 'is_staff': True,
        })
        self.assertEqual(create_response.status_code, 201, create_response.data)
        created = User.objects.get(username='newstaff')
        self.assertTrue(created.check_password('pass1234'))
        self.assertTrue(created.is_staff)

    def test_superuser_can_manage_groups_and_permissions(self):
        self.client.force_authenticate(user=self.superuser)
        permission = Permission.objects.first()

        create_response = self.client.post('/admin-api/groups/', {
            'name': 'Editors', 'permissions': [permission.id],
        })
        self.assertEqual(create_response.status_code, 201, create_response.data)
        self.assertTrue(Group.objects.filter(name='Editors').exists())

        permissions_response = self.client.get('/admin-api/permissions/')
        self.assertEqual(permissions_response.status_code, 200)
        self.assertGreater(len(permissions_response.data), 0)


class TokenBlacklistTests(AdminApiTestBase):

    def test_staff_without_superuser_forbidden(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/admin-api/token-blacklist/')
        self.assertEqual(response.status_code, 403)

    def test_superuser_can_list_and_revoke(self):
        outstanding = OutstandingToken.objects.create(
            user=self.regular_user, jti='test-jti-1',
            created_at='2026-01-01T00:00:00Z', expires_at='2026-06-01T00:00:00Z',
        )
        self.client.force_authenticate(user=self.superuser)

        list_response = self.client.get('/admin-api/token-blacklist/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertFalse(list_response.data[0]['is_blacklisted'])

        revoke_response = self.client.post(f'/admin-api/token-blacklist/{outstanding.id}/revoke/')
        self.assertEqual(revoke_response.status_code, 200)

        list_after = self.client.get('/admin-api/token-blacklist/')
        self.assertTrue(list_after.data[0]['is_blacklisted'])
