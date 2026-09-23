"""
Templates HTML para emails transaccionales.

Los emails se envían como HTML inline (sin archivos externos) para
maximizar la compatibilidad con clientes de email.


El template usa estilos inline porque la mayoría de los clientes de email
(Gmail, Outlook, Yahoo) no soportan <style> o <link>.
"""


def build_password_reset_email(
    reset_url: str,
    code: str,
    gym_name: str | None = None,
) -> tuple[str, str]:
    """
    Genera el asunto y cuerpo HTML para el email de restablecimiento de contraseña.

    El secreto es el código de 6 dígitos: el botón lleva a la app sin ningún
    parámetro en la URL.

    Retorna (subject, html_body).
    """
    prefix = f"{gym_name} – " if gym_name else ""
    subject = f"{prefix}Restablecé tu contraseña"

    title = f"Restablecé tu contraseña"
    if gym_name:
        title = f"{gym_name} – Restablecé tu contraseña"

    html_body = f"""\
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#6366f1; padding:32px 24px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">
                Restablecé tu contraseña
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 24px; color:#3f3f46; font-size:15px; line-height:1.6;">
              <p style="margin:0 0 16px 0;">Hola,</p>
              <p style="margin:0 0 24px 0;">
                Recibimos un pedido para restablecer tu contraseña.
                Usá el código de abajo en la app para crear una nueva:
              </p>

              <!-- Código -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="background-color:#f4f4f5; border-radius:8px; padding:20px 24px;">
                    <p style="margin:0 0 6px 0; font-size:13px; color:#71717a; text-transform:uppercase; letter-spacing:1px;">
                      Tu código
                    </p>
                    <p style="margin:0; font-size:32px; font-weight:700; letter-spacing:8px; color:#18181b; font-family:monospace, Courier New, monospace;">
                      {code}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 24px 0;">
                    <a href="{reset_url}"
                       style="display:inline-block; background-color:#6366f1; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding:14px 32px; border-radius:8px;">
                      Ir a restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0; font-size:13px; color:#71717a;">
                Si no pediste este cambio, podés ignorar este email.
                Tu contraseña actual no se va a modificar.
              </p>

              <p style="margin:0; font-size:13px; color:#71717a;">
                Este código expira en <strong>1 hora</strong> y solo puede
                usarse una vez.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px; background-color:#fafafa; border-top:1px solid #e4e4e7; text-align:center;">
              <p style="margin:0; font-size:12px; color:#a1a1aa;">
                Email enviado por Gim-SaaS
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, html_body
