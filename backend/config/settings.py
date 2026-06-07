from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url
import cloudinary
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


# =========================
# SECURITY
# =========================

SECRET_KEY = os.getenv("SECRET_KEY")

DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "192.168.100.89",
    ".onrender.com",
]


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
    
]


# =========================
# MIDDLEWARE
# =========================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# =========================
# CORS
# =========================

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://192.168.100.89:5173",
]

CORS_ALLOW_ALL_ORIGINS = True  # MVP (luego lo cerramos)


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
}


# =========================
# DATABASE
# =========================

DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL")
    )
}


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



FRONTEND_URL = os.getenv("FRONTEND_URL")

if not FRONTEND_URL:
    raise Exception("FRONTEND_URL environment variable is required")

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

DEFAULT_FILE_STORAGE = (
    "cloudinary_storage.storage.MediaCloudinaryStorage"
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

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# =========================
# STATIC FILES (PRODUCCIÓN)
# =========================

STATIC_URL = "static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"