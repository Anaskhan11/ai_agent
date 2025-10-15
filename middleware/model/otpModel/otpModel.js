const pool = require("../../config/DBConnection");

// Create OTP record
const createOTP = async (otpData) => {
  const sql = `INSERT INTO email_verification_otps (email, otp_code, expires_at, created_at) 
               VALUES (?, ?, ?, NOW())`;
  const [result] = await pool.execute(sql, [
    otpData.email,
    otpData.otp_code,
    otpData.expires_at,
  ]);
  return result.insertId;
};

// Find valid OTP by email and code
const findValidOTP = async (email, otp_code) => {
  const sql = `SELECT * FROM email_verification_otps 
               WHERE email = ? AND otp_code = ? AND expires_at > NOW() AND is_used = 0 
               ORDER BY created_at DESC LIMIT 1`;
  const [rows] = await pool.execute(sql, [email, otp_code]);
  return rows[0];
};

// Mark OTP as used
const markOTPAsUsed = async (id) => {
  const sql = `UPDATE email_verification_otps SET is_used = 1, used_at = NOW() WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows;
};

// Delete expired OTPs (cleanup function)
const deleteExpiredOTPs = async () => {
  const sql = `DELETE FROM email_verification_otps WHERE expires_at < NOW()`;
  const [result] = await pool.execute(sql);
  return result.affectedRows;
};

// Delete all OTPs for an email (useful when user successfully verifies)
const deleteOTPsByEmail = async (email) => {
  const sql = `DELETE FROM email_verification_otps WHERE email = ?`;
  const [result] = await pool.execute(sql, [email]);
  return result.affectedRows;
};

// Get OTP attempts count for an email in last hour (rate limiting)
const getOTPAttemptsCount = async (email) => {
  const sql = `SELECT COUNT(*) as count FROM email_verification_otps 
               WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0].count;
};

module.exports = {
  createOTP,
  findValidOTP,
  markOTPAsUsed,
  deleteExpiredOTPs,
  deleteOTPsByEmail,
  getOTPAttemptsCount,
};
