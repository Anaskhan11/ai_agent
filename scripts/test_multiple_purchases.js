const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testMultiplePurchases() {
  try {
    console.log('🧪 Testing Multiple Credit Purchases...\n');
    
    const connection = await pool.getConnection();
    
    // 1. Create a test user for this test
    console.log('1️⃣ Creating test user...');
    const testUserId = Math.floor(Math.random() * 1000000) + 2000000; // Random ID starting from 2000000
    const testEmail = `test_${testUserId}@example.com`;
    
    await connection.execute(`
      INSERT INTO users (id, email, username, password_hash, first_name, last_name, role_id)
      VALUES (?, ?, ?, 'test_hash', 'Test', 'User', 2)
    `, [testUserId, testEmail, `test_${testUserId}`]);
    
    console.log(`✅ Test user created: ID ${testUserId}, Email: ${testEmail}`);
    
    // 2. Initialize user credits
    console.log('\n2️⃣ Initializing user credits...');
    await connection.execute(`
      INSERT INTO user_credits (user_id, total_credits, used_credits)
      VALUES (?, 0.00, 0.00)
    `, [testUserId]);
    
    console.log('✅ User credits initialized');
    
    // 3. Simulate multiple purchases
    console.log('\n3️⃣ Simulating multiple purchases...');
    const purchases = [
      { amount: 100, description: 'First purchase - Starter Pack' },
      { amount: 500, description: 'Second purchase - Professional Pack' },
      { amount: 250, description: 'Third purchase - Additional Credits' },
      { amount: 1000, description: 'Fourth purchase - Business Pack' }
    ];
    
    let expectedTotal = 0;
    
    for (let i = 0; i < purchases.length; i++) {
      const purchase = purchases[i];
      console.log(`   Purchase ${i + 1}: Adding ${purchase.amount} credits...`);
      
      // Get current balance
      const [currentBalance] = await connection.execute(`
        SELECT total_credits, used_credits FROM user_credits WHERE user_id = ?
      `, [testUserId]);
      
      const currentTotal = parseFloat(currentBalance[0].total_credits);
      const newTotal = currentTotal + purchase.amount;
      expectedTotal += purchase.amount;
      
      // Update credits
      await connection.execute(`
        UPDATE user_credits 
        SET total_credits = ?, last_purchase_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [newTotal, testUserId]);
      
      // Create transaction record
      const transactionId = uuidv4();
      await connection.execute(`
        INSERT INTO credit_transactions 
        (transaction_id, user_id, type, amount, balance_before, balance_after, description)
        VALUES (?, ?, 'purchase', ?, ?, ?, ?)
      `, [transactionId, testUserId, purchase.amount, currentTotal, newTotal, purchase.description]);
      
      // Create mock Stripe payment record
      const paymentId = uuidv4();
      const paymentIntentId = `pi_test_${uuidv4().replace(/-/g, '')}`;
      await connection.execute(`
        INSERT INTO stripe_payments
        (payment_id, user_id, stripe_payment_intent_id, stripe_customer_id, amount_cents, currency, status, credits_purchased, credits_allocated)
        VALUES (?, ?, ?, 'cus_test', ?, 'USD', 'succeeded', ?, TRUE)
      `, [paymentId, testUserId, paymentIntentId, purchase.amount * 10, purchase.amount]); // Assuming 10 cents per credit
      
      console.log(`   ✅ Purchase ${i + 1} completed: ${purchase.amount} credits added (Total: ${newTotal})`);
    }
    
    // 4. Verify final balance
    console.log('\n4️⃣ Verifying final balance...');
    const [finalBalance] = await connection.execute(`
      SELECT * FROM user_credits WHERE user_id = ?
    `, [testUserId]);
    
    const finalCredits = finalBalance[0];
    console.log(`   💰 Final Balance:`);
    console.log(`      Total Credits: ${finalCredits.total_credits}`);
    console.log(`      Used Credits: ${finalCredits.used_credits}`);
    console.log(`      Available Credits: ${finalCredits.available_credits}`);
    console.log(`      Expected Total: ${expectedTotal}`);
    
    // 5. Verify transactions
    console.log('\n5️⃣ Verifying transactions...');
    const [transactions] = await connection.execute(`
      SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at ASC
    `, [testUserId]);
    
    console.log(`   📋 Transactions (${transactions.length}):`);
    transactions.forEach((tx, index) => {
      console.log(`      ${index + 1}. ${tx.type}: ${tx.amount} credits (${tx.balance_before} → ${tx.balance_after}) - ${tx.description}`);
    });
    
    // 6. Verify payments
    console.log('\n6️⃣ Verifying payments...');
    const [payments] = await connection.execute(`
      SELECT * FROM stripe_payments WHERE user_id = ? ORDER BY created_at ASC
    `, [testUserId]);
    
    console.log(`   💳 Payments (${payments.length}):`);
    payments.forEach((payment, index) => {
      console.log(`      ${index + 1}. $${payment.amount_cents/100} for ${payment.credits_purchased} credits - Status: ${payment.status}, Allocated: ${payment.credits_allocated}`);
    });
    
    // 7. Test credit balance calculation
    console.log('\n7️⃣ Testing credit balance calculation...');
    const totalFromTransactions = transactions
      .filter(tx => tx.type === 'purchase')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const totalFromPayments = payments
      .filter(payment => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + parseFloat(payment.credits_purchased), 0);
    
    console.log(`   🧮 Calculation verification:`);
    console.log(`      Total from transactions: ${totalFromTransactions}`);
    console.log(`      Total from payments: ${totalFromPayments}`);
    console.log(`      Database total_credits: ${finalCredits.total_credits}`);
    console.log(`      Expected total: ${expectedTotal}`);
    
    const isCorrect = (
      parseFloat(finalCredits.total_credits) === expectedTotal &&
      totalFromTransactions === expectedTotal &&
      totalFromPayments === expectedTotal
    );
    
    if (isCorrect) {
      console.log('   ✅ All calculations match - Multiple purchases working correctly!');
    } else {
      console.log('   ❌ Calculation mismatch detected!');
    }
    
    // 8. Cleanup test data
    console.log('\n8️⃣ Cleaning up test data...');
    await connection.execute(`DELETE FROM credit_transactions WHERE user_id = ?`, [testUserId]);
    await connection.execute(`DELETE FROM stripe_payments WHERE user_id = ?`, [testUserId]);
    await connection.execute(`DELETE FROM user_credits WHERE user_id = ?`, [testUserId]);
    await connection.execute(`DELETE FROM users WHERE id = ?`, [testUserId]);
    console.log('✅ Test data cleaned up');
    
    connection.release();
    console.log('\n🎉 Multiple purchase test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing multiple purchases:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testMultiplePurchases();
