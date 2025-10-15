const mysql = require('mysql2/promise');
require("dotenv").config({ path: "./config/config.env" });

async function testOTPSystem() {
  const connection = await mysql.createConnection({
    host: '37.27.187.4',
    user: 'root',
    password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
    database: 'ai_agent'
  });

  try {
    console.log("Testing OTP system...");
    
    // Check if email_verification_otps table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'email_verification_otps'");
    if (tables.length > 0) {
      console.log("✓ email_verification_otps table exists");
      
      // Check table structure
      const [columns] = await connection.execute("DESCRIBE email_verification_otps");
      console.log("Table structure:");
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
      });
    } else {
      console.log("✗ email_verification_otps table does not exist");
    }
    
    // Check if users table has email verification columns
    const [userColumns] = await connection.execute("DESCRIBE users");
    const hasEmailVerified = userColumns.some(col => col.Field === 'email_verified');
    const hasEmailVerifiedAt = userColumns.some(col => col.Field === 'email_verified_at');
    
    console.log(`✓ users.email_verified column: ${hasEmailVerified ? 'exists' : 'missing'}`);
    console.log(`✓ users.email_verified_at column: ${hasEmailVerifiedAt ? 'exists' : 'missing'}`);
    
    // Test OTP model functions
    console.log("\nTesting OTP model functions...");
    const OTPModel = require("../model/otpModel/otpModel");
    
    const testEmail = "test@example.com";
    const testOTP = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Create test OTP
    const otpId = await OTPModel.createOTP({
      email: testEmail,
      otp_code: testOTP,
      expires_at: expiresAt
    });
    console.log(`✓ Created test OTP with ID: ${otpId}`);
    
    // Find valid OTP
    const foundOTP = await OTPModel.findValidOTP(testEmail, testOTP);
    console.log(`✓ Found OTP: ${foundOTP ? 'Yes' : 'No'}`);
    
    // Mark as used
    if (foundOTP) {
      await OTPModel.markOTPAsUsed(foundOTP.id);
      console.log("✓ Marked OTP as used");
    }
    
    // Clean up test data
    await OTPModel.deleteOTPsByEmail(testEmail);
    console.log("✓ Cleaned up test OTP");
    
    console.log("\n✅ OTP system test completed successfully!");
    
  } catch (error) {
    console.error("❌ OTP system test failed:", error);
  } finally {
    await connection.end();
  }
}

testOTPSystem();
