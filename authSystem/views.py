from django.http import JsonResponse
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view
from rest_framework.parsers import JSONParser
from profiles.models import Profile

    
@api_view(['POST'])
def create_user(request):
 
    data = JSONParser().parse(request)
    name = data['username']
    emaill = data['email']
    password = data['password']
    message_err=[]
    
    if name == None or emaill == None or password == None:
          return Response(message='no  data request' , status =405)  
          
    if User.objects.filter(username = name):
       message_err.append('name')
   
    if User.objects.filter(email =emaill):
       message_err.append('email')
       
    if len(message_err) > 0:
       return Response(message_err , status =400)
     
    new_user = User(username = name,email = emaill)
    new_user.set_password(password)
    
    new_profile =Profile(username = name ,email = emaill,user = new_user)
 
    new_user.save()
    new_profile.save()
 
    
    return JsonResponse({'message':'user created successfully !!!'} , status =200)

    
 
class LogoutView(APIView):

    permission_classes = (IsAuthenticated,)
    def post(self, request):
          
          try:
               refresh_token = request.data["refresh_token"]
               token = RefreshToken(refresh_token)
               token.blacklist()
               return Response('205')
          except Exception as e:
               return Response('401')

