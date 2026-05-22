from django.contrib import admin
from django.urls import path, include
from config.api.health import health_check
from config.api.dashboard import dashboard_summary



urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check),

    path('api/', include('members.urls')),
    path('api/', include('plans.urls')),
    path('api/', include('subscriptions.urls')),
    path('api/dashboard/', dashboard_summary),
]
