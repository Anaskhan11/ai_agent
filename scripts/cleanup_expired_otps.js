const OTPModel = require("../model/otpModel/otpModel");

async function cleanupExpiredOTPs() {
  try {
    console.log("Starting OTP cleanup...");
    const deletedCount = await OTPModel.deleteExpiredOTPs();
    console.log(`Cleaned up ${deletedCount} expired OTPs`);
  } catch (error) {
    console.error("Error during OTP cleanup:", error);
  }
}

// Run cleanup
cleanupExpiredOTPs();

// Export for potential cron job usage
module.exports = cleanupExpiredOTPs;
