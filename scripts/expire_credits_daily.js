/**
 * Daily Credit Expiration Job
 * This script should be run daily (via cron job) to expire credits that have passed their 30-day validity
 */

const CreditExpirationService = require('../services/CreditExpirationService');
const pool = require('../config/DBConnection');

async function runDailyCreditExpiration() {
  let connection;
  
  try {
    console.log('🕐 Starting daily credit expiration job...');
    console.log(`📅 Date: ${new Date().toISOString()}`);
    
    // Test database connection
    connection = await pool.getConnection();
    console.log('✅ Database connection established');
    connection.release();
    
    // Run the expiration process
    const expirationResult = await CreditExpirationService.runDailyExpiration();
    
    // Send expiration notifications
    const notificationResult = await CreditExpirationService.sendExpirationNotifications();
    
    // Get expiration statistics
    const stats = await CreditExpirationService.getExpirationStatistics(30);
    
    // Log summary
    console.log('\n📊 Daily Expiration Summary:');
    console.log(`   • Batches expired today: ${expirationResult.expired_batches}`);
    console.log(`   • Credits expired today: ${expirationResult.total_credits_expired}`);
    console.log(`   • Expiration notifications sent: ${notificationResult.notifications_sent}`);
    console.log(`   • Active credit batches: ${stats.active_batches}`);
    console.log(`   • Total active credits: ${stats.active_credits}`);
    console.log(`   • Credits expiring soon: ${stats.credits_expiring_soon}`);
    
    // Create audit log entry
    await createAuditLogEntry({
      expired_batches: expirationResult.expired_batches,
      credits_expired: expirationResult.total_credits_expired,
      notifications_sent: notificationResult.notifications_sent,
      stats: stats
    });
    
    console.log('\n✅ Daily credit expiration job completed successfully!');
    
    return {
      success: true,
      expiration_result: expirationResult,
      notification_result: notificationResult,
      statistics: stats
    };
    
  } catch (error) {
    console.error('❌ Daily credit expiration job failed:', error);
    
    // Log error to database or monitoring system
    await logError(error);
    
    throw error;
  }
}

/**
 * Create audit log entry for the expiration job
 */
async function createAuditLogEntry(data) {
  try {
    const connection = await pool.getConnection();
    
    const sql = `
      INSERT INTO credit_transactions (
        transaction_id, user_id, type, amount, balance_before, balance_after,
        description, reference_type, reference_id, metadata, created_at
      ) VALUES (?, 0, 'expiry', 0, 0, 0, ?, 'system_job', 'daily_expiration', ?, NOW())
    `;
    
    const transactionId = `DAILY_EXPIRY_${new Date().toISOString().split('T')[0]}`;
    const description = `Daily credit expiration job - ${data.expired_batches} batches, ${data.credits_expired} credits expired`;
    
    await connection.execute(sql, [
      transactionId,
      description,
      JSON.stringify({
        job_type: 'daily_credit_expiration',
        date: new Date().toISOString(),
        ...data
      })
    ]);
    
    connection.release();
    console.log('📝 Audit log entry created');
    
  } catch (error) {
    console.error('⚠️  Failed to create audit log entry:', error);
    // Don't throw - this shouldn't fail the main job
  }
}

/**
 * Log error to monitoring system
 */
async function logError(error) {
  try {
    const connection = await pool.getConnection();
    
    const sql = `
      INSERT INTO credit_transactions (
        transaction_id, user_id, type, amount, balance_before, balance_after,
        description, reference_type, reference_id, metadata, created_at
      ) VALUES (?, 0, 'adjustment', 0, 0, 0, ?, 'system_error', 'daily_expiration_error', ?, NOW())
    `;
    
    const transactionId = `EXPIRY_ERROR_${Date.now()}`;
    const description = `Daily credit expiration job error: ${error.message}`;
    
    await connection.execute(sql, [
      transactionId,
      description,
      JSON.stringify({
        error_type: 'daily_credit_expiration_error',
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString()
      })
    ]);
    
    connection.release();
    
  } catch (logError) {
    console.error('⚠️  Failed to log error to database:', logError);
  }
}

/**
 * Validate system health before running expiration
 */
async function validateSystemHealth() {
  try {
    const connection = await pool.getConnection();
    
    // Check if required tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME IN ('credit_batches', 'user_credits', 'credit_transactions')
    `);
    
    if (tables.length < 3) {
      throw new Error('Required credit system tables not found');
    }
    
    // Check if there are any active batches to process
    const [activeBatches] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM credit_batches 
      WHERE is_expired = FALSE
    `);
    
    connection.release();
    
    console.log(`✅ System health check passed - ${activeBatches[0].count} active batches found`);
    return true;
    
  } catch (error) {
    console.error('❌ System health check failed:', error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  validateSystemHealth()
    .then(() => runDailyCreditExpiration())
    .then((result) => {
      console.log('\n🎉 Credit expiration job completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Credit expiration job failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runDailyCreditExpiration,
  validateSystemHealth
};
