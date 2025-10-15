const pool = require('../config/DBConnection');

async function fixAuditOperationTypeEnum() {
  try {
    console.log('🔧 Starting audit_logs operation_type ENUM fix...');
    
    // First, let's check the current ENUM values
    const [currentEnum] = await pool.execute(`
      SELECT column_type 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'audit_logs' 
      AND column_name = 'operation_type'
    `);
    
    console.log('Current ENUM values:', currentEnum[0]?.COLUMN_TYPE);
    
    // Update the ENUM to include all missing operation types
    // We'll include all values that the middleware might generate
    const alterTableSQL = `
      ALTER TABLE audit_logs 
      MODIFY COLUMN operation_type ENUM(
        'CREATE', 
        'UPDATE', 
        'DELETE', 
        'READ', 
        'LOGIN', 
        'LOGOUT', 
        'REGISTER', 
        'VERIFY', 
        'EXPORT', 
        'DOWNLOAD', 
        'AUTHENTICATE'
      ) NULL DEFAULT NULL
    `;
    
    console.log('📋 Executing SQL:', alterTableSQL);
    
    await pool.execute(alterTableSQL);
    
    console.log('✅ Successfully updated operation_type ENUM');
    
    // Verify the change
    const [updatedEnum] = await pool.execute(`
      SELECT column_type 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'audit_logs' 
      AND column_name = 'operation_type'
    `);
    
    console.log('Updated ENUM values:', updatedEnum[0]?.COLUMN_TYPE);
    
    // Test the fix by checking if we can insert all operation types
    const testOperations = [
      'CREATE', 'UPDATE', 'DELETE', 'READ', 
      'LOGIN', 'LOGOUT', 'REGISTER', 'VERIFY', 
      'EXPORT', 'DOWNLOAD', 'AUTHENTICATE'
    ];
    
    console.log('🧪 Testing all operation types...');
    
    for (const operation of testOperations) {
      try {
        await pool.execute(`
          INSERT INTO audit_logs (
            operation_type, 
            table_name, 
            request_method, 
            request_url
          ) VALUES (?, 'test_table', 'POST', '/api/test')
        `, [operation]);
        console.log(`✅ ${operation}: OK`);
      } catch (error) {
        console.error(`❌ ${operation}: FAILED - ${error.message}`);
      }
    }
    
    // Clean up test records
    await pool.execute("DELETE FROM audit_logs WHERE table_name = 'test_table'");
    console.log('🧹 Cleaned up test records');
    
    console.log('🎉 ENUM fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing ENUM:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

fixAuditOperationTypeEnum();
