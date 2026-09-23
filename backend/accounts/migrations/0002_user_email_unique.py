from django.db import migrations


def dedupe_non_blank_emails(apps, schema_editor):
    """Blanquea emails duplicados; conserva el usuario con id menor.

    Se ejecuta antes de crear el índice único parcial (P1-3, R9): evita el
    500 que produciría un IntegrityError al intentar crear el índice si ya
    existen duplicados en la base.
    """
    User = apps.get_model("auth", "User")
    seen = {}
    for user in User.objects.all().order_by("id"):
        email = (user.email or "").strip()
        if not email:
            continue
        if email in seen:
            user.email = ""
            user.save(update_fields=["email"])
        else:
            seen[email] = user.id


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        # auth.0002-0012 (alter de auth_user, incluida la reconstrucción de
        # la tabla en SQLite) NO se aplican si solo dependemos de auth.0001
        # (swappable_dependency del 0001). Sin esta dependencia explícita,
        # en un migrate completo la tabla se reconstruye DESPUÉS de crear
        # este índice y el índice se pierde silenciosamente (R9).
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(
            dedupe_non_blank_emails,
            migrations.RunPython.noop,
        ),
        migrations.RunSQL(
            sql=(
                "CREATE UNIQUE INDEX auth_user_email_unique_when_not_blank "
                "ON auth_user (email) WHERE email <> '';"
            ),
            reverse_sql=(
                "DROP INDEX IF EXISTS auth_user_email_unique_when_not_blank;"
            ),
        ),
    ]