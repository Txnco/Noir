"""
Email Service Implementation
Supports SMTP and Amazon SES (both API and SMTP).
"""
import asyncio
import smtplib
import ssl
from abc import ABC, abstractmethod
from dataclasses import dataclass
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Literal

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("jetapi.email")


@dataclass
class EmailMessage:
    """Email message structure."""
    to: str | list[str]
    subject: str
    body_html: str
    body_text: Optional[str] = None
    reply_to: Optional[str] = None
    cc: Optional[list[str]] = None
    bcc: Optional[list[str]] = None


class EmailProvider(ABC):
    """Abstract base class for email providers."""
    
    @abstractmethod
    async def send(self, message: EmailMessage, from_email: str) -> bool:
        """Send an email. Returns True on success."""
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is properly configured."""
        pass


class SMTPProvider(EmailProvider):
    """SMTP email provider (works with any SMTP server including SES SMTP)."""
    
    def __init__(
        self,
        host: str,
        port: int,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: bool = True,
        use_ssl: bool = False,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.use_ssl = use_ssl
    
    def is_configured(self) -> bool:
        return bool(self.host)
    
    async def send(self, message: EmailMessage, from_email: str) -> bool:
        """Send email via SMTP."""
        try:
            # Run SMTP operations in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                self._send_sync,
                message,
                from_email,
            )
        except Exception as e:
            logger.error(f"SMTP send failed: {e}")
            return False
    
    def _send_sync(self, message: EmailMessage, from_email: str) -> bool:
        """Synchronous SMTP send."""
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = message.subject
            msg["From"] = from_email
            
            # Handle multiple recipients
            to_list = message.to if isinstance(message.to, list) else [message.to]
            msg["To"] = ", ".join(to_list)
            
            if message.cc:
                msg["Cc"] = ", ".join(message.cc)
            if message.reply_to:
                msg["Reply-To"] = message.reply_to
            
            # Attach text and HTML parts
            if message.body_text:
                msg.attach(MIMEText(message.body_text, "plain", "utf-8"))
            msg.attach(MIMEText(message.body_html, "html", "utf-8"))
            
            # Calculate all recipients
            all_recipients = to_list.copy()
            if message.cc:
                all_recipients.extend(message.cc)
            if message.bcc:
                all_recipients.extend(message.bcc)
            
            # Connect and send
            if self.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(self.host, self.port, context=context)
            else:
                server = smtplib.SMTP(self.host, self.port)
                if self.use_tls:
                    server.starttls()
            
            try:
                if self.username and self.password:
                    server.login(self.username, self.password)
                
                server.sendmail(from_email, all_recipients, msg.as_string())
                logger.info(f"Email sent via SMTP to {to_list}")
                return True
                
            finally:
                server.quit()
                
        except Exception as e:
            logger.error(f"SMTP error: {e}")
            raise


class AWSSESProvider(EmailProvider):
    """Amazon SES API provider using boto3."""
    
    def __init__(
        self,
        region: str = "us-east-1",
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        configuration_set: Optional[str] = None,
    ):
        self.region = region
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.configuration_set = configuration_set
        self._client = None
    
    def is_configured(self) -> bool:
        """Check if AWS SES is configured."""
        # SES can use environment credentials or IAM role
        return bool(self.region)
    
    def _get_client(self):
        """Get or create boto3 SES client."""
        if self._client is None:
            try:
                import boto3
                
                if self.access_key_id and self.secret_access_key:
                    self._client = boto3.client(
                        "ses",
                        region_name=self.region,
                        aws_access_key_id=self.access_key_id,
                        aws_secret_access_key=self.secret_access_key,
                    )
                else:
                    # Use default credentials (IAM role, env vars, etc.)
                    self._client = boto3.client("ses", region_name=self.region)
                    
            except ImportError:
                logger.error("boto3 not installed. Install with: pip install boto3")
                raise RuntimeError("boto3 required for AWS SES")
        
        return self._client
    
    async def send(self, message: EmailMessage, from_email: str) -> bool:
        """Send email via AWS SES API."""
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                self._send_sync,
                message,
                from_email,
            )
        except Exception as e:
            logger.error(f"SES send failed: {e}")
            return False
    
    def _send_sync(self, message: EmailMessage, from_email: str) -> bool:
        """Synchronous SES send."""
        try:
            client = self._get_client()
            
            # Build destination
            to_list = message.to if isinstance(message.to, list) else [message.to]
            destination = {"ToAddresses": to_list}
            
            if message.cc:
                destination["CcAddresses"] = message.cc
            if message.bcc:
                destination["BccAddresses"] = message.bcc
            
            # Build message body
            body = {"Html": {"Data": message.body_html, "Charset": "UTF-8"}}
            if message.body_text:
                body["Text"] = {"Data": message.body_text, "Charset": "UTF-8"}
            
            # Build email
            email_params = {
                "Source": from_email,
                "Destination": destination,
                "Message": {
                    "Subject": {"Data": message.subject, "Charset": "UTF-8"},
                    "Body": body,
                },
            }
            
            if message.reply_to:
                email_params["ReplyToAddresses"] = [message.reply_to]
            
            if self.configuration_set:
                email_params["ConfigurationSetName"] = self.configuration_set
            
            # Send
            response = client.send_email(**email_params)
            message_id = response.get("MessageId")
            
            logger.info(f"Email sent via SES to {to_list}, MessageId: {message_id}")
            return True
            
        except Exception as e:
            logger.error(f"SES error: {e}")
            raise


class EmailService:
    """
    Unified email service that supports multiple providers.
    
    Priority:
    1. AWS SES API (if configured)
    2. SMTP (if configured)
    3. Debug mode (logs to console)
    """
    
    def __init__(self):
        self.providers: list[EmailProvider] = []
        self.from_email: Optional[str] = None
        self._configure()
    
    def _configure(self):
        """Configure email providers based on settings."""
        self.from_email = settings.EMAIL_FROM
        
        # Add AWS SES provider if configured
        if settings.AWS_SES_ENABLED:
            ses_provider = AWSSESProvider(
                region=settings.AWS_SES_REGION,
                access_key_id=settings.AWS_ACCESS_KEY_ID,
                secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                configuration_set=settings.AWS_SES_CONFIGURATION_SET,
            )
            if ses_provider.is_configured():
                self.providers.append(ses_provider)
                logger.info("AWS SES provider configured")
        
        # Add SMTP provider if configured
        if settings.SMTP_HOST:
            smtp_provider = SMTPProvider(
                host=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                use_tls=settings.SMTP_TLS,
                use_ssl=settings.SMTP_SSL,
            )
            if smtp_provider.is_configured():
                self.providers.append(smtp_provider)
                logger.info("SMTP provider configured")
        
        if not self.providers:
            logger.warning("No email provider configured - emails will only be logged in DEBUG mode")
    
    def is_configured(self) -> bool:
        """Check if at least one provider is available."""
        return len(self.providers) > 0
    
    async def send(
        self,
        to: str | list[str],
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_email: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
    ) -> bool:
        """
        Send an email using the first available provider.
        
        Args:
            to: Recipient email(s)
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text body (optional)
            from_email: Sender email (defaults to configured EMAIL_FROM)
            reply_to: Reply-to address
            cc: CC recipients
            bcc: BCC recipients
        
        Returns:
            True if email was sent successfully
        """
        sender = from_email or self.from_email
        
        if not sender:
            logger.error("No sender email configured (EMAIL_FROM)")
            return False
        
        message = EmailMessage(
            to=to,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            reply_to=reply_to,
            cc=cc,
            bcc=bcc,
        )
        
        # Try providers in order
        for provider in self.providers:
            try:
                if await provider.send(message, sender):
                    return True
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} failed: {e}")
                continue
        
        # No provider available or all failed
        if settings.DEBUG:
            to_list = to if isinstance(to, list) else [to]
            logger.warning(
                f"[DEBUG MODE] Email not sent (no provider):\n"
                f"  To: {to_list}\n"
                f"  Subject: {subject}\n"
                f"  Body: {body_text or body_html[:200]}..."
            )
            return True  # Return True in debug to not break flow
        
        logger.error(f"Failed to send email to {to}: no working provider")
        return False


# Global email service instance
email_service = EmailService()


# =============================================================================
# Convenience Functions
# =============================================================================
async def send_email(
    to: str | list[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    **kwargs,
) -> bool:
    """Send an email using the global email service."""
    return await email_service.send(
        to=to,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        **kwargs,
    )


async def send_password_reset_email(email: str, token: str, user_name: str = "User") -> bool:
    """Send password reset email."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{ 
                display: inline-block; 
                background-color: #007bff; 
                color: white !important; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px;
                margin: 20px 0;
            }}
            .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Password Reset Request</h2>
            <p>Hello {user_name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="{reset_url}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            <div class="footer">
                <p>This is an automated message from {settings.PROJECT_NAME}.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text = f"""
    Password Reset Request
    
    Hello {user_name},
    
    We received a request to reset your password. Click the link below to create a new password:
    
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
    
    - {settings.PROJECT_NAME}
    """
    
    return await email_service.send(
        to=email,
        subject=f"Password Reset - {settings.PROJECT_NAME}",
        body_html=html,
        body_text=text,
    )


async def send_verification_email(email: str, token: str, user_name: str = "User") -> bool:
    """Send email verification email."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{ 
                display: inline-block; 
                background-color: #28a745; 
                color: white !important; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px;
                margin: 20px 0;
            }}
            .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Verify Your Email Address</h2>
            <p>Hello {user_name},</p>
            <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
            <a href="{verify_url}" class="button">Verify Email</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="{verify_url}">{verify_url}</a></p>
            <div class="footer">
                <p>This is an automated message from {settings.PROJECT_NAME}.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text = f"""
    Verify Your Email Address
    
    Hello {user_name},
    
    Thank you for registering! Please verify your email address by clicking the link below:
    
    {verify_url}
    
    - {settings.PROJECT_NAME}
    """
    
    return await email_service.send(
        to=email,
        subject=f"Verify Your Email - {settings.PROJECT_NAME}",
        body_html=html,
        body_text=text,
    )


async def send_welcome_email(email: str, user_name: str = "User") -> bool:
    """Send welcome email to new user."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .button {{ 
                display: inline-block; 
                background-color: #007bff; 
                color: white !important; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px;
                margin: 20px 0;
            }}
            .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Welcome to {settings.PROJECT_NAME}!</h2>
            <p>Hello {user_name},</p>
            <p>Thank you for joining us! Your account has been created successfully.</p>
            <p>You can now log in and start using our services.</p>
            <a href="{settings.FRONTEND_URL}/login" class="button">Log In</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <div class="footer">
                <p>This is an automated message from {settings.PROJECT_NAME}.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text = f"""
    Welcome to {settings.PROJECT_NAME}!
    
    Hello {user_name},
    
    Thank you for joining us! Your account has been created successfully.
    
    You can now log in at: {settings.FRONTEND_URL}/login
    
    - {settings.PROJECT_NAME}
    """
    
    return await email_service.send(
        to=email,
        subject=f"Welcome to {settings.PROJECT_NAME}!",
        body_html=html,
        body_text=text,
    )
