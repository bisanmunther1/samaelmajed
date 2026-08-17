from django.apps import AppConfig


class StatisticsReportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'statistics_report'

    def ready(self):
        # Points the admin index at our dashboard template (adds at-a-glance
        # stat tiles above the standard app list) without subclassing AdminSite.
        from django.contrib import admin
        admin.site.index_template = 'admin/dashboard_index.html'
