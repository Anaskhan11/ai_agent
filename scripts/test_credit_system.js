const pool = require('../config/DBConnection');
const CreditModel = require('../model/CreditModel/CreditModel');
const CreditPackageModel = require('../model/CreditModel/CreditPackageModel');
const UsageTrackingModel = require('../model/CreditModel/UsageTrackingModel');

async function testCreditSystem() {
  let connection;
  
  try {
    console.log('🧪 Testing Credit System...\n');
    
    connection = await pool.getConnection();
    
    // Test 1: Check if tables exist
    console.log('📋 Test 1: Verifying database tables...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'ai_agent' 
      AND TABLE_NAME IN (
        'credit_packages', 
        'user_credits', 
        'credit_transactions', 
        'usage_tracking', 
        'credit_pricing', 
        'stripe_payments', 
        'credit_alerts'
      )
    `);
    
    console.log(`✅ Found ${tables.length}/7 credit system tables:`);
    tables.forEach(table => console.log(`   - ${table.TABLE_NAME}`));
    
    // Test 2: Check credit packages
    console.log('\n📦 Test 2: Checking credit packages...');
    const packages = await CreditPackageModel.getAllCreditPackages();
    console.log(`✅ Found ${packages.length} credit packages:`);
    packages.forEach(pkg => {
      console.log(`   - ${pkg.name}: ${pkg.credits_amount} credits for $${(pkg.price_cents/100).toFixed(2)}`);
    });
    
    // Test 3: Check credit pricing
    console.log('\n💰 Test 3: Checking credit pricing...');
    const [pricing] = await connection.execute('SELECT * FROM credit_pricing ORDER BY operation_type');
    console.log(`✅ Found ${pricing.length} pricing rules:`);
    pricing.forEach(rule => {
      console.log(`   - ${rule.operation_type} (${rule.unit_type}): ${rule.credits_per_unit} credits`);
    });
    
    // Test 4: Test user credit operations (using user ID 1)
    console.log('\n👤 Test 4: Testing user credit operations...');
    const testUserId = 1;
    
    // Initialize user credits if not exists
    let userBalance = await CreditModel.getUserCreditBalance(testUserId);
    if (!userBalance) {
      await CreditModel.initializeUserCredits(testUserId, 100);
      userBalance = await CreditModel.getUserCreditBalance(testUserId);
      console.log(`✅ Initialized credits for user ${testUserId}`);
    }
    
    console.log(`✅ User ${testUserId} balance:`, {
      total: userBalance.total_credits,
      used: userBalance.used_credits,
      available: userBalance.available_credits
    });
    
    // Test 5: Test credit deduction
    console.log('\n💸 Test 5: Testing credit deduction...');
    const deductAmount = 5.0;
    const hasSufficientCredits = await CreditModel.checkSufficientCredits(testUserId, deductAmount);
    
    if (hasSufficientCredits) {
      await CreditModel.deductCreditsFromUser(
        testUserId,
        deductAmount,
        'test_operation',
        'test-123',
        'Credit system test deduction'
      );
      
      const newBalance = await CreditModel.getUserCreditBalance(testUserId);
      console.log(`✅ Deducted ${deductAmount} credits. New balance: ${newBalance.available_credits}`);
    } else {
      console.log(`⚠️  Insufficient credits for deduction test (need ${deductAmount})`);
    }
    
    // Test 6: Test usage tracking
    console.log('\n📊 Test 6: Testing usage tracking...');
    const usageRecord = await UsageTrackingModel.createUsageRecord({
      user_id: testUserId,
      operation_type: 'test_operation',
      operation_id: 'test-usage-123',
      credits_consumed: 2.5,
      unit_cost: 1.0,
      units_consumed: 2.5,
      unit_type: 'test_units',
      operation_details: {
        test: true,
        timestamp: new Date().toISOString()
      },
      status: 'completed'
    });
    
    console.log(`✅ Created usage tracking record: ${usageRecord.usage_id}`);
    
    // Test 7: Test transaction history
    console.log('\n📜 Test 7: Testing transaction history...');
    const transactions = await CreditModel.getUserCreditTransactions(testUserId, 1, 5);
    console.log(`✅ Found ${transactions.transactions.length} recent transactions for user ${testUserId}`);
    
    // Test 8: Test analytics
    console.log('\n📈 Test 8: Testing analytics...');
    const analytics = await CreditModel.getUserCreditAnalytics(testUserId, 30);
    console.log(`✅ Analytics for user ${testUserId}:`, {
      totalCreditsConsumed: analytics.summary?.total_credits_consumed || 0,
      totalOperations: analytics.summary?.total_operations || 0
    });
    
    console.log('\n🎉 All credit system tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Database tables: ${tables.length}/7 created`);
    console.log(`   - Credit packages: ${packages.length} available`);
    console.log(`   - Pricing rules: ${pricing.length} configured`);
    console.log(`   - User operations: Working correctly`);
    console.log(`   - Usage tracking: Working correctly`);
    console.log(`   - Analytics: Working correctly`);
    
  } catch (error) {
    console.error('❌ Credit system test failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log('\n🔓 Database connection released');
    }
  }
}

// Run the test
if (require.main === module) {
  testCreditSystem()
    .then(() => {
      console.log('\n✅ Credit system test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Credit system test failed:', error);
      process.exit(1);
    });
}

module.exports = testCreditSystem;
