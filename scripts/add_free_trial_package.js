const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: '37.27.187.4',
    user: 'root',
    password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
    database: 'ai_agent'
};

async function addFreeTrialPackage() {
    let connection;
    
    try {
        console.log('🔄 Adding free trial credit package...');
        
        // Create database connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected successfully');
        
        // Check if free trial package already exists
        console.log('🔍 Checking if free trial package exists...');
        const [existingPackage] = await connection.execute(`
            SELECT package_id, name, credits_amount, price_cents 
            FROM credit_packages 
            WHERE package_id = 'free_trial'
        `);
        
        if (existingPackage.length > 0) {
            console.log('ℹ️ Free trial package already exists:', existingPackage[0]);
            return;
        }
        
        // Add free trial package
        console.log('➕ Adding free trial package...');
        const [result] = await connection.execute(`
            INSERT INTO credit_packages (
                package_id, 
                name, 
                description, 
                credits_amount, 
                price_cents, 
                currency, 
                is_active, 
                is_popular, 
                bonus_credits, 
                valid_for_days, 
                metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            'free_trial',
            'Free Trial - $10 Credits',
            'Get started with $10 worth of free credits! One-time offer for new users. Card required for verification.',
            1000, // 1000 credits = $10 worth
            0, // $0 price for free trial
            'USD',
            true, // is_active
            false, // is_popular
            0, // no bonus credits
            30, // valid for 30 days
            JSON.stringify({
                is_free_trial: true,
                original_value_cents: 1000, // $10 original value
                promotion_type: 'new_user_trial',
                requires_card_verification: true
            })
        ]);
        
        console.log('✅ Free trial package added successfully!');
        console.log('Package ID:', result.insertId);
        
        // Verify the package was added
        console.log('🔍 Verifying package...');
        const [verifyPackage] = await connection.execute(`
            SELECT * FROM credit_packages WHERE package_id = 'free_trial'
        `);
        
        if (verifyPackage.length > 0) {
            console.log('✅ Verification successful!');
            console.log('Free trial package details:');
            const pkg = verifyPackage[0];
            console.log(`   - Name: ${pkg.name}`);
            console.log(`   - Credits: ${pkg.credits_amount}`);
            console.log(`   - Price: $${pkg.price_cents / 100}`);
            console.log(`   - Valid for: ${pkg.valid_for_days} days`);
            console.log(`   - Metadata: ${pkg.metadata}`);
        } else {
            console.log('⚠️ Verification failed - package not found');
        }
        
        console.log('🎉 Free trial package setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Failed to add free trial package:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the script
addFreeTrialPackage();
