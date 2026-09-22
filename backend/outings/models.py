import math

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models import UniqueConstraint, CheckConstraint

from gyms.models import Gym
from members.models import Member
from plans.models import Service


DAY_CHOICES = [
    ("monday", "Lunes"),
    ("tuesday", "Martes"),
    ("wednesday", "Miércoles"),
    ("thursday", "Jueves"),
    ("friday", "Viernes"),
    ("saturday", "Sábado"),
    ("sunday", "Domingo"),
]

BILLING_MODE_CHOICES = [
    ("monthly", "Mensual"),
    ("sessions", "Por sesiones"),
]

ENROLLMENT_MODALITY_CHOICES = [
    ("monthly", "Mensual"),
    ("package", "Paquete de sesiones"),
]

SESSION_SOURCE_CHOICES = [
    ("auto", "Automática"),
    ("manual", "Manual"),
]


class Outing(models.Model):
    """Salida grupal de running del gimnasio."""

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="outings",
        verbose_name="Gimnasio",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="outings",
        verbose_name="Servicio",
    )
    name = models.CharField(max_length=100, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="outings",
        verbose_name="Entrenador/a",
    )
    meeting_place = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Punto de encuentro",
        help_text="Lugar donde arranca la salida.",
    )
    route_polyline = models.JSONField(
        blank=True,
        null=True,
        verbose_name="Recorrido",
        help_text="Puntos del recorrido como [[lat, lng], ...] en orden. Se dibuja sobre el mapa.",
    )
    route_distance_km = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Distancia del recorrido (km)",
        help_text="Se calcula automáticamente desde el recorrido (fórmula haversine).",
    )
    duration_minutes = models.PositiveIntegerField(
        default=60,
        verbose_name="Duración (minutos)",
    )
    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Precio mensual",
        help_text="Costo mensual de la salida. Se factura como SubscriptionItem.",
    )
    billing_mode = models.CharField(
        max_length=20,
        choices=BILLING_MODE_CHOICES,
        default="monthly",
        verbose_name="Modalidad de cobro",
        help_text=(
            "Mensual: cuota mensual fija. Por sesiones: el staff inscribe a cada "
            "socio en modalidad mensual o en un paquete de N sesiones."
        ),
    )
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Salida grupal"
        verbose_name_plural = "Salidas grupales"
        unique_together = ("gym", "name")
        ordering = ["name"]

    def compute_route_distance_km(self):
        """Calcula la longitud del recorrido (ramales haversine) en km."""
        pts = self.route_polyline or []
        if not isinstance(pts, list) or len(pts) < 2:
            return None
        total = 0.0
        for i in range(1, len(pts)):
            try:
                lat1, lng1 = float(pts[i - 1][0]), float(pts[i - 1][1])
                lat2, lng2 = float(pts[i][0]), float(pts[i][1])
            except (TypeError, ValueError, IndexError):
                return None
            R = 6371.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlamb = math.radians(lng2 - lng1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlamb / 2) ** 2
            total += R * 2 * math.asin(math.sqrt(a))
        return round(total, 2)

    def save(self, *args, **kwargs):
        self.route_distance_km = self.compute_route_distance_km()
        creating = self.pk is None
        if creating:
            super().save(*args, **kwargs)
            return
        update_fields = kwargs.get("update_fields")
        if update_fields is None or "active" in update_fields:
            try:
                old = Outing.objects.only("active").get(pk=self.pk)
            except Outing.DoesNotExist:
                old = None
            if old is not None and old.active and not self.active:
                super().save(*args, **kwargs)
                self.schedules.filter(active=True).update(active=False)
                return
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.gym.name})"


class OutingSchedule(models.Model):
    outing = models.ForeignKey(
        Outing,
        on_delete=models.CASCADE,
        related_name="schedules",
        verbose_name="Salida",
    )
    day = models.CharField(max_length=20, choices=DAY_CHOICES, verbose_name="Día")
    start_time = models.TimeField(verbose_name="Hora inicio")
    end_time = models.TimeField(verbose_name="Hora fin")
    capacity = models.PositiveIntegerField(verbose_name="Capacidad")
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Horario de salida"
        verbose_name_plural = "Horarios de salidas"
        unique_together = ("outing", "day", "start_time")
        constraints = [
            CheckConstraint(
                condition=Q(end_time__gt=models.F("start_time")),
                name="outingschedule_end_after_start",
            ),
        ]

    def __str__(self):
        return (
            f"{self.outing.name} - "
            f"{self.get_day_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
        )


