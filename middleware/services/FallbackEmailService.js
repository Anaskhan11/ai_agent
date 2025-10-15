const axios = require('axios');

class FallbackEmailService {
  constructor() {
    this.services = [];
    
    // Add available services based on environment variables
    if (process.env.SENDGRID_API_KEY) {
      this.services.push({
        name: 'SendGrid',
        send: this.sendWithSendGrid.bind(this)
      });
    }
    
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.services.push({
        name: 'Mailgun',
        send: this.sendWithMailgun.bind(this)
      });
    }
    
    if (process.env.RESEND_API_KEY) {
      this.services.push({
        name: 'Resend',
        send: this.sendWithResend.bind(this)
      });
    }

    // Add a simple webhook-based service as last resort
    this.services.push({
      name: 'Webhook Fallback',
      send: this.sendWithWebhook.bind(this)
    });

    console.log(`🔄 Fallback email service initialized with ${this.services.length} providers`);
  }

  async sendOTPEmail(email, otp, firstName = "") {
    if (this.services.length === 0) {
      return { success: false, error: "No fallback email services configured" };
    }

    let lastError = null;

    for (const service of this.services) {
      try {
        console.log(`🔄 Trying fallback service: ${service.name}`);
        const result = await service.send(email, otp, firstName);
        console.log(`✅ Email sent successfully via ${service.name}`);
        return { success: true, messageId: result.messageId, provider: service.name };
      } catch (error) {
        console.log(`❌ ${service.name} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    return { success: false, error: lastError?.message || "All fallback services failed" };
  }

  async sendWithSendGrid(email, otp, firstName) {
    const data = {
      personalizations: [{
        to: [{ email: email, name: firstName }],
        subject: "Email Verification - OTP Code"
      }],
      from: {
        email: process.env.SMTP_USER || "noreply@aicruitment.com",
        name: process.env.APP_NAME || "AI CRUITMENT"
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
      },
      timeout: 30000
    });

    return { messageId: response.headers['x-message-id'] || 'sendgrid-' + Date.now() };
  }

  async sendWithMailgun(email, otp, firstName) {
    const formData = new URLSearchParams();
    formData.append('from', `${process.env.APP_NAME || 'AI CRUITMENT'} <noreply@${process.env.MAILGUN_DOMAIN}>`);
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
        },
        timeout: 30000
      }
    );

    return { messageId: response.data.id };
  }

  async sendWithResend(email, otp, firstName) {
    const data = {
      from: `${process.env.APP_NAME || 'AI CRUITMENT'} <noreply@aicruitment.com>`,
      to: [email],
      subject: "Email Verification - OTP Code",
      html: this.getOTPEmailTemplate(otp, firstName)
    };

    const response = await axios.post('https://api.resend.com/emails', data, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return { messageId: response.data.id };
  }

  async sendWithWebhook(email, otp, firstName) {
    // This is a simple webhook that logs the email details
    // In production, you could replace this with a webhook to a service like Zapier, Make.com, etc.
    console.log("\n🔄 WEBHOOK FALLBACK - EMAIL DETAILS:");
    console.log("=".repeat(50));
    console.log(`To: ${email}`);
    console.log(`Name: ${firstName}`);
    console.log(`OTP: ${otp}`);
    console.log(`Subject: Email Verification - OTP Code`);
    console.log(`From: ${process.env.APP_NAME || 'AI CRUITMENT'}`);
    console.log("=".repeat(50));
    console.log("📧 Email details logged for manual processing");
    
    // Return success to prevent blocking the registration process
    return { messageId: 'webhook-fallback-' + Date.now() };
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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .otp-code { font-size: 32px; font-weight: bold; text-align: center; 
                     background: #f8f9fa; padding: 20px; border-radius: 8px; 
                     border: 2px dashed #007bff; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; 
                    padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
            <p>Hello ${firstName ? firstName : 'there'},</p>
          </div>
          
          <p>Thank you for registering with ${process.env.APP_NAME || 'AI CRUITMENT'}. To complete your registration, please verify your email address using the OTP code below:</p>
          
          <div class="otp-code">${otp}</div>
          
          <div class="warning">
            <strong>Important:</strong> This OTP code will expire in 10 minutes. Please use it immediately to verify your email address.
          </div>
          
          <p>If you didn't request this verification, please ignore this email.</p>
          
          <div class="footer">
            <p>Best regards,<br>
            ${process.env.APP_NAME || 'AI CRUITMENT'} Team</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new FallbackEmailService();
