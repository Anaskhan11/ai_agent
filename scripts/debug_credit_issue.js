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

async function debugCreditIssue() {
  try {
    console.log('🔍 Debugging Credit System Issues...\n');
    
    const connection = await pool.getConnection();
    
    // 1. Check if credit tables exist
    console.log('1️⃣ Checking if credit tables exist...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'ai_agent' 
      AND TABLE_NAME IN ('user_credits', 'credit_transactions', 'credit_packages', 'stripe_payments')
    `);
    console.log('   📊 Credit tables found:', tables.map(t => t.TABLE_NAME));
    
    // 2. Check user_credits table structure
    console.log('\n2️⃣ Checking user_credits table structure...');
    const [userCreditsStructure] = await connection.execute(`
      DESCRIBE user_credits
    `);
    console.log('   📋 user_credits structure:');
    userCreditsStructure.forEach(col => {
      console.log(`      ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // 3. Check current user credits data
    console.log('\n3️⃣ Checking current user credits data...');
    const [userCredits] = await connection.execute(`
      SELECT uc.*, u.email, u.first_name, u.last_name 
      FROM user_credits uc 
      LEFT JOIN users u ON uc.user_id = u.id 
      ORDER BY uc.updated_at DESC 
      LIMIT 10
    `);
    console.log('   📊 Current user credits:');
    userCredits.forEach(credit => {
      console.log(`      User ${credit.user_id} (${credit.email}): Total=${credit.total_credits}, Used=${credit.used_credits}, Available=${credit.available_credits}`);
    });
    
    // 4. Check credit transactions
    console.log('\n4️⃣ Checking recent credit transactions...');
    const [transactions] = await connection.execute(`
      SELECT ct.*, u.email 
      FROM credit_transactions ct 
      LEFT JOIN users u ON ct.user_id = u.id 
      ORDER BY ct.created_at DESC 
      LIMIT 10
    `);
    console.log('   📊 Recent transactions:');
    transactions.forEach(tx => {
      console.log(`      ${tx.created_at}: User ${tx.user_id} (${tx.email}) - ${tx.type} ${tx.amount} credits (Balance: ${tx.balance_before} → ${tx.balance_after})`);
    });
    
    // 5. Check Stripe payments
    console.log('\n5️⃣ Checking Stripe payments...');
    const [payments] = await connection.execute(`
      SELECT sp.*, u.email 
      FROM stripe_payments sp 
      LEFT JOIN users u ON sp.user_id = u.id 
      ORDER BY sp.created_at DESC 
      LIMIT 10
    `);
    console.log('   📊 Recent Stripe payments:');
    payments.forEach(payment => {
      console.log(`      ${payment.created_at}: User ${payment.user_id} (${payment.email}) - $${payment.amount_cents/100} for ${payment.credits_purchased} credits - Status: ${payment.status}, Allocated: ${payment.credits_allocated}`);
    });
    
    // 6. Check for specific user (demo user)
    console.log('\n6️⃣ Checking demo user specifically...');
    const [demoUser] = await connection.execute(`
      SELECT * FROM users WHERE email = 'demo@example.com' OR username = 'demo' LIMIT 1
    `);
    
    if (demoUser.length > 0) {
      const userId = demoUser[0].id;
      console.log(`   👤 Demo user found: ID ${userId}, Email: ${demoUser[0].email}`);
      
      // Check demo user credits
      const [demoCredits] = await connection.execute(`
        SELECT * FROM user_credits WHERE user_id = ?
      `, [userId]);
      
      if (demoCredits.length > 0) {
        console.log(`   💰 Demo user credits: Total=${demoCredits[0].total_credits}, Used=${demoCredits[0].used_credits}, Available=${demoCredits[0].available_credits}`);
      } else {
        console.log('   ❌ No credit record found for demo user');
      }
      
      // Check demo user transactions
      const [demoTransactions] = await connection.execute(`
        SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
      `, [userId]);
      
      console.log(`   📋 Demo user transactions (${demoTransactions.length}):`);
      demoTransactions.forEach(tx => {
        console.log(`      ${tx.created_at}: ${tx.type} ${tx.amount} credits (${tx.balance_before} → ${tx.balance_after}) - ${tx.description}`);
      });
      
      // Check demo user payments
      const [demoPayments] = await connection.execute(`
        SELECT * FROM stripe_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
      `, [userId]);
      
      console.log(`   💳 Demo user payments (${demoPayments.length}):`);
      demoPayments.forEach(payment => {
        console.log(`      ${payment.created_at}: $${payment.amount_cents/100} for ${payment.credits_purchased} credits - Status: ${payment.status}, Allocated: ${payment.credits_allocated}`);
      });
    } else {
      console.log('   ❌ Demo user not found');
    }
    
    // 7. Check for any inconsistencies
    console.log('\n7️⃣ Checking for data inconsistencies...');
    
    // Check for payments that succeeded but credits not allocated
    const [unallocatedPayments] = await connection.execute(`
      SELECT sp.*, u.email 
      FROM stripe_payments sp 
      LEFT JOIN users u ON sp.user_id = u.id 
      WHERE sp.status = 'succeeded' AND sp.credits_allocated = FALSE
    `);
    
    if (unallocatedPayments.length > 0) {
      console.log('   ⚠️ Found succeeded payments with unallocated credits:');
      unallocatedPayments.forEach(payment => {
        console.log(`      Payment ${payment.stripe_payment_intent_id}: User ${payment.user_id} (${payment.email}) - ${payment.credits_purchased} credits not allocated`);
      });
    } else {
      console.log('   ✅ No unallocated successful payments found');
    }
    
    // Check for negative balances
    const [negativeBalances] = await connection.execute(`
      SELECT uc.*, u.email 
      FROM user_credits uc 
      LEFT JOIN users u ON uc.user_id = u.id 
      WHERE uc.available_credits < 0
    `);
    
    if (negativeBalances.length > 0) {
      console.log('   ⚠️ Found users with negative balances:');
      negativeBalances.forEach(credit => {
        console.log(`      User ${credit.user_id} (${credit.email}): Available=${credit.available_credits}`);
      });
    } else {
      console.log('   ✅ No negative balances found');
    }
    
    connection.release();
    console.log('\n✅ Credit system debug complete!');
    
  } catch (error) {
    console.error('❌ Error debugging credit system:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugCreditIssue();
