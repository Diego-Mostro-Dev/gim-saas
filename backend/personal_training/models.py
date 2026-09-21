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

ASSIGNMENT_MODALITY_CHOICES = [
    ("monthly", "Mensual"),
    ("package", "Paquete de sesiones"),
]

SESSION_SOURCE_CHOICES = [
    ("auto", "Automática"),
    ("manual", "Manual"),
    ("no_show", "No asistió"),
]

TRAINER_GENDER_CHOICES = [
    ("male", "Varón"),
    ("female", "Mujer"),
    ("any", "Varón o mujer"),
]


class PersonalTrainingService(models.Model):
    """Oferta de entrenamiento personal del gimnasio.

    Es el servicio facturable (mensual o por sesiones) y define las
    restricciones para asignarle trainers (género preferido y duración de
    la sesión).
    """

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="personal_training_services",
        verbose_name="Gimnasio",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="personal_training_services",
        verbose_name="Servicio",
    )
    name = models.CharField(max_length=100, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Precio mensual",
        help_text="Costo mensual del entrenamiento personal. Se factura como SubscriptionItem.",
    )
    billing_mode = models.CharField(
        max_length=20,
        choices=BILLING_MODE_CHOICES,
        default="monthly",
        verbose_name="Modalidad de cobro",
        help_text=(
            "Mensual: cuota mensual fija. Por sesiones: el staff asigna al socio "
            "en modalidad mensual o en un paquete de N sesiones."
        ),
    )
    duration_minutes = models.PositiveIntegerField(
        default=60,
        verbose_name="Duración de la sesión (minutos)",
    )
    trainer_gender = models.CharField(
        max_length=10,
        choices=TRAINER_GENDER_CHOICES,
        default="any",
        verbose_name="Género del entrenador/a",
        help_text="Restringe qué trainers pueden asignarse a esta oferta.",
    )
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Oferta de entrenamiento personal"
        verbose_name_plural = "Ofertas de entrenamiento personal"
        unique_together = ("gym", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.gym.name})"


class PersonalTrainingAssignment(models.Model):
    """Horario 1:1 entre un socio y un trainer.

    A diferencia de las actividades (horario + inscripción), en el
    entrenamiento personal el horario es la inscripción: cada asignación
    es un cupo exclusivo socio↔trainer.
    """

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="personal_training_assignments",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="personal_training_assignments",
        verbose_name="Miembro",
    )
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="personal_training_assignments",
        verbose_name="Entrenador/a",
    )
    service = models.ForeignKey(
        PersonalTrainingService,
        on_delete=models.PROTECT,
        related_name="assignments",
        verbose_name="Oferta",
    )

    day = models.CharField(max_length=20, choices=DAY_CHOICES, verbose_name="Día")
    start_time = models.TimeField(verbose_name="Hora inicio")
    end_time = models.TimeField(verbose_name="Hora fin")

    subscription_item = models.ForeignKey(
        "subscriptions.SubscriptionItem",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="personal_training_assignments",
        verbose_name="Item de suscripción",
    )

    modality = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_MODALITY_CHOICES,
        default="monthly",
        verbose_name="Modalidad",
        help_text=(
            "Mensual: se factura la cuota del servicio. "
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
        help_text="Costo por sesión para este socio.",
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
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")
    no_show_scan_until = models.DateField(
        null=True,
        blank=True,
        verbose_name="Descuento de no asistencia procesado hasta",
        help_text="Fecha hasta la cual ya se evaluaron las no asistencias de este paquete.",
    )

    class Meta:
        verbose_name = "Asignación de entrenamiento personal"
        verbose_name_plural = "Asignaciones de entrenamiento personal"
        ordering = ["day", "start_time"]
        constraints = [
            CheckConstraint(
                condition=Q(end_time__gt=models.F("start_time")),
                name="personal_training_end_after_start",
            ),
            UniqueConstraint(
                fields=["gym", "member", "day", "start_time"],
                condition=Q(active=True),
                name="unique_active_pt_assignment",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} → {self.trainer.username} "
            f"{self.get_day_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
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

    @property
    def trainer_name(self):
        profile = getattr(self.trainer, "profile", None)
        if (
            profile is not None
            and self.trainer.first_name
            and self.trainer.last_name
        ):
            return f"{self.trainer.first_name} {self.trainer.last_name}"
        return self.trainer.username


class PersonalTrainingSessionRecord(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="personal_training_session_records",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="personal_training_session_records",
        verbose_name="Miembro",
    )
    assignment = models.ForeignKey(
        PersonalTrainingAssignment,
        on_delete=models.CASCADE,
        related_name="session_records",
        verbose_name="Asignación",
    )
    date = models.DateField(verbose_name="Fecha de la sesión", db_index=True)
    source = models.CharField(
        max_length=20,
        choices=SESSION_SOURCE_CHOICES,
        default="manual",
        verbose_name="Origen",
        help_text="Manual (staff) o automática.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Registrada")

    class Meta:
        verbose_name = "Sesión de entrenamiento personal"
        verbose_name_plural = "Sesiones de entrenamiento personal"
        ordering = ["-date", "-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["assignment", "date"],
                name="unique_pt_session_record",
            ),
        ]

    def __str__(self):
        return f"{self.member} - {self.assignment} - {self.date}"


class PersonalTrainingChangeRequest(models.Model):
    """Solicitud de cambio de día/hora de una asignación de PT.

    El socio la crea desde su portal; el staff/owner la aprueba o rechaza.
    Al aprobar, la asignación se actualiza con el horario solicitado.
    """

    STATUS_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobado"),
        ("executed", "Ejecutado"),
        ("rejected", "Rechazado"),
        ("cancelled_by_member", "Cancelado por el socio"),
        ("cancelled_by_staff", "Cancelado por el staff"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="personal_training_change_requests",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="personal_training_change_requests",
        verbose_name="Miembro",
    )
    assignment = models.ForeignKey(
        PersonalTrainingAssignment,
        on_delete=models.PROTECT,
        related_name="change_requests",
        verbose_name="Asignación",
    )

    requested_day = models.CharField(
        max_length=20,
        choices=DAY_CHOICES,
        verbose_name="Día solicitado",
    )
    requested_start_time = models.TimeField(verbose_name="Hora inicio solicitada")
    requested_end_time = models.TimeField(verbose_name="Hora fin solicitada")

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="Estado",
    )
    requested_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de solicitud")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de revisión")
    reviewed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Revisado por",
    )
    admin_notes = models.TextField(blank=True, verbose_name="Notas del administrador")

    class Meta:
        verbose_name = "Solicitud de cambio de entrenamiento personal"
        verbose_name_plural = "Solicitudes de cambio de entrenamiento personal"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["gym", "status"]),
            models.Index(fields=["member", "status"]),
        ]
        constraints = [
            UniqueConstraint(
                fields=["member", "assignment"],
                condition=Q(status="pending"),
                name="unique_pending_pt_change_request",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} - "
            f"{self.assignment.day} "
            f"{self.assignment.start_time:%H:%M} → "
            f"{self.requested_day} "
            f"{self.requested_start_time:%H:%M} "
            f"({self.status})"
        )