class OutingEnrollment(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="outing_enrollments",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="outing_enrollments",
        verbose_name="Miembro",
    )
    schedule = models.ForeignKey(
        OutingSchedule,
        on_delete=models.PROTECT,
        related_name="enrollments",
        verbose_name="Horario",
    )

    subscription_item = models.ForeignKey(
        "subscriptions.SubscriptionItem",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="outing_enrollments",
        verbose_name="Item de suscripción",
    )

    modality = models.CharField(
        max_length=20,
        choices=ENROLLMENT_MODALITY_CHOICES,
        default="monthly",
        verbose_name="Modalidad",
        help_text=(
            "Mensual: se factura la cuota de la salida. "
            "Paquete: el socio asiste a un número fijo de sesiones."
        ),
    )
    package_total_sessions = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Total de sesiones del paquete",
    )
    session_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Precio por sesión",
        help_text="Costo por salida para este socio.",
    )
    amount_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Monto cobrado",
        help_text="Cuánto pagó el socio de este paquete de sesiones.",
    )

    active = models.BooleanField(default=True, verbose_name="Activo")
    enrolled_at = models.DateTimeField(auto_now_add=True, verbose_name="Inscripto")

    class Meta:
        verbose_name = "Inscripción a salida"
        verbose_name_plural = "Inscripciones a salidas"
        constraints = [
            UniqueConstraint(
                fields=["gym", "member", "schedule"],
                condition=Q(active=True),
                name="unique_active_outing_enrollment",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member.first_name} {self.member.last_name} → "
            f"{self.schedule} "
            f"({'activo' if self.active else 'inactivo'})"
        )

    @property
    def used_sessions(self):
        return self.session_records.count()

    @property
    def total_amount(self):
        if self.session_price is None or self.package_total_sessions is None:
            return None
        return self.session_price * self.package_total_sessions

    @property
    def remaining_amount(self):
        total = self.total_amount
        if total is None:
            return None
        remaining = total - self.amount_paid
        return max(remaining, 0)

    @property
    def exhausted(self):
        return (
            self.modality == "package"
            and self.package_total_sessions is not None
            and self.used_sessions >= self.package_total_sessions
        )


class OutingSessionRecord(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="outing_session_records",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="outing_session_records",
        verbose_name="Miembro",
    )
    enrollment = models.ForeignKey(
        OutingEnrollment,
        on_delete=models.CASCADE,
        related_name="session_records",
        verbose_name="Inscripción",
    )
    schedule = models.ForeignKey(
        OutingSchedule,
        on_delete=models.PROTECT,
        related_name="session_records",
        verbose_name="Horario",
    )
    date = models.DateField(verbose_name="Fecha de la sesión", db_index=True)
    source = models.CharField(
        max_length=20,
        choices=SESSION_SOURCE_CHOICES,
        default="manual",
        verbose_name="Origen",
        help_text="Automática (check-in) o manual (staff).",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Registrada")

    class Meta:
        verbose_name = "Sesión asistida"
        verbose_name_plural = "Sesiones asistidas"
        ordering = ["-date", "-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["enrollment", "date", "schedule"],
                name="unique_outing_session_record",
            ),
        ]

    def __str__(self):
        return f"{self.member} - {self.schedule} - {self.date}"


ENROLLMENT_REQUEST_TYPE_CHOICES = [
    ("enroll", "Inscripción"),
    ("unenroll", "Baja"),
]

ENROLLMENT_REQUEST_STATUS_CHOICES = [
    ("pending", "Pendiente"),
    ("approved", "Aprobado"),
    ("rejected", "Rechazado"),
    ("cancelled_by_member", "Cancelado por el socio"),
    ("cancelled_by_staff", "Cancelado por el staff"),
]


class OutingEnrollmentRequest(models.Model):
    """Solicitud del socio para inscribirse o darse de baja de una salida.

    El socio la crea desde su portal; el staff la aprueba o rechaza desde
    el módulo de Salidas. Al aprobar se crea o cancela la inscripción.
    """

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="outing_enrollment_requests",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="outing_enrollment_requests",
        verbose_name="Miembro",
    )
    request_type = models.CharField(
        max_length=20,
        choices=ENROLLMENT_REQUEST_TYPE_CHOICES,
        verbose_name="Tipo",
    )
    outing = models.ForeignKey(
        Outing,
        on_delete=models.PROTECT,
        related_name="enrollment_requests",
        null=True,
        verbose_name="Salida",
    )
    schedule = models.ForeignKey(
        OutingSchedule,
        on_delete=models.PROTECT,
        related_name="enrollment_requests",
        null=True,
        verbose_name="Horario",
    )
    enrollment = models.ForeignKey(
        OutingEnrollment,
        on_delete=models.PROTECT,
        related_name="enrollment_requests",
        null=True,
        blank=True,
        verbose_name="Inscripción",
    )

    status = models.CharField(
        max_length=20,
        choices=ENROLLMENT_REQUEST_STATUS_CHOICES,
        default="pending",
        verbose_name="Estado",
    )
    requested_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de solicitud"
    )
    reviewed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Fecha de revisión"
    )
    reviewed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Revisado por",
    )
    admin_notes = models.TextField(
        blank=True, verbose_name="Notas del administrador"
    )

    class Meta:
        verbose_name = "Solicitud de salida grupal"
        verbose_name_plural = "Solicitudes de salidas grupales"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["gym", "status"]),
            models.Index(fields=["member", "status"]),
        ]
        constraints = [
            UniqueConstraint(
                fields=["member", "request_type"],
                condition=Q(status="pending"),
                name="unique_pending_outing_enrollment_request",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} - {self.get_request_type_display()} "
            f"{self.schedule or self.enrollment} ({self.status})"
        )