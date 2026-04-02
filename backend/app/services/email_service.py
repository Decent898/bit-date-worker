import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from pathlib import Path

from app.core.config import settings


def send_text_email(to_email: str, subject: str, body: str) -> None:
    if settings.EMAIL_DELIVERY_MODE.lower() == "log":
        outbox = Path(settings.EMAIL_OUTBOX_FILE)
        outbox.parent.mkdir(parents=True, exist_ok=True)
        with outbox.open("a", encoding="utf-8") as f:
            f.write(
                f"[{datetime.now().isoformat()}] TO={to_email} SUBJECT={subject}\n{body}\n{'-' * 40}\n"
            )
        return

    message = MIMEText(body, "plain", "utf-8")
    message["Subject"] = subject
    smtp_user = str(settings.EMAIL_ADDR or settings.SMTP_USER)
    smtp_password = settings.EMAIL_AUTH_CODE or settings.SMTP_PASSWORD
    smtp_from = str(settings.SMTP_FROM or smtp_user)

    message["From"] = smtp_from
    message["To"] = to_email

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], message.as_string())
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from, [to_email], message.as_string())
