from django.contrib import admin
from django.urls import path, include
from config.api.health import health_check
from config.api.dashboard import DashboardSummaryView





urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check),

    path('api/', include('members.urls')),
    path('api/', include('plans.urls')),
    path('api/', include('subscriptions.urls')),
    path("api/dashboard/",DashboardSummaryView.as_view()),
    path("api/payments/", include("payments.urls")),
    path("api/attendance/", include("attendance.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/gyms/", include("gyms.urls")),
]
