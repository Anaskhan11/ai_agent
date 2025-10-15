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

async function fixAuditLogSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('🔍 Checking current audit_logs schema...');
    
    // Check current column definition
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM audit_logs WHERE Field = 'operation_type'"
    );
    
    if (columns.length > 0) {
      console.log('📋 Current operation_type column:', columns[0]);
      
      // Check if it's an ENUM that needs updating
      const currentType = columns[0].Type;
      console.log('🔍 Current type:', currentType);

      if (currentType.includes('enum(')) {
        console.log('🔧 Converting ENUM to VARCHAR(100) to support all operation types...');

        await connection.execute(
          "ALTER TABLE audit_logs MODIFY COLUMN operation_type VARCHAR(100)"
        );

        console.log('✅ Successfully converted operation_type from ENUM to VARCHAR(100)');
      } else if (currentType.includes('varchar(') && !currentType.includes('varchar(100)')) {
        console.log('🔧 Updating operation_type column to VARCHAR(100)...');

        await connection.execute(
          "ALTER TABLE audit_logs MODIFY COLUMN operation_type VARCHAR(100)"
        );

        console.log('✅ Successfully updated operation_type column to VARCHAR(100)');
      } else {
        console.log('ℹ️ Column is already properly sized');
      }
    } else {
      console.log('❌ operation_type column not found');
    }
    
    // Verify the change
    const [updatedColumns] = await connection.execute(
      "SHOW COLUMNS FROM audit_logs WHERE Field = 'operation_type'"
    );
    
    if (updatedColumns.length > 0) {
      console.log('✅ Updated operation_type column:', updatedColumns[0]);
    }
    
  } catch (error) {
    console.error('❌ Error fixing audit log schema:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the fix
fixAuditLogSchema().then(() => {
  console.log('🎉 Schema fix completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Schema fix failed:', error);
  process.exit(1);
});
