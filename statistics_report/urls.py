from django.urls import path

from . import views

urlpatterns = [
    path('', views.statistics_view, name='statistics'),
    path('export/', views.export_statistics, name='statistics export'),
]
