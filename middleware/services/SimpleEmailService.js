// Simple Email Service - Alternative to SMTP
// This service can use various email APIs like SendGrid, Mailgun, etc.
const axios = require("axios");
require("dotenv").config({ path: "./config/config.env" });

class SimpleEmailService {
  constructor() {
    // Check which email service is configured
    this.emailProvider = this.detectEmailProvider();
    console.log(`📧 Email provider: ${this.emailProvider}`);
  }

  detectEmailProvider() {
    if (process.env.SENDGRID_API_KEY) {
      return 'sendgrid';
    } else if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      return 'mailgun';
    } else if (process.env.RESEND_API_KEY) {
      return 'resend';
    } else {
      return 'console'; // Fallback to console logging
    }
  }

  async sendOTPEmail(email, otp, firstName = "") {
    try {
      switch (this.emailProvider) {
        case 'sendgrid':
          return await this.sendWithSendGrid(email, otp, firstName);
        case 'mailgun':
          return await this.sendWithMailgun(email, otp, firstName);
        case 'resend':
          return await this.sendWithResend(email, otp, firstName);
        default:
          return this.logToConsole(email, otp, firstName);
      }
    } catch (error) {
      console.error("❌ Error sending OTP email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendWithSendGrid(email, otp, firstName) {
    const data = {
      personalizations: [{
        to: [{ email: email, name: firstName }],
        subject: "Email Verification - OTP Code"
      }],
      from: {
        email: process.env.FROM_EMAIL || "noreply@aiagent.com",
        name: process.env.APP_NAME || "AI Agent"
      },
      content: [{
        type: "text/html",
        value: this.getOTPEmailTemplate(otp, firstName)
      }]
    };

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', data, {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ OTP email sent via SendGrid");
    return { success: true, messageId: response.headers['x-message-id'] };
  }

  async sendWithMailgun(email, otp, firstName) {
    const formData = new URLSearchParams();
    formData.append('from', `${process.env.APP_NAME || 'AI Agent'} <noreply@${process.env.MAILGUN_DOMAIN}>`);
    formData.append('to', email);
    formData.append('subject', 'Email Verification - OTP Code');
    formData.append('html', this.getOTPEmailTemplate(otp, firstName));

    const response = await axios.post(
      `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
      formData,
      {
        auth: {
          username: 'api',
          password: process.env.MAILGUN_API_KEY
        }
      }
    );

    console.log("✅ OTP email sent via Mailgun");
    return { success: true, messageId: response.data.id };
  }

  async sendWithResend(email, otp, firstName) {
    const data = {
      from: `${process.env.APP_NAME || 'AI Agent'} <noreply@${process.env.RESEND_DOMAIN || 'aiagent.com'}>`,
      to: [email],
      subject: "Email Verification - OTP Code",
      html: this.getOTPEmailTemplate(otp, firstName)
    };

    const response = await axios.post('https://api.resend.com/emails', data, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ OTP email sent via Resend");
    return { success: true, messageId: response.data.id };
  }

  logToConsole(email, otp, firstName) {
    console.log("\n📧 EMAIL WOULD BE SENT (CONSOLE MODE):");
    console.log("=".repeat(60));
    console.log(`To: ${email}`);
    console.log(`Name: ${firstName}`);
    console.log(`Subject: Email Verification - OTP Code`);
    console.log(`OTP Code: ${otp}`);
    console.log("=".repeat(60));
    console.log("✅ Email logged to console successfully");
    console.log("💡 To send real emails, configure one of these:");
    console.log("   - SENDGRID_API_KEY for SendGrid");
    console.log("   - MAILGUN_API_KEY + MAILGUN_DOMAIN for Mailgun");
    console.log("   - RESEND_API_KEY for Resend");
    console.log("=".repeat(60));
    
    return { success: true, messageId: "console-mode-" + Date.now(), testMode: true };
  }

  getOTPEmailTemplate(otp, firstName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: #f9f9f9; padding: 30px; border-radius: 10px; border: 1px solid #ddd; }
          .header { text-align: center; margin-bottom: 30px; }
          .otp-code { background: #007bff; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
            <p>Hello ${firstName ? firstName : 'there'},</p>
          </div>
          <p>Thank you for registering with ${process.env.APP_NAME || 'AI Agent'}. To complete your registration, please verify your email address using the OTP code below:</p>
          <div class="otp-code">${otp}</div>
          <div class="warning">
            <strong>Important:</strong> This OTP code will expire in 10 minutes. Please use it immediately to verify your email address.
          </div>
          <p>If you didn't request this verification, please ignore this email.</p>
          <div class="footer">
            <p>Best regards,<br>${process.env.APP_NAME || 'AI Agent'} Team</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new SimpleEmailService();
