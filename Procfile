web: python manage.py migrate && gunicorn config.wsgi:application --workers=1 --timeout=120 --max-requests=1000 --max-requests-jitter=50 --log-level=info
