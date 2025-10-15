const nodemailer = require("nodemailer");
require("dotenv").config({ path: "./config/config.env" });

async function debugEmailAuth() {
  console.log('🔍 Debugging Email Authentication...\n');
  
  const configs = [
    {
      name: "Standard SSL (Port 465)",
      config: {
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: "STARTTLS (Port 587)",
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: "Alternative Port 25",
      config: {
        host: process.env.SMTP_HOST,
        port: 25,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: "No Authentication",
      config: {
        host: process.env.SMTP_HOST,
        port: 25,
        secure: false,
        tls: {
          rejectUnauthorized: false
        }
      }
    }
  ];

  console.log('📋 Current Configuration:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'NOT SET');
  console.log('APP_NAME:', process.env.APP_NAME);
  console.log('\n' + '='.repeat(60) + '\n');

  for (const testConfig of configs) {
    console.log(`🧪 Testing: ${testConfig.name}`);
    console.log(`   Host: ${testConfig.config.host}`);
    console.log(`   Port: ${testConfig.config.port}`);
    console.log(`   Secure: ${testConfig.config.secure}`);
    console.log(`   Auth: ${testConfig.config.auth ? 'Yes' : 'No'}`);
    
    try {
      const transporter = nodemailer.createTransport(testConfig.config);
      await transporter.verify();
      console.log('   ✅ SUCCESS - This configuration works!\n');
      
      // Try sending a test email with the working configuration
      console.log('📧 Attempting to send test email...');
      const testResult = await transporter.sendMail({
        from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER, // Send to self for testing
        subject: "Test Email - OTP System",
        html: `
          <h2>Test Email</h2>
          <p>This is a test email from your OTP system.</p>
          <p>Configuration: ${testConfig.name}</p>
          <p>Time: ${new Date().toISOString()}</p>
        `
      });
      
      console.log('   ✅ Test email sent successfully!');
      console.log('   📧 Message ID:', testResult.messageId);
      console.log('\n🎉 WORKING CONFIGURATION FOUND!');
      console.log('Use this configuration in your EmailService:\n');
      console.log(JSON.stringify(testConfig.config, null, 2));
      break;
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.code) {
        console.log(`   📋 Error Code: ${error.code}`);
      }
      if (error.response) {
        console.log(`   📋 Server Response: ${error.response}`);
      }
      console.log('');
    }
  }
  
  console.log('\n💡 Troubleshooting Tips:');
  console.log('1. Check if the email server requires specific authentication');
  console.log('2. Verify the password is correct (no special characters issues)');
  console.log('3. Check if the email provider blocks SMTP from external applications');
  console.log('4. Try contacting your email provider for SMTP settings');
  console.log('5. Some providers require enabling "Less secure app access"');
}

debugEmailAuth();
