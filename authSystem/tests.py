from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from profiles.models import Profile



class RegistrationTests(TestCase):

    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user_and_profile(self):
        response = self.client.post('/user/add/', {
            'username': 'newuser', 'email': 'newuser@example.com', 'password': 'strongpass1',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(username='newuser').exists())
        self.assertTrue(Profile.objects.filter(username='newuser').exists())

    def test_password_is_hashed_not_plaintext(self):
        self.client.post('/user/add/', {
            'username': 'hashcheck', 'email': 'hashcheck@example.com', 'password': 'plaintextpass',
        }, format='json')

        user = User.objects.get(username='hashcheck')
        self.assertNotEqual(user.password, 'plaintextpass')
        self.assertTrue(user.password.startswith('pbkdf2_sha256$'))
        self.assertTrue(user.check_password('plaintextpass'))

    def test_duplicate_username_is_rejected(self):
        User.objects.create_user(username='taken', email='first@example.com', password='pass12345')

        response = self.client.post('/user/add/', {
            'username': 'taken', 'email': 'second@example.com', 'password': 'pass12345',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertEqual(User.objects.filter(username='taken').count(), 1)

    def test_duplicate_email_is_rejected(self):
        User.objects.create_user(username='userone', email='dupe@example.com', password='pass12345')

        response = self.client.post('/user/add/', {
            'username': 'usertwo', 'email': 'dupe@example.com', 'password': 'pass12345',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertFalse(User.objects.filter(username='usertwo').exists())

    def test_missing_username_field_crashes_with_500(self):
        # Documents existing behavior: create_user reads data['username'] directly
        # with no key-existence check, so a missing field raises an uncaught
        # KeyError instead of a clean 400. Not fixed per the "document, don't
        # silently fix" decision for this pass.
        with self.assertRaises(KeyError):
            self.client.post('/user/add/', {
                'email': 'nouser@example.com', 'password': 'pass12345',
            }, format='json')


class LoginTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='loginuser', email='login@example.com', password='pass12345')

    def test_login_issues_access_and_refresh_tokens(self):
        response = self.client.post('/token/', {'username': 'loginuser', 'password': 'pass12345'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_token_contains_correct_user_claim(self):
        response = self.client.post('/token/', {'username': 'loginuser', 'password': 'pass12345'}, format='json')
        token = AccessToken(response.data['access'])

        self.assertEqual(str(token['user_id']), str(self.user.id))
        self.assertEqual(token['token_type'], 'access')

    def test_login_with_wrong_password_is_rejected(self):
        response = self.client.post('/token/', {'username': 'loginuser', 'password': 'wrongpass'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_login_with_unknown_username_is_rejected(self):
        response = self.client.post('/token/', {'username': 'ghost', 'password': 'pass12345'}, format='json')
        self.assertEqual(response.status_code, 401)


class ProtectedEndpointAuthTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='protecteduser', email='p@example.com', password='pass12345')
        Profile.objects.create(username='protecteduser', email='p@example.com', user=self.user)

    def test_no_token_is_rejected(self):
        response = self.client.post('/profile/send/', {'username': 'protecteduser'})
        self.assertEqual(response.status_code, 401)

    def test_garbage_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer not-a-real-token')
        response = self.client.post('/profile/send/', {'username': 'protecteduser'})
        self.assertEqual(response.status_code, 401)

    def test_valid_token_is_accepted(self):
        access = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.post('/profile/send/', {
            'username': 'protecteduser', 'firstname': 'A', 'lastname': 'B',
            'bio': '', 'country': '', 'phone': '', 'birth_date': '2000-01-01',
        })
        # Reaching a 200/500 (not 401/403) proves the token itself was accepted;
        # this test only asserts the auth layer, not the view's business logic.
        self.assertNotIn(response.status_code, (401, 403))


class LogoutTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='logoutuser', email='l@example.com', password='pass12345')

    def test_logout_blacklists_refresh_token(self):
        refresh = RefreshToken.for_user(self.user)
        access = refresh.access_token

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.post('/user/logout/', {'refresh_token': str(refresh)}, format='json')

        self.assertEqual(response.data, '205')

        refresh_response = self.client.post('/token/refresh/', {'refresh': str(refresh)}, format='json')
        self.assertEqual(refresh_response.status_code, 401)

    def test_logout_with_invalid_refresh_token_reports_401_in_body(self):
        access = AccessToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.post('/user/logout/', {'refresh_token': 'not-a-real-refresh-token'}, format='json')

        self.assertEqual(response.data, '401')

    def test_logout_requires_authentication(self):
        response = self.client.post('/user/logout/', {'refresh_token': 'whatever'}, format='json')
        self.assertIn(response.status_code, (401, 403))


class ExpiredTokenTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='expireduser', password='pass12345')
        Profile.objects.create(username='expireduser', email='e@example.com', user=self.user)

    def test_expired_access_token_is_rejected(self):
        access = AccessToken.for_user(self.user)
        access.set_exp(lifetime=timedelta(seconds=-1))

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = self.client.post('/profile/send/', {'username': 'expireduser'})

        self.assertEqual(response.status_code, 401)


class EndToEndAuthFlowTests(TestCase):
    """Full registration -> login -> access a protected endpoint."""

    def setUp(self):
        self.client = APIClient()

    def test_register_then_login_then_access_protected_endpoint(self):
        register = self.client.post('/user/add/', {
            'username': 'flowuser', 'email': 'flow@example.com', 'password': 'strongpass1',
        }, format='json')
        self.assertEqual(register.status_code, 200)

        login = self.client.post('/token/', {'username': 'flowuser', 'password': 'strongpass1'}, format='json')
        self.assertEqual(login.status_code, 200)
        access_token = login.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        protected = self.client.post('/profile/send/', {
            'username': 'flowuser', 'firstname': 'Flow', 'lastname': 'User',
            'bio': '', 'country': '', 'phone': '', 'birth_date': '2000-01-01',
        })
        self.assertEqual(protected.status_code, 200)
