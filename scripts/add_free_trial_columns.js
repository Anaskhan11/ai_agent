const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: '37.27.187.4',
    user: 'root',
    password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
    database: 'ai_agent'
};

async function addFreeTrialColumns() {
    let connection;
    
    try {
        console.log('🔄 Starting free trial columns addition...');
        
        // Create database connection
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connected successfully');
        
        // Check if columns already exist
        console.log('🔍 Checking existing columns...');
        const [existingColumns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'ai_agent' 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME IN ('has_used_free_trial', 'free_trial_claimed_at')
        `);
        
        console.log('Existing columns:', existingColumns.map(col => col.COLUMN_NAME));
        
        // Add has_used_free_trial column if it doesn't exist
        if (!existingColumns.some(col => col.COLUMN_NAME === 'has_used_free_trial')) {
            console.log('➕ Adding has_used_free_trial column...');
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN has_used_free_trial BOOLEAN DEFAULT FALSE 
                COMMENT 'TRUE if user has already claimed their free $10 trial package'
            `);
            console.log('✅ has_used_free_trial column added');
        } else {
            console.log('ℹ️ has_used_free_trial column already exists');
        }
        
        // Add free_trial_claimed_at column if it doesn't exist
        if (!existingColumns.some(col => col.COLUMN_NAME === 'free_trial_claimed_at')) {
            console.log('➕ Adding free_trial_claimed_at column...');
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN free_trial_claimed_at DATETIME NULL 
                COMMENT 'When the user claimed their free trial package'
            `);
            console.log('✅ free_trial_claimed_at column added');
        } else {
            console.log('ℹ️ free_trial_claimed_at column already exists');
        }
        
        // Verify the columns were added
        console.log('🔍 Verifying columns...');
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'ai_agent' 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME IN ('has_used_free_trial', 'free_trial_claimed_at')
            ORDER BY COLUMN_NAME
        `);
        
        if (columns.length >= 2) {
            console.log('✅ Verification successful!');
            console.log('Free trial columns:');
            columns.forEach(col => {
                console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}) - ${col.COLUMN_COMMENT}`);
            });
        } else {
            console.log('⚠️ Verification failed. Found columns:', columns);
        }
        
        console.log('🎉 Free trial columns addition completed successfully!');
        
    } catch (error) {
        console.error('❌ Failed to add columns:', error.message);
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
addFreeTrialColumns();
