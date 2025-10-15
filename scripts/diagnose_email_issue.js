const EmailService = require('../services/EmailService');
const nodemailer = require('nodemailer');
require("dotenv").config({ path: "./config/config.env" });

async function diagnoseEmailIssue() {
  console.log('🔍 Diagnosing Email Service Issues...\n');
  
  console.log('📋 Current Email Configuration:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'NOT SET');
  console.log('APP_NAME:', process.env.APP_NAME);
  console.log('');
  
  // Test 1: Basic connection test
  console.log('🧪 Test 1: Basic SMTP Connection...');
  try {
    const testResult = await EmailService.testConnection();
    console.log('Connection result:', testResult ? '✅ SUCCESS' : '❌ FAILED');
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
  
  // Test 2: Direct nodemailer test
  console.log('\n🧪 Test 2: Direct Nodemailer Test...');
  try {
    const transporter = nodemailer.createTransport({
      host: 'mail.aicruitment.com',
      port: 25,
      secure: false,
      tls: {
        rejectUnauthorized: false
      }
    });
    
    await transporter.verify();
    console.log('✅ Direct nodemailer connection successful');
    
    // Test sending to a valid email
    console.log('\n📧 Testing email send to info@aicruitment.com...');
    const testEmail = await transporter.sendMail({
      from: '"AI CRUITMENT" <info@aicruitment.com>',
      to: 'info@aicruitment.com',
      subject: 'Test Email - OTP System',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your OTP system.</p>
        <p>OTP Code: 123456</p>
        <p>Time: ${new Date().toISOString()}</p>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', testEmail.messageId);
    
  } catch (error) {
    console.log('❌ Direct nodemailer test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused - check if mail server is running');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Connection timeout - check network connectivity');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Host not found - check SMTP_HOST setting');
    }
  }
  
  // Test 3: EmailService test
  console.log('\n🧪 Test 3: EmailService Test...');
  try {
    const emailResult = await EmailService.sendOTPEmail('info@aicruitment.com', '123456', 'Test User');
    
    if (emailResult.success) {
      console.log('✅ EmailService test successful');
      console.log('Message ID:', emailResult.messageId);
    } else {
      console.log('❌ EmailService test failed:', emailResult.error);
    }
  } catch (error) {
    console.log('❌ EmailService test error:', error.message);
  }
  
  // Test 4: Check email service configuration detection
  console.log('\n🧪 Test 4: Email Service Configuration Detection...');
  console.log('EmailService configured:', EmailService.isConfigured !== false ? 'Yes' : 'No');
  
  console.log('\n📋 Diagnosis Summary:');
  console.log('1. Check if mail.aicruitment.com is accessible from your server');
  console.log('2. Verify port 25 is not blocked by firewall');
  console.log('3. Ensure the email server allows relay from your IP');
  console.log('4. Try using a different SMTP port (587 or 465) if available');
  
  console.log('\n💡 Temporary Solution:');
  console.log('The registration system now logs OTP codes to console when email fails');
  console.log('Users can still complete registration by checking server logs');
}

diagnoseEmailIssue();
