from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .models import Trip_features
# Create your views here.


@api_view(['GET'])
def get_features( request,name ):
 
 
  features = Trip_features.objects.filter(name=name).values()
  
  return Response(features[0] ,status =200)
 
 