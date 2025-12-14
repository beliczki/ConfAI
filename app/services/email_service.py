"""Email service for sending PIN codes."""
import os
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
        self.from_name = os.getenv('EMAIL_FROM_NAME', 'Telekom ConfAI')
        self.logo_data = self._load_logo()
        self.bg_gradient_data = self._load_bg_gradient()

    def _get_from_header(self):
        """Get formatted From header with display name."""
        from email.utils import formataddr
        return formataddr((self.from_name, self.from_email))

    def _load_logo(self):
        """Load the logo image as bytes."""
        try:
            logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'img', 'telekom-confai-white.png')
            with open(logo_path, 'rb') as f:
                return f.read()
        except Exception as e:
            print(f"Warning: Could not load logo for email: {e}")
            return None

    def _load_bg_gradient(self):
        """Load the background gradient image as bytes."""
        try:
            bg_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'img', 'greybggrad.jpg')
            with open(bg_path, 'rb') as f:
                return f.read()
        except Exception as e:
            print(f"Warning: Could not load background gradient for email: {e}")
            return None

    def send_pin_email(self, to_email, pin):
        """Send PIN code to user's email."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'Your ConfAI Login PIN'
            msg['From'] = self._get_from_header()
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
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <style>
      .email-header {{
        background-color: #1a1a1a !important;
        background: linear-gradient(to bottom, #1a1a1a, #2a2a2a) !important;
      }}
    </style>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div class="email-header" style="overflow: hidden; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); padding: 30px 20px 20px 30px; border-radius: 10px 10px 0 0; text-align: left;">
      <img src="cid:bggrad" alt="" style="height: 1px; opacity: 0.1;">
      {logo_html}
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

            # Attach background gradient image
            if self.bg_gradient_data:
                bg_img = MIMEImage(self.bg_gradient_data, 'jpeg')
                bg_img.add_header('Content-ID', '<bggrad>')
                bg_img.add_header('Content-Disposition', 'inline', filename='bggrad.jpg')
                msg.attach(bg_img)

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
            msg['From'] = self._get_from_header()
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
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <style>
      .email-header {{
        background-color: #1a1a1a !important;
        background: linear-gradient(to bottom, #1a1a1a, #2a2a2a) !important;
      }}
    </style>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div class="email-header" style="overflow: hidden; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); padding: 30px 20px 20px 30px; border-radius: 10px 10px 0 0; text-align: left;">
      <img src="cid:bggrad" alt="" style="height: 1px; opacity: 0.1;">
      {logo_html}
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">Conference Intelligence Assistant</p>
    </div>
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

            # Attach background gradient image
            if self.bg_gradient_data:
                bg_img = MIMEImage(self.bg_gradient_data, 'jpeg')
                bg_img.add_header('Content-ID', '<bggrad>')
                bg_img.add_header('Content-Disposition', 'inline', filename='bggrad.jpg')
                msg.attach(bg_img)

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

    def send_reminder_email(self, to_email, name, subject, message, login_link=None):
        """Send reminder email to user with custom subject and message."""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self._get_from_header()
            msg['To'] = to_email
            msg['Message-ID'] = make_msgid(domain=self.from_email.split('@')[1])

            # Build login link text for plain version
            login_text = f"\n\nClick here to login directly: {login_link}\n(This link expires in 7 days)" if login_link else ""

            # Create HTML and plain text versions
            text_content = f"""
Hello {name},

{message}
{login_text}

Best regards,
The ConfAI Team
            """

            # Build logo HTML (use CID if logo available)
            logo_html = '<img src="cid:logo" alt="ConfAI" style="max-height: 50px; margin: 0;">' if self.logo_data else '<h1 style="color: white; margin: 0;">ConfAI</h1>'

            # Convert newlines and basic markdown to HTML
            import re
            html_message = message
            # Bold: **text** or *text*
            html_message = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html_message)
            html_message = re.sub(r'\*(.+?)\*', r'<strong>\1</strong>', html_message)
            # Italic: _text_
            html_message = re.sub(r'_(.+?)_', r'<em>\1</em>', html_message)
            # Newlines to <br>
            html_message = html_message.replace('\n', '<br>')

            # Build login button HTML
            login_button_html = ""
            if login_link:
                login_button_html = f"""
      <div style="margin-top: 24px; text-align: center;">
        <a href="{login_link}" style="display: inline-block; background: #E20074; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Open ConfAI</a>
        <p style="color: #999; font-size: 12px; margin-top: 12px;">This link expires in 7 days</p>
      </div>
"""

            html_content = f"""
<html>
  <head>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <style>
      .email-header {{
        background-color: #1a1a1a !important;
        background: linear-gradient(to bottom, #1a1a1a, #2a2a2a) !important;
      }}
    </style>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div class="email-header" style="overflow: hidden; background: linear-gradient(to bottom, #1a1a1a, #2a2a2a); padding: 30px 20px 20px 30px; border-radius: 10px 10px 0 0; text-align: left;">
      <img src="cid:bggrad" alt="" style="height: 1px; opacity: 0.1;">
      {logo_html}
    </div>
    <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 10px 10px;">
      <h2 style="color: #333;">{subject}</h2>
      <p style="color: #666; font-size: 16px;">Hello {name},</p>
      <div style="color: #666; font-size: 16px; line-height: 1.6;">
        {html_message}
      </div>
      {login_button_html}
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

            # Attach background gradient image
            if self.bg_gradient_data:
                bg_img = MIMEImage(self.bg_gradient_data, 'jpeg')
                bg_img.add_header('Content-ID', '<bggrad>')
                bg_img.add_header('Content-Disposition', 'inline', filename='bggrad.jpg')
                msg.attach(bg_img)

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

            print(f"Reminder email sent to {to_email}")
            return True

        except Exception as e:
            print(f"Error sending reminder email: {str(e)}")
            return False


# Singleton instance
email_service = EmailService()
