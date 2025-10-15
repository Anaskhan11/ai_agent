const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function debugAuditQuery() {
  try {
    console.log('🔍 Debugging audit log query...\n');
    
    // Test the exact same query that the frontend is making
    const filters = {
      limit: 50,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    };
    
    console.log('📋 Testing with filters:', filters);
    
    const result = await AuditLogModel.getAuditLogs(filters);
    
    console.log('✅ Query successful!');
    console.log(`📊 Total records: ${result.total}`);
    console.log(`📄 Records returned: ${result.data.length}`);
    console.log(`📖 Pagination:`, result.pagination || 'No pagination info');
    
    if (result.data.length > 0) {
      console.log('\n📝 Sample record:');
      const sample = result.data[0];
      console.log(`   ID: ${sample.id}`);
      console.log(`   User: ${sample.user_email || 'N/A'}`);
      console.log(`   Operation: ${sample.operation_type}`);
      console.log(`   Table: ${sample.table_name}`);
      console.log(`   Created: ${sample.created_at}`);
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugAuditQuery();
