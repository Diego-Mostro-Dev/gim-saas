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
    ("recovery", "Recuperación"),
]


class Activity(models.Model):
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="activities",
        verbose_name="Servicio",
    )
    name = models.CharField(max_length=100, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    instructor_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Profesor/a",
        help_text="Nombre del profesor o profesora de la actividad.",
    )
    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Precio mensual",
        help_text="Costo mensual de la actividad. Se factura como SubscriptionItem.",
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
        verbose_name = "Actividad"
        verbose_name_plural = "Actividades"
        unique_together = ("service", "name")
        ordering = ["name"]

    def save(self, *args, **kwargs):
        creating = self.pk is None
        if creating:
            super().save(*args, **kwargs)
            return
        update_fields = kwargs.get("update_fields")
        if update_fields is None or "active" in update_fields:
            try:
                old = Activity.objects.only("active").get(pk=self.pk)
            except Activity.DoesNotExist:
                old = None
            if old is not None and old.active and not self.active:
                super().save(*args, **kwargs)
                self.schedules.filter(active=True).update(active=False)
                return
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.service.gym.name})"


class ActivitySchedule(models.Model):
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="schedules",
        verbose_name="Actividad",
    )
    day = models.CharField(max_length=20, choices=DAY_CHOICES, verbose_name="Día")
    start_time = models.TimeField(verbose_name="Hora inicio")
    end_time = models.TimeField(verbose_name="Hora fin")
    capacity = models.PositiveIntegerField(verbose_name="Capacidad")
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Horario de actividad"
        verbose_name_plural = "Horarios de actividades"
        unique_together = ("activity", "day", "start_time")
        constraints = [
            CheckConstraint(
                condition=Q(end_time__gt=models.F("start_time")),
                name="activityschedule_end_after_start",
            ),
        ]

    def __str__(self):
        return (
            f"{self.activity.name} - "
            f"{self.get_day_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
        )


class Enrollment(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="activity_enrollments",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="activity_enrollments",
        verbose_name="Miembro",
    )
    schedule = models.ForeignKey(
        ActivitySchedule,
        on_delete=models.PROTECT,
        related_name="enrollments",
        verbose_name="Horario",
    )

    subscription_item = models.ForeignKey(
        "subscriptions.SubscriptionItem",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="enrollments",
        verbose_name="Item de suscripción",
    )

    modality = models.CharField(
        max_length=20,
        choices=ENROLLMENT_MODALITY_CHOICES,
        default="monthly",
        verbose_name="Modalidad",
        help_text=(
            "Mensual: se factura la cuota de la actividad. "
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
        help_text="Costo por sesión para este socio. Define el monto que paga por cada sesión según su obra social.",
    )
    amount_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Monto cobrado",
        help_text="Cuánto pagó el socio de este paquete de sesiones.",
    )
    sellado_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Sellado / coseguro",
        help_text="Monto opcional de sellado o coseguro que cobra el gimnasio.",
    )
    sellado_paid = models.BooleanField(
        default=False,
        verbose_name="Sellado cobrado",
    )

    active = models.BooleanField(default=True, verbose_name="Activo")
    enrolled_at = models.DateTimeField(auto_now_add=True, verbose_name="Inscripto")

    class Meta:
        verbose_name = "Inscripción"
        verbose_name_plural = "Inscripciones"
        constraints = [
            UniqueConstraint(
                fields=["gym", "member", "schedule"],
                condition=Q(active=True),
                name="unique_active_enrollment",
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


class ActivitySessionRecord(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="activity_session_records",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="activity_session_records",
        verbose_name="Miembro",
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name="session_records",
        verbose_name="Inscripción",
    )
    schedule = models.ForeignKey(
        ActivitySchedule,
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
                name="unique_session_record",
            ),
        ]

    def __str__(self):
        return f"{self.member} - {self.schedule} - {self.date}"
