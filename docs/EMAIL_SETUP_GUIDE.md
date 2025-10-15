# Email Setup Guide for OTP System

## Overview
The OTP system supports multiple email providers. Choose one that works best for you:

## Option 1: Console Mode (Default - No Setup Required)
**Best for: Development and testing**

No configuration needed! The system will log emails to the console instead of sending them.

```bash
# No environment variables needed
# OTP codes will be displayed in the server console
```

## Option 2: SendGrid (Recommended)
**Best for: Production use, reliable delivery**

1. **Sign up for SendGrid**: https://sendgrid.com/
2. **Get API Key**: Go to Settings > API Keys > Create API Key
3. **Add to config.env**:
```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
APP_NAME=AI Agent
```

## Option 3: Mailgun
**Best for: High volume, advanced features**

1. **Sign up for Mailgun**: https://www.mailgun.com/
2. **Get API Key and Domain**: From your Mailgun dashboard
3. **Add to config.env**:
```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=your_mailgun_domain.com
APP_NAME=AI Agent
```

## Option 4: Resend
**Best for: Modern API, developer-friendly**

1. **Sign up for Resend**: https://resend.com/
2. **Get API Key**: From your Resend dashboard
3. **Add to config.env**:
```env
RESEND_API_KEY=your_resend_api_key_here
RESEND_DOMAIN=yourdomain.com
APP_NAME=AI Agent
```

## Option 5: Gmail SMTP (Original)
**Best for: Small scale, using existing Gmail account**

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**: Google Account > Security > App passwords
3. **Add to config.env**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
APP_NAME=AI Agent
```

## Testing Your Email Setup

### 1. Test the Email Service
```bash
cd backend
node -e "
const EmailService = require('./services/SimpleEmailService');
EmailService.sendOTPEmail('test@example.com', '123456', 'Test User')
  .then(result => console.log('Test result:', result))
  .catch(err => console.error('Test failed:', err));
"
```

### 2. Test Registration Flow
```bash
# Start your server
npm start

# In another terminal, test registration
curl -X POST http://localhost:5001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "+1234567890"
  }'
```

## Switching Email Services

The system automatically detects which email service to use based on environment variables:

1. **SendGrid**: If `SENDGRID_API_KEY` is set
2. **Mailgun**: If `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are set
3. **Resend**: If `RESEND_API_KEY` is set
4. **Console**: If none of the above are configured

## Troubleshooting

### Console Mode Issues
- **Problem**: Not seeing OTP codes in console
- **Solution**: Check server logs, OTP should be displayed there

### SendGrid Issues
- **Problem**: "Unauthorized" error
- **Solution**: Verify API key is correct and has send permissions

### Mailgun Issues
- **Problem**: Domain verification failed
- **Solution**: Verify domain in Mailgun dashboard first

### Gmail SMTP Issues
- **Problem**: "Invalid credentials" error
- **Solution**: Use App Password, not regular password

## Production Recommendations

1. **Use SendGrid or Mailgun** for production
2. **Set up proper domain authentication** (SPF, DKIM records)
3. **Monitor email delivery rates**
4. **Set up bounce/complaint handling**
5. **Use environment-specific configurations**

## Environment Variables Summary

Add ONE of these configurations to your `backend/config/config.env`:

```env
# Option 1: Console Mode (Default)
# No variables needed

# Option 2: SendGrid
SENDGRID_API_KEY=your_key_here
FROM_EMAIL=noreply@yourdomain.com

# Option 3: Mailgun
MAILGUN_API_KEY=your_key_here
MAILGUN_DOMAIN=yourdomain.com

# Option 4: Resend
RESEND_API_KEY=your_key_here
RESEND_DOMAIN=yourdomain.com

# Option 5: Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Common (Optional)
APP_NAME=AI Agent
```

## Current Status

✅ **Console Mode**: Ready to use (default)
⚠️ **Other Providers**: Require API key configuration

The system will work immediately in console mode for development and testing!
