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

async function fixDemoUserCredits() {
  try {
    console.log('🔧 Fixing Demo User Credits...\n');
    
    const connection = await pool.getConnection();
    
    // 1. Find demo user
    console.log('1️⃣ Finding demo user...');
    const [demoUsers] = await connection.execute(`
      SELECT * FROM users WHERE email = 'demo@example.com' OR username = 'demo' LIMIT 1
    `);
    
    if (demoUsers.length === 0) {
      console.log('❌ Demo user not found');
      connection.release();
      return;
    }
    
    const demoUser = demoUsers[0];
    console.log(`✅ Demo user found: ID ${demoUser.id}, Email: ${demoUser.email}`);
    
    // 2. Check if demo user already has credits
    console.log('\n2️⃣ Checking existing credits...');
    const [existingCredits] = await connection.execute(`
      SELECT * FROM user_credits WHERE user_id = ?
    `, [demoUser.id]);
    
    if (existingCredits.length > 0) {
      console.log(`✅ Demo user already has credits: Total=${existingCredits[0].total_credits}, Available=${existingCredits[0].available_credits}`);
      connection.release();
      return;
    }
    
    // 3. Initialize demo user credits
    console.log('\n3️⃣ Initializing demo user credits...');
    const initialCredits = 1000; // Give demo user 1000 credits to start
    
    await connection.execute(`
      INSERT INTO user_credits (user_id, total_credits, used_credits)
      VALUES (?, ?, 0.00)
    `, [demoUser.id, initialCredits]);
    
    console.log(`✅ Initialized ${initialCredits} credits for demo user`);
    
    // 4. Create initial transaction record
    console.log('\n4️⃣ Creating initial transaction record...');
    const transactionId = uuidv4();
    
    await connection.execute(`
      INSERT INTO credit_transactions 
      (transaction_id, user_id, type, amount, balance_before, balance_after, description)
      VALUES (?, ?, 'bonus', ?, 0.00, ?, 'Initial demo user credits')
    `, [transactionId, demoUser.id, initialCredits, initialCredits]);
    
    console.log(`✅ Created transaction record: ${transactionId}`);
    
    // 5. Verify the setup
    console.log('\n5️⃣ Verifying setup...');
    const [verifyCredits] = await connection.execute(`
      SELECT * FROM user_credits WHERE user_id = ?
    `, [demoUser.id]);
    
    const [verifyTransaction] = await connection.execute(`
      SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `, [demoUser.id]);
    
    if (verifyCredits.length > 0 && verifyTransaction.length > 0) {
      console.log(`✅ Verification successful:`);
      console.log(`   💰 Credits: Total=${verifyCredits[0].total_credits}, Available=${verifyCredits[0].available_credits}`);
      console.log(`   📋 Transaction: ${verifyTransaction[0].type} ${verifyTransaction[0].amount} credits`);
    } else {
      console.log('❌ Verification failed');
    }
    
    connection.release();
    console.log('\n✅ Demo user credits fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing demo user credits:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDemoUserCredits();
