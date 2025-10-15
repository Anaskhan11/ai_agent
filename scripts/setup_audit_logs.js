const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  multipleStatements: true
});

async function setupAuditLogs() {
  try {
    console.log('🚀 Setting up audit logs table...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create_audit_logs_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const connection = await pool.getConnection();
    await connection.execute(sql);

    // Add additional indexes separately
    try {
      await connection.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_date_range ON audit_logs (created_at, table_name, operation_type)');
      await connection.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_activity ON audit_logs (user_id, created_at DESC)');
      await connection.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_table_activity ON audit_logs (table_name, created_at DESC)');
      console.log('✅ Additional indexes created successfully!');
    } catch (indexError) {
      console.log('⚠️ Some indexes may already exist:', indexError.message);
    }

    connection.release();
    
    console.log('✅ Audit logs table created successfully!');
    
    // Test the table by inserting a sample record
    const testRecord = {
      user_id: null,
      user_email: 'system@test.com',
      user_name: 'System',
      operation_type: 'CREATE',
      table_name: 'audit_logs',
      record_id: '1',
      old_values: null,
      new_values: JSON.stringify({ message: 'Audit logs table created' }),
      changed_fields: JSON.stringify(['created']),
      ip_address: '127.0.0.1',
      user_agent: 'Setup Script',
      request_method: 'SCRIPT',
      request_url: '/setup',
      request_body: null,
      response_status: 200,
      execution_time_ms: 0,
      error_message: null,
      metadata: JSON.stringify({ setup: true, version: '1.0.0' }),
      session_id: 'setup-session',
      transaction_id: 'setup-transaction'
    };
    
    const insertSql = `
      INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const connection2 = await pool.getConnection();
    await connection2.execute(insertSql, [
      testRecord.user_id, testRecord.user_email, testRecord.user_name,
      testRecord.operation_type, testRecord.table_name, testRecord.record_id,
      testRecord.old_values, testRecord.new_values, testRecord.changed_fields,
      testRecord.ip_address, testRecord.user_agent, testRecord.request_method,
      testRecord.request_url, testRecord.request_body, testRecord.response_status,
      testRecord.execution_time_ms, testRecord.error_message, testRecord.metadata,
      testRecord.session_id, testRecord.transaction_id
    ]);
    connection2.release();
    
    console.log('✅ Test record inserted successfully!');
    
    // Verify the table structure
    const connection3 = await pool.getConnection();
    const [columns] = await connection3.execute('DESCRIBE audit_logs');
    connection3.release();
    
    console.log('📋 Audit logs table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
    console.log('🎉 Audit logs setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up audit logs:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup
setupAuditLogs().catch(console.error);
