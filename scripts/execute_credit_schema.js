const fs = require('fs');
const path = require('path');
const pool = require('../config/DBConnection');

async function executeCreditSchema() {
  let connection;
  
  try {
    console.log('🚀 Executing Credit System Schema...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'credit_system_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Remove comments and split SQL statements by semicolon
    const cleanedContent = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    const statements = cleanedContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    connection = await pool.getConnection();
    
    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.length === 0) continue;
      
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        console.log(`📝 ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        await connection.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
        
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_KEYNAME' ||
            error.message.includes('already exists')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          console.error(`📝 Statement: ${statement}`);
          // Continue with other statements instead of failing completely
        }
      }
    }
    
    console.log('🎉 Credit System Schema execution completed!');
    
    // Verify tables were created
    console.log('🔍 Verifying created tables...');
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
    
    console.log('📋 Created tables:');
    tables.forEach(table => {
      console.log(`  ✅ ${table.TABLE_NAME}`);
    });
    
    if (tables.length === 7) {
      console.log('🎉 All credit system tables created successfully!');
    } else {
      console.log(`⚠️  Only ${tables.length}/7 tables were created`);
    }
    
  } catch (error) {
    console.error('❌ Error executing credit schema:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log('🔓 Database connection released');
    }
  }
}

// Run the script
if (require.main === module) {
  executeCreditSchema()
    .then(() => {
      console.log('✅ Schema execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema execution failed:', error);
      process.exit(1);
    });
}

module.exports = executeCreditSchema;
