const nodemailer = require("nodemailer");
const FallbackEmailService = require("./FallbackEmailService");
require("dotenv").config({ path: "./config/config.env" });

class EmailService {
  constructor() {
    // Check if email configuration is provided
    const hasEmailConfig = process.env.SMTP_USER &&
                          process.env.SMTP_PASS &&
                          process.env.SMTP_USER !== 'your_email@gmail.com';

    if (hasEmailConfig) {
      // Create multiple transporter configurations for fallback
      this.transporters = this.createTransporters();
      this.isConfigured = true;
      console.log(`📧 Email service configured with ${this.transporters.length} fallback options`);
    } else {
      // Test configuration for development (logs to console instead of sending)
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      });
      this.isConfigured = false;
      console.log("⚠️  Email service running in TEST MODE - emails will be logged to console");
      console.log("⚠️  To enable real emails, configure SMTP_USER and SMTP_PASS in config.env");
    }
  }

  createTransporters() {
    const host = process.env.SMTP_HOST || "smtp.hostinger.com";

    const baseConfig = {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    };

    // Multiple configurations to try in order
    const configs = [
      {
        name: "Hostinger SSL (Port 465)",
        config: {
          ...baseConfig,
          host: host,
          port: 465,
          secure: true,
          connectionTimeout: 30000,
          greetingTimeout: 15000,
          socketTimeout: 30000
        }
      },
      {
        name: "Hostinger STARTTLS (Port 587)",
        config: {
          ...baseConfig,
          host: host,
          port: 587,
          secure: false,
          connectionTimeout: 30000,
          greetingTimeout: 15000,
          socketTimeout: 30000
        }
      },
      {
        name: "Hostinger Alternative (Port 25)",
        config: {
          ...baseConfig,
          host: host,
          port: 25,
          secure: false,
          ignoreTLS: true,
          connectionTimeout: 20000,
          greetingTimeout: 10000,
          socketTimeout: 20000
        }
      }
    ];

    return configs.map(({ name, config }) => ({
      name,
      transporter: nodemailer.createTransport(config)
    }));
  }

  async sendOTPEmail(email, otp, firstName = "") {
    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'AI Agent'}" <${process.env.SMTP_USER || 'noreply@aiagent.com'}>`,
        to: email,
        subject: "Email Verification - OTP Code",
        html: this.getOTPEmailTemplate(otp, firstName),
      };

      if (!this.isConfigured) {
        // Test mode - log email content instead of sending
        console.log("\n📧 EMAIL WOULD BE SENT:");
        console.log("=".repeat(50));
        console.log(`To: ${email}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`OTP Code: ${otp}`);
        console.log("=".repeat(50));
        console.log("✅ Email logged successfully (TEST MODE)");
        return { success: true, messageId: "test-mode-" + Date.now(), testMode: true };
      }

      // Try each transporter configuration until one works
      let lastError = null;

      for (const { name, transporter } of this.transporters) {
        try {
          console.log(`📧 Attempting to send email via: ${name}`);
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ OTP email sent successfully via ${name}:`, info.messageId);
          return { success: true, messageId: info.messageId, provider: name };
        } catch (error) {
          console.log(`❌ Failed to send via ${name}:`, error.message);
          lastError = error;
          continue; // Try next transporter
        }
      }

      // If all SMTP transporters failed, try fallback services
      console.log("🔄 All SMTP providers failed, trying fallback services...");
      try {
        const fallbackResult = await FallbackEmailService.sendOTPEmail(email, otp, firstName);
        if (fallbackResult.success) {
          console.log(`✅ Email sent via fallback service: ${fallbackResult.provider}`);
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.log("❌ Fallback services also failed:", fallbackError.message);
      }

      // If everything failed, return the last error
      console.error("❌ All email providers and fallback services failed. Last error:", lastError);
      return { success: false, error: lastError.message };

    } catch (error) {
      console.error("❌ Error in sendOTPEmail:", error);
      return { success: false, error: error.message };
    }
  }

  // Send custom email (for webhook notifications)
  async sendCustomEmail(to, subject, htmlBody, fromName = null) {
    try {
      const mailOptions = {
        from: `"${fromName || process.env.APP_NAME || 'AI CRUITMENT'}" <${process.env.SMTP_USER || 'noreply@aicruitment.com'}>`,
        to: to,
        subject: subject,
        html: htmlBody,
      };

      if (!this.isConfigured) {
        // Test mode - log email content instead of sending
        console.log("\n📧 CUSTOM EMAIL WOULD BE SENT:");
        console.log("=".repeat(50));
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`From: ${mailOptions.from}`);
        console.log("=".repeat(50));
        console.log("✅ Custom email logged successfully (TEST MODE)");
        return { success: true, messageId: "test-mode-" + Date.now(), testMode: true };
      }

      // Try each transporter configuration until one works
      let lastError = null;

      for (const { name, transporter } of this.transporters) {
        try {
          console.log(`📧 Attempting to send custom email via: ${name}`);
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ Custom email sent successfully via ${name}:`, info.messageId);
          return { success: true, messageId: info.messageId, provider: name };
        } catch (error) {
          console.log(`❌ Failed to send via ${name}:`, error.message);
          lastError = error;
          continue; // Try next transporter
        }
      }

      // If all SMTP transporters failed, try fallback services
      console.log("🔄 All SMTP providers failed, trying fallback services...");
      try {
        const fallbackResult = await FallbackEmailService.sendCustomEmail(to, subject, htmlBody, fromName);
        if (fallbackResult && fallbackResult.success) {
          console.log(`✅ Custom email sent via fallback service: ${fallbackResult.provider}`);
          return fallbackResult;
        }
      } catch (fallbackError) {
        console.log("❌ Fallback services also failed:", fallbackError.message);
      }

      // If everything failed, return the last error
      console.error("❌ All email providers and fallback services failed. Last error:", lastError);
      return { success: false, error: lastError?.message || "Failed to send custom email - no providers available" };

    } catch (error) {
      console.error("❌ Error in sendCustomEmail:", error);
      return { success: false, error: error.message };
    }
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
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 10px;
            border: 1px solid #ddd;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .otp-code {
            background: #007bff;
            color: white;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            letter-spacing: 5px;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
            <p>Hello ${firstName ? firstName : 'there'},</p>
          </div>
          
          <p>Thank you for registering with ${process.env.APP_NAME }. To complete your registration, please verify your email address using the OTP code below:</p>
          
          <div class="otp-code">
            ${otp}
          </div>
          
          <div class="warning">
            <strong>Important:</strong> This OTP code will expire in 10 minutes. Please use it immediately to verify your email address.
          </div>
          
          <p>If you didn't request this verification, please ignore this email.</p>
          
          <div class="footer">
            <p>Best regards,<br>
            ${process.env.APP_NAME } Team</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async testConnection() {
    try {
      if (!this.isConfigured) {
        console.log("📧 Email service in TEST MODE - connection test skipped");
        return true;
      }

      // Test each transporter
      let workingCount = 0;
      for (const { name, transporter } of this.transporters) {
        try {
          await transporter.verify();
          console.log(`✅ ${name} connection successful`);
          workingCount++;
        } catch (error) {
          console.log(`❌ ${name} connection failed:`, error.message);
        }
      }

      if (workingCount > 0) {
        console.log(`✅ Email service ready with ${workingCount}/${this.transporters.length} working providers`);
        return true;
      } else {
        console.log("❌ No email providers are working");
        return false;
      }
    } catch (error) {
      console.error("❌ Email service connection test failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();
