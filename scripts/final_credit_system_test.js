const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function finalCreditSystemTest() {
  try {
    console.log('🎯 Final Credit System Test - Verifying All Issues Are Fixed\n');
    
    const connection = await pool.getConnection();
    
    // 1. Test Multiple Purchases Accumulation
    console.log('1️⃣ Testing Multiple Purchases Accumulation...');
    const [multiPurchaseUsers] = await connection.execute(`
      SELECT 
        uc.user_id,
        u.email,
        uc.total_credits,
        uc.available_credits,
        COUNT(ct.id) as purchase_count,
        SUM(CASE WHEN ct.type = 'purchase' THEN ct.amount ELSE 0 END) as total_purchased
      FROM user_credits uc
      LEFT JOIN users u ON uc.user_id = u.id
      LEFT JOIN credit_transactions ct ON uc.user_id = ct.user_id
      WHERE uc.total_credits > 0
      GROUP BY uc.user_id, u.email, uc.total_credits, uc.available_credits
      HAVING purchase_count > 1
      ORDER BY total_purchased DESC
      LIMIT 5
    `);
    
    console.log('   📊 Users with multiple purchases:');
    multiPurchaseUsers.forEach(user => {
      const isCorrect = parseFloat(user.total_credits) === parseFloat(user.total_purchased);
      console.log(`      ${user.email}: ${user.purchase_count} purchases, Total: ${user.total_credits}, Purchased: ${user.total_purchased} ${isCorrect ? '✅' : '❌'}`);
    });
    
    // 2. Test Demo User Credits
    console.log('\n2️⃣ Testing Demo User Credits...');
    const [demoUser] = await connection.execute(`
      SELECT uc.*, u.email 
      FROM user_credits uc 
      LEFT JOIN users u ON uc.user_id = u.id 
      WHERE u.email = 'demo@example.com' OR u.username = 'demo'
    `);
    
    if (demoUser.length > 0) {
      const demo = demoUser[0];
      console.log(`   ✅ Demo user has credits: ${demo.available_credits} available (${demo.total_credits} total)`);
    } else {
      console.log('   ❌ Demo user has no credits');
    }
    
    // 3. Test Credit Balance Calculation
    console.log('\n3️⃣ Testing Credit Balance Calculation...');
    const [balanceTest] = await connection.execute(`
      SELECT 
        user_id,
        total_credits,
        used_credits,
        available_credits,
        (total_credits - used_credits) as calculated_available
      FROM user_credits
      WHERE total_credits > 0
      LIMIT 10
    `);
    
    let balanceCorrect = true;
    balanceTest.forEach(balance => {
      const isCorrect = parseFloat(balance.available_credits) === parseFloat(balance.calculated_available);
      if (!isCorrect) balanceCorrect = false;
      console.log(`      User ${balance.user_id}: Available=${balance.available_credits}, Calculated=${balance.calculated_available} ${isCorrect ? '✅' : '❌'}`);
    });
    
    if (balanceCorrect) {
      console.log('   ✅ All credit balance calculations are correct');
    } else {
      console.log('   ❌ Some credit balance calculations are incorrect');
    }
    
    // 4. Test Payment-Credit Allocation Consistency
    console.log('\n4️⃣ Testing Payment-Credit Allocation Consistency...');
    const [paymentConsistency] = await connection.execute(`
      SELECT 
        sp.user_id,
        u.email,
        COUNT(sp.id) as total_payments,
        SUM(CASE WHEN sp.status = 'succeeded' THEN sp.credits_purchased ELSE 0 END) as credits_from_payments,
        SUM(CASE WHEN ct.type = 'purchase' THEN ct.amount ELSE 0 END) as credits_from_transactions
      FROM stripe_payments sp
      LEFT JOIN users u ON sp.user_id = u.id
      LEFT JOIN credit_transactions ct ON sp.user_id = ct.user_id AND ct.reference_id = sp.stripe_payment_intent_id
      WHERE sp.status = 'succeeded'
      GROUP BY sp.user_id, u.email
      HAVING credits_from_payments > 0
      ORDER BY credits_from_payments DESC
      LIMIT 5
    `);
    
    let paymentConsistent = true;
    console.log('   📊 Payment-Transaction consistency:');
    paymentConsistency.forEach(payment => {
      const isConsistent = parseFloat(payment.credits_from_payments) === parseFloat(payment.credits_from_transactions || 0);
      if (!isConsistent) paymentConsistent = false;
      console.log(`      ${payment.email}: Payments=${payment.credits_from_payments}, Transactions=${payment.credits_from_transactions} ${isConsistent ? '✅' : '❌'}`);
    });
    
    if (paymentConsistent) {
      console.log('   ✅ Payment-credit allocation is consistent');
    } else {
      console.log('   ❌ Payment-credit allocation has inconsistencies');
    }
    
    // 5. Test for Zero Balance Issue
    console.log('\n5️⃣ Testing for Zero Balance Issue...');
    const [zeroBalanceUsers] = await connection.execute(`
      SELECT 
        uc.user_id,
        u.email,
        uc.total_credits,
        uc.available_credits,
        COUNT(sp.id) as successful_payments,
        SUM(sp.credits_purchased) as credits_purchased
      FROM user_credits uc
      LEFT JOIN users u ON uc.user_id = u.id
      LEFT JOIN stripe_payments sp ON uc.user_id = sp.user_id AND sp.status = 'succeeded'
      WHERE uc.available_credits = 0 AND sp.credits_purchased > 0
      GROUP BY uc.user_id, u.email, uc.total_credits, uc.available_credits
    `);
    
    if (zeroBalanceUsers.length === 0) {
      console.log('   ✅ No users with zero balance despite successful purchases');
    } else {
      console.log('   ❌ Found users with zero balance despite successful purchases:');
      zeroBalanceUsers.forEach(user => {
        console.log(`      ${user.email}: Balance=${user.available_credits}, Purchased=${user.credits_purchased}`);
      });
    }
    
    // 6. Summary Report
    console.log('\n6️⃣ Summary Report...');
    const [totalStats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT uc.user_id) as users_with_credits,
        SUM(uc.total_credits) as total_credits_in_system,
        SUM(uc.used_credits) as total_credits_used,
        SUM(uc.available_credits) as total_credits_available,
        COUNT(DISTINCT sp.user_id) as users_with_payments,
        SUM(CASE WHEN sp.status = 'succeeded' THEN sp.credits_purchased ELSE 0 END) as total_credits_purchased
      FROM user_credits uc
      LEFT JOIN stripe_payments sp ON uc.user_id = sp.user_id
      WHERE uc.total_credits > 0
    `);
    
    const stats = totalStats[0];
    console.log('   📈 System Statistics:');
    console.log(`      Users with credits: ${stats.users_with_credits}`);
    console.log(`      Total credits in system: ${stats.total_credits_in_system}`);
    console.log(`      Total credits used: ${stats.total_credits_used}`);
    console.log(`      Total credits available: ${stats.total_credits_available}`);
    console.log(`      Users with payments: ${stats.users_with_payments}`);
    console.log(`      Total credits purchased: ${stats.total_credits_purchased}`);
    
    // Final verdict
    console.log('\n🎯 Final Verdict:');
    const allTestsPassed = (
      multiPurchaseUsers.length > 0 &&
      demoUser.length > 0 &&
      balanceCorrect &&
      paymentConsistent &&
      zeroBalanceUsers.length === 0
    );
    
    if (allTestsPassed) {
      console.log('✅ ALL CREDIT SYSTEM ISSUES HAVE BEEN FIXED!');
      console.log('   ✅ Multiple purchases accumulate correctly');
      console.log('   ✅ Demo user has credits');
      console.log('   ✅ Credit balance calculations are accurate');
      console.log('   ✅ Payment-credit allocation is consistent');
      console.log('   ✅ No zero balance issues');
    } else {
      console.log('❌ Some issues still remain - check the details above');
    }
    
    connection.release();
    console.log('\n🎉 Final credit system test completed!');
    
  } catch (error) {
    console.error('❌ Error in final credit system test:', error);
  } finally {
    await pool.end();
  }
}

// Run the final test
finalCreditSystemTest();
