from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

from config.api.health import health_check
from config.api.dashboard import DashboardSummaryView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/health/", health_check),

    path("api/", include("members.urls")),
    path("api/", include("plans.urls")),
    path("api/", include("subscriptions.urls")),

    path("api/dashboard/", DashboardSummaryView.as_view()),

    path("api/payments/", include("payments.urls")),
    path("api/attendance/", include("attendance.urls")),

    path("api/auth/", include("accounts.urls")),
    path("api/gyms/", include("gyms.urls")),

    path("api/routines/", include("routines.urls")),
    path("api/activities/", include("activities.urls")),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )