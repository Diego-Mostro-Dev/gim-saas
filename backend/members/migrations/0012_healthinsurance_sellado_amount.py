from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0011_healthinsurance_member_insurance"),
    ]

    operations = [
        migrations.AddField(
            model_name="healthinsurance",
            name="sellado_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text=(
                    "Monto único que paga el socio al inscribirse en un "
                    "paquete de sesiones (ej. IAPOS cobra $6.000 de "
                    "sellado). Opcional."
                ),
                max_digits=10,
                null=True,
                verbose_name="Sellado (monto único)",
            ),
        ),
        migrations.AlterField(
            model_name="healthinsurance",
            name="session_price",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text=(
                    "Coseguro que paga el socio por cada sesión de "
                    "actividades por sesiones (ej. IAPOS cobra $6.000 por "
                    "sesión). Si la obra social cubre las sesiones, dejalo "
                    "en 0."
                ),
                max_digits=10,
                verbose_name="Coseguro por sesión",
            ),
        ),
    ]