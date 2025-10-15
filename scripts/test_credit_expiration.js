/**
 * Test Credit Expiration System
 * This script tests the credit expiration functionality
 */

const pool = require('../config/DBConnection');
const CreditExpirationService = require('../services/CreditExpirationService');
const CreditExpirationModel = require('../model/CreditModel/CreditExpirationModel');
const CreditNotificationService = require('../services/CreditNotificationService');

async function testCreditExpirationSystem() {
  let connection;
  
  try {
    console.log('🧪 Starting Credit Expiration System Tests...\n');
    
    connection = await pool.getConnection();
    console.log('✅ Database connection established');
    
    // Test 1: Check if tables exist
    await testTablesExist(connection);
    
    // Test 2: Create test credit batch
    const testBatch = await testCreateCreditBatch();
    
    // Test 3: Test credit deduction with FIFO
    await testCreditDeduction(testBatch.user_id);
    
    // Test 4: Test expiration process
    await testExpirationProcess();
    
    // Test 5: Test notification system
    await testNotificationSystem();
    
    // Test 6: Test statistics
    await testStatistics();
    
    console.log('\n🎉 All credit expiration tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Credit expiration tests failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function testTablesExist(connection) {
  console.log('\n📋 Test 1: Checking if required tables exist...');
  
  const requiredTables = ['credit_batches', 'user_credits', 'credit_transactions', 'credit_alerts'];
  
  for (const table of requiredTables) {
    const [rows] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `, [table]);
    
    if (rows.length > 0) {
      console.log(`  ✅ Table ${table} exists`);
    } else {
      throw new Error(`Required table ${table} does not exist`);
    }
  }
  
  // Check if user_credits has new columns
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'user_credits' 
    AND COLUMN_NAME IN ('expired_credits', 'last_expiry_at')
  `);
  
  console.log(`  ✅ user_credits has ${columns.length}/2 new expiration columns`);
}

async function testCreateCreditBatch() {
  console.log('\n🏗️  Test 2: Creating test credit batch...');
  
  // Create a test user if doesn't exist
  const testUserId = 999999; // Use a high ID to avoid conflicts
  
  try {
    await pool.execute(`
      INSERT IGNORE INTO users (user_id, email, first_name, last_name, username, password_hash, role_id)
      VALUES (?, 'test@creditexpiry.com', 'Test', 'User', 'testuser', 'hashedpassword', 1)
    `, [testUserId]);
    
    // Initialize user credits
    await pool.execute(`
      INSERT INTO user_credits (user_id, total_credits, used_credits) 
      VALUES (?, 0, 0) 
      ON DUPLICATE KEY UPDATE total_credits = total_credits
    `, [testUserId]);
    
    // Create a credit batch with short expiry for testing
    const batchResult = await CreditExpirationModel.createCreditBatch({
      user_id: testUserId,
      credits_purchased: 100,
      expiry_days: 1, // 1 day for testing
      batch_type: 'purchase',
      metadata: { test: true }
    });
    
    console.log(`  ✅ Created test batch: ${batchResult.batch_id} with 100 credits`);
    console.log(`  📅 Expiry date: ${batchResult.expiry_date}`);
    
    return { user_id: testUserId, batch_id: batchResult.batch_id };
    
  } catch (error) {
    console.error('  ❌ Failed to create test batch:', error);
    throw error;
  }
}

async function testCreditDeduction(userId) {
  console.log('\n💳 Test 3: Testing FIFO credit deduction...');
  
  try {
    // Get user's batches before deduction
    const batchesBefore = await CreditExpirationModel.getUserCreditBatches(userId, 'active');
    console.log(`  📊 User has ${batchesBefore.length} active batches before deduction`);
    
    // Deduct 25 credits
    const deductionResult = await CreditExpirationService.deductCredits(
      userId, 
      25, 
      'test_operation', 
      'test_123', 
      'Test credit deduction'
    );
    
    console.log(`  ✅ Deducted ${deductionResult.credits_deducted} credits`);
    console.log(`  📦 Affected ${deductionResult.batches_affected.length} batches`);
    
    // Get user's batches after deduction
    const batchesAfter = await CreditExpirationModel.getUserCreditBatches(userId, 'active');
    console.log(`  📊 User has ${batchesAfter.length} active batches after deduction`);
    
    if (batchesAfter.length > 0) {
      console.log(`  💰 Remaining credits in oldest batch: ${batchesAfter[0].credits_remaining}`);
    }
    
  } catch (error) {
    console.error('  ❌ Credit deduction test failed:', error);
    throw error;
  }
}

async function testExpirationProcess() {
  console.log('\n⏰ Test 4: Testing expiration process...');
  
  try {
    // Create a batch that's already expired for testing
    const testUserId = 999998;
    
    await pool.execute(`
      INSERT IGNORE INTO users (user_id, email, first_name, last_name, username, password_hash, role_id)
      VALUES (?, 'expired@creditexpiry.com', 'Expired', 'User', 'expireduser', 'hashedpassword', 1)
    `, [testUserId]);
    
    await pool.execute(`
      INSERT INTO user_credits (user_id, total_credits, used_credits) 
      VALUES (?, 0, 0) 
      ON DUPLICATE KEY UPDATE total_credits = total_credits
    `, [testUserId]);
    
    // Create an expired batch manually
    await pool.execute(`
      INSERT INTO credit_batches (
        batch_id, user_id, credits_purchased, credits_remaining, 
        purchase_date, expiry_date, is_expired, batch_type
      ) VALUES (?, ?, 50, 50, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), FALSE, 'purchase')
    `, [`TEST_EXPIRED_${Date.now()}`, testUserId]);
    
    console.log('  📦 Created expired test batch');
    
    // Run expiration process
    const expirationResult = await CreditExpirationModel.expireCredits();
    
    console.log(`  ✅ Expired ${expirationResult.expired_batches} batches`);
    console.log(`  💸 Total credits expired: ${expirationResult.total_credits_expired}`);
    
  } catch (error) {
    console.error('  ❌ Expiration process test failed:', error);
    throw error;
  }
}

async function testNotificationSystem() {
  console.log('\n📧 Test 5: Testing notification system...');
  
  try {
    // Test expiration warnings
    const warningResult = await CreditNotificationService.sendExpirationWarnings();
    console.log(`  ✅ Sent ${warningResult.warnings_sent} expiration warnings`);
    
    // Test getting user alerts
    if (warningResult.users.length > 0) {
      const userId = warningResult.users[0].user_id;
      const alerts = await CreditNotificationService.getUserAlerts(userId, 5);
      console.log(`  📬 User has ${alerts.length} alerts`);
    }
    
    // Test cleanup
    const cleanupResult = await CreditNotificationService.cleanupOldAlerts(1); // Clean alerts older than 1 day
    console.log(`  🧹 Cleaned up ${cleanupResult} old alerts`);
    
  } catch (error) {
    console.error('  ❌ Notification system test failed:', error);
    throw error;
  }
}

async function testStatistics() {
  console.log('\n📊 Test 6: Testing statistics...');
  
  try {
    const stats = await CreditExpirationService.getExpirationStatistics(30);
    
    console.log('  📈 Expiration Statistics (30 days):');
    console.log(`    • Active batches: ${stats.active_batches}`);
    console.log(`    • Active credits: ${stats.active_credits}`);
    console.log(`    • Batches expired: ${stats.batches_expired}`);
    console.log(`    • Credits expired: ${stats.credits_expired}`);
    console.log(`    • Credits expiring soon: ${stats.credits_expiring_soon}`);
    console.log(`    • Expiration rate: ${stats.expiration_rate}%`);
    
  } catch (error) {
    console.error('  ❌ Statistics test failed:', error);
    throw error;
  }
}

// Cleanup function
async function cleanupTestData() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove test users and their data
    const testUserIds = [999999, 999998];
    
    for (const userId of testUserIds) {
      await pool.execute('DELETE FROM credit_batches WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM user_credits WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM credit_transactions WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM credit_alerts WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM users WHERE user_id = ?', [userId]);
    }
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('⚠️  Failed to cleanup test data:', error);
  }
}

// Main execution
if (require.main === module) {
  testCreditExpirationSystem()
    .then(() => {
      console.log('\n🎊 Credit expiration system tests completed successfully!');
      return cleanupTestData();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error);
      cleanupTestData().finally(() => process.exit(1));
    });
}

module.exports = {
  testCreditExpirationSystem,
  cleanupTestData
};
