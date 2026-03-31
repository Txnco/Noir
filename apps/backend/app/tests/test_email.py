"""
Email Service Tests
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.email.service import (
    EmailMessage,
    SMTPProvider,
    AWSSESProvider,
    EmailService,
    send_password_reset_email,
    send_verification_email,
)


class TestEmailMessage:
    def test_create_email_message(self):
        msg = EmailMessage(
            to="test@example.com",
            subject="Test Subject",
            body_html="<p>Hello</p>",
            body_text="Hello",
        )
        assert msg.to == "test@example.com"
        assert msg.subject == "Test Subject"
        assert msg.body_html == "<p>Hello</p>"
        assert msg.body_text == "Hello"
    
    def test_create_email_message_multiple_recipients(self):
        msg = EmailMessage(
            to=["user1@example.com", "user2@example.com"],
            subject="Test",
            body_html="<p>Test</p>",
        )
        assert len(msg.to) == 2


class TestSMTPProvider:
    def test_is_configured_with_host(self):
        provider = SMTPProvider(host="smtp.example.com", port=587)
        assert provider.is_configured() is True
    
    def test_is_configured_without_host(self):
        provider = SMTPProvider(host="", port=587)
        assert provider.is_configured() is False


class TestAWSSESProvider:
    def test_is_configured_with_region(self):
        provider = AWSSESProvider(region="us-east-1")
        assert provider.is_configured() is True
    
    @patch("app.core.email.service.AWSSESProvider._get_client")
    def test_send_email(self, mock_get_client):
        # Mock boto3 client
        mock_client = MagicMock()
        mock_client.send_email.return_value = {"MessageId": "test-id"}
        mock_get_client.return_value = mock_client
        
        provider = AWSSESProvider(region="us-east-1")
        message = EmailMessage(
            to="test@example.com",
            subject="Test",
            body_html="<p>Test</p>",
        )
        
        # Test sync send
        result = provider._send_sync(message, "sender@example.com")
        assert result is True


class TestEmailService:
    @patch.object(EmailService, "_configure")
    def test_service_initialization(self, mock_configure):
        service = EmailService()
        mock_configure.assert_called_once()


@pytest.mark.asyncio
async def test_send_password_reset_email():
    """Test password reset email generation."""
    with patch("app.core.email.service.email_service") as mock_service:
        mock_service.send = AsyncMock(return_value=True)
        
        result = await send_password_reset_email(
            email="user@example.com",
            token="test-token",
            user_name="Test User",
        )
        
        # Verify send was called
        mock_service.send.assert_called_once()
        call_args = mock_service.send.call_args
        
        assert call_args.kwargs["to"] == "user@example.com"
        assert "Password Reset" in call_args.kwargs["subject"]
        assert "test-token" in call_args.kwargs["body_html"]


@pytest.mark.asyncio
async def test_send_verification_email():
    """Test verification email generation."""
    with patch("app.core.email.service.email_service") as mock_service:
        mock_service.send = AsyncMock(return_value=True)
        
        result = await send_verification_email(
            email="user@example.com",
            token="verify-token",
            user_name="Test User",
        )
        
        mock_service.send.assert_called_once()
        call_args = mock_service.send.call_args
        
        assert call_args.kwargs["to"] == "user@example.com"
        assert "Verify" in call_args.kwargs["subject"]
