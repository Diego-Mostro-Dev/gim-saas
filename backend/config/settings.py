from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url
import cloudinary
import sentry_sdk
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


# =========================
# SENTRY (monitoreo)
# =========================

# Inicializar lo antes posible para capturar errores de arranque y runtime.
# Se activa solo si SENTRY_DSN está definido (ej: producción); en local nada.
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.getenv("ENVIRONMENT", "production"),
        traces_sample_rate=float(
            os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.25")
        ),
        send_default_pii=False,
        max_breadcrumbs=50,
    )


# =========================
# SECURITY
# =========================

SECRET_KEY = os.getenv("SECRET_KEY")

DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    ".onrender.com",
]

if DEBUG:
    ALLOWED_HOSTS += ["127.0.0.1", "localhost", "192.168.100.89"]

# Seguridad de transporte y headers. Solo se fuerzan en producción;
# en DEBUG local no redirigir a HTTPS (el dev server usa HTTP).
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = bool(os.getenv("SECURE_SSL_REDIRECT", "True").lower() in ("1", "true", "yes"))
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True

    # Cookies solo por HTTPS
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# API key compartida para disparar tareas del sistema desde un cron externo
SCHEDULED_TASKS_KEY = os.getenv("SCHEDULED_TASKS_KEY", "")

# Intervalo mínimo entre ejecuciones del mantenimiento (segundos).
SCHEDULED_TASKS_INTERVAL_SECONDS = int(
    os.getenv("SCHEDULED_TASKS_INTERVAL_SECONDS", "21600")
)

# Habilita el disparador perezoso desde requests (middleware).
SCHEDULED_TASKS_ENABLED = os.getenv("SCHEDULED_TASKS_ENABLED", "true").lower() == "true"


# =========================
# APPLICATIONS
# =========================

INSTALLED_APPS = [
    "corsheaders",

    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "cloudinary",
    "cloudinary_storage",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "members",
    "plans",
    "subscriptions",
    "payments",
    "attendance",
    "accounts",
    "gyms",
    "profiles",
    "routines",
    "activities",
]


# =========================
# MIDDLEWARE
# =========================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",

    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "config.api.middleware.ScheduledTaskTriggerMiddleware",
]


# =========================
# CORS
# =========================

FRONTEND_URL = os.getenv("FRONTEND_URL")

CORS_ALLOWED_ORIGINS_ENV = os.getenv("CORS_ALLOWED_ORIGINS")
if CORS_ALLOWED_ORIGINS_ENV:
    CORS_ALLOWED_ORIGINS = [
        o.strip() for o in CORS_ALLOWED_ORIGINS_ENV.split(",") if o.strip()
    ]
elif FRONTEND_URL:
    CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
else:
    # En producción no debería haber fallback a localhost: que falle-closed
    # (bloquear orígenes reales) en vez de abrir CORS por error de config.
    CORS_ALLOWED_ORIGINS = (
        ["http://localhost:5173"] if DEBUG else []
    )


# =========================
# REST FRAMEWORK
# =========================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],

    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],

    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/hour",
        "user": "1000/hour",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,

    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.BrowsableAPIRenderer", "rest_framework.renderers.JSONRenderer"]
        if DEBUG
        else ["rest_framework.renderers.JSONRenderer"]
    ),
}


# =========================
# LOGGING
# =========================

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# =========================
# DATABASE
# =========================

# DATABASE_URL uses Neon PgBouncer pooler (transaction mode).
# Persistent Django connections become stale when PgBouncer closes
# idle backend mappings; conn_max_age=0 avoids stale connection errors.
_db_config = dj_database_url.parse(
    os.getenv("DATABASE_URL"),
    conn_max_age=0,
    conn_health_checks=True,
)

# Force IPv4 for Neon pooler — some networks drop/break IPv6 to the pooler.
# Resolve the hostname once at startup and inject hostaddr so libpq skips
# its own (broken) DNS.
import socket as _socket
_pg_host = _db_config["HOST"]
if _pg_host and not _pg_host.startswith(("{", "/")):
    try:
        _ipv4 = next(
            addr[4][0]
            for addr in _socket.getaddrinfo(_pg_host, None, _socket.AF_INET)
        )
        _db_config.setdefault("OPTIONS", {})["hostaddr"] = _ipv4
    except (StopIteration, _socket.gaierror):
        pass  # fall back to default resolution

DATABASES = {"default": _db_config}


# =========================
# ROOT / TEMPLATES
# =========================

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

LOGOUT_REDIRECT_URL = "/admin/"



CLOUDINARY_STORAGE = {
    "CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "API_KEY": os.getenv("CLOUDINARY_API_KEY"),
    "API_SECRET": os.getenv("CLOUDINARY_API_SECRET"),
}

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# =========================
# PASSWORD VALIDATION
# =========================

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# =========================
# INTERNATIONALIZATION
# =========================

LANGUAGE_CODE = "es-ar"
LANGUAGES = [
    ("es-ar", "Español"),
]
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True


# =========================
# STATIC FILES (PRODUCCIÓN)
# =========================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}