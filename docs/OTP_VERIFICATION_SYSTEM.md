# OTP Email Verification System

## Overview
This system implements email verification using OTP (One-Time Password) for user registration. When users register, they receive a 6-digit OTP via email that expires in 10 minutes.

## Features
- ✅ User registration with email verification
- ✅ 6-digit OTP generation
- ✅ Email sending with HTML template
- ✅ OTP expiry (10 minutes)
- ✅ Rate limiting (max 5 OTPs per hour per email)
- ✅ User role assignment during registration
- ✅ Email verification status tracking
- ✅ OTP resend functionality
- ✅ Login restriction for unverified emails

## Database Schema

### New Table: `email_verification_otps`
```sql
CREATE TABLE email_verification_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_otp_code (otp_code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_email_otp (email, otp_code)
);
```

### Updated Table: `users`
```sql
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verified_at DATETIME NULL;
```

## API Endpoints

### 1. Register User
**POST** `/api/users/register`

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "role_id": 1
}
```

**Response:**
```json
{
  "message": "User registered successfully. Please check your email for OTP verification.",
  "userId": 123,
  "email_sent": true
}
```

### 2. Verify OTP
**POST** `/api/users/verify-otp`

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp_code": "123456"
}
```

**Response:**
```json
{
  "message": "Email verified successfully. You can now login."
}
```

### 3. Resend OTP
**POST** `/api/users/resend-otp`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully. Please check your email.",
  "email_sent": true
}
```

### 4. Login (Updated)
**POST** `/api/users/login`

Now checks email verification status before allowing login.

**Response for unverified email:**
```json
{
  "message": "Please verify your email before logging in. Check your email for OTP.",
  "email_verified": false
}
```

## Environment Configuration

Add these variables to your `.env` file:

```env
# Email Configuration for OTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
APP_NAME=AI Agent
```

## File Structure

```
backend/
├── services/
│   └── EmailService.js          # Email service with nodemailer
├── model/
│   └── otpModel/
│       └── otpModel.js          # OTP database operations
├── controller/
│   └── userController/
│       └── userController.js    # Updated with OTP methods
├── database/
│   └── migrations/
│       └── create_email_verification_otps_table.sql
└── scripts/
    ├── test_otp_system.js       # Test script
    └── cleanup_expired_otps.js  # Cleanup script
```

## Security Features

1. **Rate Limiting**: Maximum 5 OTP requests per hour per email
2. **OTP Expiry**: OTPs expire after 10 minutes
3. **One-time Use**: OTPs are marked as used after verification
4. **Email Verification Required**: Users cannot login without email verification

## Usage Flow

1. User registers → User created in database (unverified)
2. System generates 6-digit OTP → Stored in database with 10-minute expiry
3. OTP sent via email → HTML template with styling
4. User enters OTP → System verifies and marks email as verified
5. User can now login → System checks verification status

## Maintenance

Run the cleanup script periodically to remove expired OTPs:
```bash
node scripts/cleanup_expired_otps.js
```

## Testing

Test the system:
```bash
node scripts/test_otp_system.js
```

## Dependencies Added

- `nodemailer`: For sending emails

## Error Handling

- Invalid/expired OTP: Returns 400 error
- Rate limiting exceeded: Returns 429 error
- Email sending failure: Returns 500 error
- Unverified email login attempt: Returns 403 error
