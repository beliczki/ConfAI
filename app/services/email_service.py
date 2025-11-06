"""Email service for sending PIN codes."""
import os
import base64
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.utils import make_msgid


class EmailService:
    """Service for sending emails."""

    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', 587))
        self.username = os.getenv('SMTP_USERNAME')
        self.password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('EMAIL_FROM', 'noreply@confai.com')
        self.logo_data = self._load_logo()

    def _load_logo(self):
        """Load the logo image as bytes."""
        try:
            logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'img', 'telekom-confai-white.png')
            with open(logo_path, 'rb') as f:
                return f.read()
        except Exception as e:
            print(f"Warning: Could not load logo for email: {e}")
            return None

    def send_pin_email(self, to_email, pin):
        """Send PIN code to user's email."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'Your ConfAI Login PIN'
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Message-ID'] = make_msgid(domain=self.from_email.split('@')[1])

            # Create HTML and plain text versions
            text_content = f"""
Hello,

Your ConfAI login PIN is: {pin}

This PIN will expire in 15 minutes.

If you didn't request this PIN, please ignore this email.

Best regards,
The ConfAI Team
            """

            # Build logo HTML (use CID if logo available)
            logo_html = '<img src="cid:logo" alt="ConfAI" style="max-height: 50px; margin: 0;">' if self.logo_data else '<h1 style="color: white; margin: 0;">ConfAI</h1>'

            html_content = f"""
<html>
  <head>
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <style>
      :root {{
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }}
      [data-ogsc] .email-header {{ background-color: #1a1a1a !important; }}
      .email-header {{ background-color: #1a1a1a !important; }}
      @media (prefers-color-scheme: dark) {{
        .email-header {{ background-color: #1a1a1a !important; }}
      }}
    </style>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="email-header" bgcolor="#1a1a1a" style="background-color: #1a1a1a !important; background: #1a1a1a !important; padding: 30px 20px 20px 30px; border-radius: 10px 10px 0 0; text-align: left;">
          {logo_html}
        </td>
      </tr>
    </table>
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
      <p>© 2025 Telekom ConfAI. All rights reserved.</p>
    </div>
  </body>
</html>
            """

            # Attach both versions
            part1 = MIMEText(text_content, 'plain')
            part2 = MIMEText(html_content, 'html')
            msg.attach(part1)
            msg.attach(part2)

            # Attach logo as inline image with CID
            if self.logo_data:
                logo_img = MIMEImage(self.logo_data)
                logo_img.add_header('Content-ID', '<logo>')
                logo_img.add_header('Content-Disposition', 'inline', filename='logo.png')
                msg.attach(logo_img)

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

    def send_invite_email(self, to_email, name, invite_link):
        """Send invite email to new user."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'You\'re invited to ConfAI!'
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Message-ID'] = make_msgid(domain=self.from_email.split('@')[1])

            # Create HTML and plain text versions
            text_content = f"""
Hello {name},

You've been invited to join ConfAI - your conference intelligence assistant!

Click the link below to accept your invite and get started:
{invite_link}

This invite link will expire in 7 days.

Best regards,
The ConfAI Team
            """

            # Build logo HTML (use CID if logo available)
            logo_html = '<img src="cid:logo" alt="ConfAI" style="max-height: 50px; margin: 0;">' if self.logo_data else '<h1 style="color: white; margin: 0; font-size: 32px;">ConfAI</h1>'

            html_content = f"""
<html>
  <head>
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <style>
      :root {{
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }}
      [data-ogsc] .email-header {{ background-color: #1a1a1a !important; }}
      .email-header {{ background-color: #1a1a1a !important; }}
      @media (prefers-color-scheme: dark) {{
        .email-header {{ background-color: #1a1a1a !important; }}
      }}
    </style>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="email-header" bgcolor="#1a1a1a" style="background-color: #1a1a1a !important; background: #1a1a1a !important; padding: 30px 20px 20px 30px; border-radius: 10px 10px 0 0; text-align: left;">
          {logo_html}
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">Conference Intelligence Assistant</p>
        </td>
      </tr>
    </table>
    <div style="background: #f8f8f8; padding: 40px; border-radius: 0 0 10px 10px;">
      <h2 style="color: #333; font-size: 24px; margin-top: 0;">Welcome, {name}!</h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        You've been invited to join <strong>ConfAI</strong>, an AI-powered assistant that helps you derive meaningful insights from conference materials and knowledge resources.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{invite_link}" style="background: linear-gradient(135deg, #E20074, #001E50); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
          Accept Invite &rarr;
        </a>
      </div>
      <p style="color: #999; font-size: 14px; margin-top: 30px;">
        This invite link will expire in <strong>7 days</strong>.
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p>© 2025 Telekom ConfAI. All rights reserved.</p>
    </div>
  </body>
</html>
            """

            # Attach both versions
            part1 = MIMEText(text_content, 'plain')
            part2 = MIMEText(html_content, 'html')
            msg.attach(part1)
            msg.attach(part2)

            # Attach logo as inline image with CID
            if self.logo_data:
                logo_img = MIMEImage(self.logo_data)
                logo_img.add_header('Content-ID', '<logo>')
                logo_img.add_header('Content-Disposition', 'inline', filename='logo.png')
                msg.attach(logo_img)

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

            print(f"Invite email sent to {to_email}")
            return True

        except Exception as e:
            print(f"Error sending invite email: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()
