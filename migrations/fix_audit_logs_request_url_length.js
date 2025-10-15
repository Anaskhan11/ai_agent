const pool = require('../config/DBConnection');

async function fixAuditLogsRequestUrlLength() {
  try {
    console.log('🔧 Starting audit_logs request_url column length fix...');
    
    // Check current column definition
    const [currentColumn] = await pool.execute(`
      SELECT column_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'audit_logs' 
      AND column_name = 'request_url'
    `);
    
    console.log('Current request_url column:', currentColumn[0]);
    
    // Update the column to allow longer URLs (2000 characters should be enough)
    const alterTableSQL = `
      ALTER TABLE audit_logs 
      MODIFY COLUMN request_url VARCHAR(2000)
    `;
    
    console.log('📋 Executing SQL:', alterTableSQL);
    
    await pool.execute(alterTableSQL);
    
    console.log('✅ Successfully updated request_url column length');
    
    // Verify the change
    const [updatedColumn] = await pool.execute(`
      SELECT column_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'audit_logs' 
      AND column_name = 'request_url'
    `);
    
    console.log('Updated request_url column:', updatedColumn[0]);
    
    console.log('🎉 Column length fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing column length:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

fixAuditLogsRequestUrlLength();
