const pool = require('../config/DBConnection');

async function checkAuditTable() {
  try {
    console.log('🔍 Checking Audit Logs Table...\n');
    
    // Check if table exists and get structure
    const [tableInfo] = await pool.execute(`
      SELECT COUNT(*) as total_logs 
      FROM audit_logs 
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Total audit logs in database: ${tableInfo[0].total_logs}`);
    
    if (tableInfo[0].total_logs > 0) {
      // Get recent logs directly from database
      const [recentLogs] = await pool.execute(`
        SELECT 
          id,
          user_email,
          operation_type,
          table_name,
          request_method,
          request_url,
          response_status,
          created_at,
          metadata,
          new_values
        FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      console.log(`\n📋 Recent ${recentLogs.length} audit logs:\n`);
      
      recentLogs.forEach((log, index) => {
        console.log(`${index + 1}. ID: ${log.id}`);
        console.log(`   Time: ${log.created_at}`);
        console.log(`   User: ${log.user_email || 'Unknown'}`);
        console.log(`   Operation: ${log.operation_type}`);
        console.log(`   Table: ${log.table_name}`);
        console.log(`   Method: ${log.request_method || 'N/A'}`);
        console.log(`   URL: ${log.request_url || 'N/A'}`);
        console.log(`   Status: ${log.response_status || 'N/A'}`);
        
        // Parse metadata and new_values if they exist
        try {
          if (log.metadata) {
            const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
            if (metadata.authentication_event) {
              console.log(`   🔐 AUTH EVENT: ${metadata.action || 'Unknown'}`);
            }
          }
          
          if (log.new_values) {
            const newValues = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
            if (newValues.action) {
              console.log(`   📝 ACTION: ${newValues.action}`);
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        console.log('');
      });
      
      // Analyze the pattern
      const authLogs = recentLogs.filter(log => 
        log.table_name === 'auth_sessions' || 
        (log.metadata && log.metadata.includes('authentication_event'))
      );
      
      const userLogs = recentLogs.filter(log => log.table_name === 'users');
      
      console.log(`📊 Analysis of recent logs:`);
      console.log(`   - Auth session logs: ${authLogs.length}`);
      console.log(`   - User table logs: ${userLogs.length}`);
      console.log(`   - Other logs: ${recentLogs.length - authLogs.length - userLogs.length}`);
      
      if (userLogs.length > 0) {
        console.log(`\n⚠️ User table logs found:`);
        userLogs.forEach(log => {
          console.log(`   - ${log.request_method} ${log.request_url} (${log.operation_type})`);
        });
      }
      
      // Check for recent login/logout patterns
      const recentAuthLogs = recentLogs.filter(log => {
        try {
          if (log.metadata) {
            const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
            return metadata.authentication_event;
          }
          if (log.new_values) {
            const newValues = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
            return newValues.action === 'LOGIN' || newValues.action === 'LOGOUT';
          }
        } catch (e) {
          return false;
        }
        return false;
      });
      
      if (recentAuthLogs.length > 0) {
        console.log(`\n🔐 Recent authentication logs:`);
        recentAuthLogs.forEach(log => {
          try {
            const newValues = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values;
            console.log(`   - ${newValues.action || 'Unknown'} by ${log.user_email} at ${log.created_at}`);
          } catch (e) {
            console.log(`   - Auth event by ${log.user_email} at ${log.created_at}`);
          }
        });
      }
      
    } else {
      console.log('\n📝 No audit logs found in database');
      console.log('💡 This could mean:');
      console.log('   1. No login/logout has occurred yet');
      console.log('   2. Audit logging is not working');
      console.log('   3. Database connection issue');
    }
    
    // Check table structure
    const [columns] = await pool.execute(`
      DESCRIBE audit_logs
    `);
    
    console.log(`\n🏗️ Audit logs table structure:`);
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(required)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking audit table:', error);
    console.error('Stack trace:', error.stack);
  }
}

checkAuditTable();
