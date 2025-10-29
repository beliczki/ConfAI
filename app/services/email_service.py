"""Email service for sending PIN codes."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


class EmailService:
    """Service for sending emails."""

    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.username = os.getenv('SMTP_USERNAME')
        self.password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('EMAIL_FROM', 'noreply@confai.com')

    def send_pin_email(self, to_email, pin):
        """Send PIN code to user's email."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'Your ConfAI Login PIN'
            msg['From'] = self.from_email
            msg['To'] = to_email

            # Create HTML and plain text versions
            text_content = f"""
Hello,

Your ConfAI login PIN is: {pin}

This PIN will expire in 15 minutes.

If you didn't request this PIN, please ignore this email.

Best regards,
The ConfAI Team
            """

            html_content = f"""
<html>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #E20074, #001E50); padding: 20px; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0;">ConfAI</h1>
    </div>
    <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 10px 10px;">
      <h2 style="color: #333;">Your Login PIN</h2>
      <p style="color: #666; font-size: 16px;">Hello,</p>
      <p style="color: #666; font-size: 16px;">Your ConfAI login PIN is:</p>
      <div style="background: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h1 style="color: #E20074; font-size: 36px; letter-spacing: 10px; margin: 0;">{pin}</h1>
      </div>
      <p style="color: #666; font-size: 14px;">This PIN will expire in <strong>15 minutes</strong>.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        If you didn't request this PIN, please ignore this email.
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>© 2024 ConfAI. All rights reserved.</p>
    </div>
  </body>
</html>
            """

            # Attach both versions
            part1 = MIMEText(text_content, 'plain')
            part2 = MIMEText(html_content, 'html')
            msg.attach(part1)
            msg.attach(part2)

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

            print(f"PIN email sent to {to_email}")
            return True

        except Exception as e:
            print(f"Error sending email: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()
