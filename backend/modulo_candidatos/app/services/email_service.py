# ==============================================================
# modulo_candidatos / app/services/email_service.py
# Envío de correo — enchufable. Si SMTP_HOST está vacío (modo desarrollo o
# todavía sin credenciales reales), el correo se registra en el log del
# servidor en vez de enviarse — así se puede probar el flujo completo sin
# depender de un proveedor real. Configurar SMTP_HOST/SMTP_USER/SMTP_PASSWORD
# (variables de entorno) activa el envío real sin tocar código.
# ==============================================================

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("email")


def enviar_correo(destinatario: str, asunto: str, cuerpo_html: str, cuerpo_texto: str = "") -> bool:
    """Devuelve True si se envió (o se registró en modo desarrollo), False si falló el envío real."""
    if not settings.SMTP_HOST:
        logger.info(
            "\n========== CORREO (modo desarrollo — SMTP no configurado) ==========\n"
            f"Para: {destinatario}\nAsunto: {asunto}\n---\n{cuerpo_texto or cuerpo_html}\n"
            "======================================================================"
        )
        return True

    mensaje = MIMEMultipart("alternative")
    mensaje["Subject"] = asunto
    mensaje["From"] = settings.SMTP_FROM
    mensaje["To"] = destinatario
    if cuerpo_texto:
        mensaje.attach(MIMEText(cuerpo_texto, "plain"))
    mensaje.attach(MIMEText(cuerpo_html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as servidor:
            if settings.SMTP_USE_TLS:
                servidor.starttls()
            if settings.SMTP_USER:
                servidor.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            servidor.sendmail(settings.SMTP_FROM, [destinatario], mensaje.as_string())
        return True
    except Exception:
        logger.exception(f"No se pudo enviar el correo a {destinatario} (asunto: {asunto})")
        return False


def _plantilla_base(titulo: str, cuerpo_html: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1B2B22;">
      <div style="background: #004D20; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <span style="color: #fff; font-weight: 700; font-size: 16px;">Aguas Nacionales EPM</span>
      </div>
      <div style="border: 1px solid #E2EAE5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #004D20; margin-top: 0;">{titulo}</h2>
        {cuerpo_html}
        <p style="color: #8FA79A; font-size: 11.5px; margin-top: 32px;">
          Este es un correo automático del sistema de selección de talento — no respondas a este mensaje.
        </p>
      </div>
    </div>
    """


def enviar_correo_solicitud_recibida(destinatario: str, nombre: str, cargo: str, radicado: str) -> bool:
    cuerpo = _plantilla_base(
        "Recibimos tu inscripción",
        f"""
        <p>Hola {nombre},</p>
        <p>Confirmamos que tu inscripción a la vacante <strong>{cargo}</strong> fue recibida correctamente.</p>
        <p>Tu número de radicado es:</p>
        <p style="font-family:monospace;font-size:18px;font-weight:700;color:#004D20;background:#EDF7EF;display:inline-block;padding:8px 16px;border-radius:6px;">{radicado}</p>
        <p style="font-size:12.5px;color:#5B6B60;">Puedes hacer seguimiento a tu postulación en cualquier momento desde "Mis postulaciones" en el sitio.</p>
        """,
    )
    return enviar_correo(destinatario, f"Recibimos tu inscripción a {cargo} — Aguas Nacionales EPM", cuerpo)


def enviar_correo_cambio_estado(destinatario: str, nombre: str, cargo: str, radicado: str, nuevo_estado: str) -> bool:
    cuerpo = _plantilla_base(
        "Actualización de tu postulación",
        f"""
        <p>Hola {nombre},</p>
        <p>Tu postulación a <strong>{cargo}</strong> (radicado {radicado}) cambió de estado a:</p>
        <p style="font-size:18px;font-weight:700;color:#004D20;">{nuevo_estado}</p>
        <p style="font-size:12.5px;color:#5B6B60;">Puedes ver el detalle completo en "Mis postulaciones" en el sitio.</p>
        """,
    )
    return enviar_correo(destinatario, f"Actualización de tu postulación a {cargo} — Aguas Nacionales EPM", cuerpo)
