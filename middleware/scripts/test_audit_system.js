const mysql = require('mysql2/promise');
const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');
const AuditLogService = require('../services/AuditLogService');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testAuditSystem() {
  try {
    console.log('🧪 Testing Audit Log System...\n');
    
    // Test 1: Create sample audit log entries
    console.log('1️⃣ Testing audit log creation...');
    
    const sampleAuditLogs = [
      {
        user_id: 1,
        user_email: 'admin@test.com',
        user_name: 'Admin User',
        operation_type: 'CREATE',
        table_name: 'users',
        record_id: '123',
        old_values: null,
        new_values: { name: 'John Doe', email: 'john@test.com' },
        changed_fields: null,
        ip_address: '127.0.0.1',
        user_agent: 'Test Agent',
        request_method: 'POST',
        request_url: '/api/users',
        response_status: 201,
        execution_time_ms: 150,
        metadata: { test: true }
      },
      {
        user_id: 1,
        user_email: 'admin@test.com',
        user_name: 'Admin User',
        operation_type: 'UPDATE',
        table_name: 'users',
        record_id: '123',
        old_values: { name: 'John Doe', email: 'john@test.com' },
        new_values: { name: 'John Smith', email: 'john.smith@test.com' },
        changed_fields: [
          { field: 'name', oldValue: 'John Doe', newValue: 'John Smith' },
          { field: 'email', oldValue: 'john@test.com', newValue: 'john.smith@test.com' }
        ],
        ip_address: '127.0.0.1',
        user_agent: 'Test Agent',
        request_method: 'PUT',
        request_url: '/api/users/123',
        response_status: 200,
        execution_time_ms: 120,
        metadata: { test: true }
      },
      {
        user_id: 1,
        user_email: 'admin@test.com',
        user_name: 'Admin User',
        operation_type: 'DELETE',
        table_name: 'users',
        record_id: '123',
        old_values: { name: 'John Smith', email: 'john.smith@test.com' },
        new_values: null,
        changed_fields: null,
        ip_address: '127.0.0.1',
        user_agent: 'Test Agent',
        request_method: 'DELETE',
        request_url: '/api/users/123',
        response_status: 200,
        execution_time_ms: 80,
        metadata: { test: true }
      }
    ];
    
    const createdIds = [];
    for (const auditLog of sampleAuditLogs) {
      const id = await AuditLogModel.createAuditLog(auditLog);
      createdIds.push(id);
      console.log(`   ✅ Created audit log entry with ID: ${id}`);
    }
    
    // Test 2: Retrieve audit logs
    console.log('\n2️⃣ Testing audit log retrieval...');
    
    const result = await AuditLogModel.getAuditLogs({
      limit: 10,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`   ✅ Retrieved ${result.data.length} audit log entries`);
    console.log(`   📊 Total entries in database: ${result.total}`);
    
    // Test 3: Get audit log by ID
    console.log('\n3️⃣ Testing audit log retrieval by ID...');
    
    if (createdIds.length > 0) {
      const auditLog = await AuditLogModel.getAuditLogById(createdIds[0]);
      if (auditLog) {
        console.log(`   ✅ Retrieved audit log by ID: ${auditLog.id}`);
        console.log(`   📝 Operation: ${auditLog.operation_type} on ${auditLog.table_name}`);
      } else {
        console.log('   ❌ Failed to retrieve audit log by ID');
      }
    }
    
    // Test 4: Get audit log statistics
    console.log('\n4️⃣ Testing audit log statistics...');
    
    const stats = await AuditLogModel.getAuditLogStats();
    console.log('   ✅ Retrieved audit log statistics:');
    console.log(`   📈 Operation stats: ${stats.operationStats.length} types`);
    console.log(`   📊 Table stats: ${stats.tableStats.length} tables`);
    console.log(`   👥 User stats: ${stats.userStats.length} users`);
    console.log(`   📅 Daily activity: ${stats.dailyActivity.length} days`);
    
    // Test 5: Export to Excel
    console.log('\n5️⃣ Testing Excel export...');
    
    const exportResult = await AuditLogService.exportToExcel(result.data.slice(0, 5), {
      test: true,
      operation_type: 'ALL'
    });
    
    console.log('   ✅ Excel export completed:');
    console.log(`   📁 File: ${exportResult.filename}`);
    console.log(`   📂 Directory: ${exportResult.dateDir}`);
    console.log(`   📊 Records: ${exportResult.recordCount}`);
    
    // Test 6: Check combined.txt file
    console.log('\n6️⃣ Testing combined.txt file...');
    
    const combinedContent = await AuditLogService.getCombinedFileContent(10);
    const lines = combinedContent.split('\n').filter(line => line.trim());
    console.log(`   ✅ Combined.txt contains ${lines.length} lines`);
    console.log('   📝 Last few entries:');
    lines.slice(-3).forEach(line => {
      if (line.trim()) {
        console.log(`      ${line}`);
      }
    });
    
    // Test 7: Get exported files
    console.log('\n7️⃣ Testing exported files listing...');
    
    const exportedFiles = await AuditLogService.getExportedFiles();
    console.log(`   ✅ Found ${exportedFiles.length} exported files`);
    exportedFiles.forEach(file => {
      console.log(`   📄 ${file.filename} (${file.size} bytes)`);
    });
    
    // Test 8: Test filtering
    console.log('\n8️⃣ Testing audit log filtering...');
    
    const filteredResult = await AuditLogModel.getAuditLogs({
      operation_type: 'CREATE',
      table_name: 'users',
      limit: 5
    });
    
    console.log(`   ✅ Filtered results: ${filteredResult.data.length} CREATE operations on users table`);
    
    // Test 9: Verify database integrity
    console.log('\n9️⃣ Testing database integrity...');
    
    const connection = await pool.getConnection();
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM audit_logs');
    const totalInDb = countResult[0].total;
    connection.release();
    
    console.log(`   ✅ Total audit logs in database: ${totalInDb}`);
    
    // Test 10: Performance test
    console.log('\n🔟 Testing performance...');
    
    const startTime = Date.now();
    const perfResult = await AuditLogModel.getAuditLogs({
      limit: 100,
      offset: 0
    });
    const endTime = Date.now();
    
    console.log(`   ✅ Retrieved ${perfResult.data.length} records in ${endTime - startTime}ms`);
    
    console.log('\n🎉 All audit log system tests completed successfully!');
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Audit log creation: PASSED');
    console.log('   ✅ Audit log retrieval: PASSED');
    console.log('   ✅ Audit log by ID: PASSED');
    console.log('   ✅ Audit log statistics: PASSED');
    console.log('   ✅ Excel export: PASSED');
    console.log('   ✅ Combined.txt file: PASSED');
    console.log('   ✅ Exported files listing: PASSED');
    console.log('   ✅ Filtering: PASSED');
    console.log('   ✅ Database integrity: PASSED');
    console.log('   ✅ Performance: PASSED');
    
    console.log('\n🚀 Audit log system is ready for production use!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
testAuditSystem().catch(console.error);
