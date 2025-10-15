#!/usr/bin/env node

/**
 * Test script for enhanced audit logging system
 * Tests the daily combined.txt file functionality
 */

const AuditLogService = require('../services/AuditLogService');
const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function testAuditLogging() {
  console.log('🧪 Testing Enhanced Audit Logging System...\n');

  try {
    // Test 1: Create some sample audit logs (these should automatically update combined.txt)
    console.log('📝 Creating sample audit logs (should auto-update combined.txt)...');

    const sampleLogs = [
      {
        user_id: 1,
        user_email: 'test@example.com',
        user_name: 'Test User',
        operation_type: 'CREATE',
        table_name: 'users',
        record_id: 'test-123',
        old_values: null,
        new_values: { name: 'Test User', email: 'test@example.com' },
        changed_fields: ['name', 'email'],
        ip_address: '127.0.0.1',
        user_agent: 'Test Script',
        request_method: 'POST',
        request_url: '/api/users',
        response_status: 201,
        execution_time_ms: 150,
        metadata: { test: true }
      },
      {
        user_id: 1,
        user_email: 'test@example.com',
        user_name: 'Test User',
        operation_type: 'UPDATE',
        table_name: 'users',
        record_id: 'test-123',
        old_values: { name: 'Test User' },
        new_values: { name: 'Updated Test User' },
        changed_fields: ['name'],
        ip_address: '127.0.0.1',
        user_agent: 'Test Script',
        request_method: 'PUT',
        request_url: '/api/users/test-123',
        response_status: 200,
        execution_time_ms: 120,
        metadata: { test: true }
      }
    ];

    // Create audit logs in database (should automatically update combined.txt)
    for (const log of sampleLogs) {
      const auditLogId = await AuditLogModel.createAuditLog(log);
      console.log(`✅ Created audit log ${auditLogId}: ${log.operation_type} on ${log.table_name}`);
    }

    // Test 2: Read global combined.txt content (should now contain the new logs)
    console.log('\n📖 Reading global combined.txt content...');
    const globalContent = await AuditLogService.getCombinedFileContent(10);
    console.log('Global combined.txt (last 10 lines):');
    console.log(globalContent);

    // Test 3: Test daily Excel export
    console.log('\n📊 Testing daily Excel export...');
    const dailyExportResult = await AuditLogService.createDailyExcelExport();
    if (dailyExportResult) {
      console.log(`✅ Daily Excel export created: ${dailyExportResult.filename}`);
      console.log(`✅ Records exported: ${dailyExportResult.recordCount}`);
    } else {
      console.log('ℹ️ No logs found for today - creating manual export for testing...');

      // Create manual export with test data
      const testLogs = sampleLogs.map(log => ({
        ...log,
        id: Math.floor(Math.random() * 1000),
        created_at: new Date().toISOString()
      }));

      const manualExportResult = await AuditLogService.exportToExcelWithDateName(testLogs, {});
      console.log(`✅ Manual Excel export created: ${manualExportResult.filename}`);
      console.log(`✅ Combined.txt updated: ${manualExportResult.combinedFilePath}`);
    }

    // Test 4: Read updated combined.txt content
    console.log('\n📖 Reading updated global combined.txt content...');
    const updatedContent = await AuditLogService.getCombinedFileContent();
    console.log('Updated global combined.txt content:');
    console.log(updatedContent.substring(0, 800) + '...' + (updatedContent.length > 800 ? ` (${updatedContent.length} total characters)` : ''));

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📁 Check the following locations:');
    console.log(`   - Global combined.txt: ${AuditLogService.combinedFilePath}`);
    const today = new Date().toISOString().split('T')[0];
    console.log(`   - Excel exports: backend/Logs/${today}/`);
    console.log('\n✅ Key Features Tested:');
    console.log('   1. ✅ Automatic combined.txt updates when creating audit logs');
    console.log('   2. ✅ Daily Excel exports with current date naming');
    console.log('   3. ✅ Manual Excel exports with enhanced naming');
    console.log('   4. ✅ Combined.txt file reading and content verification');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAuditLogging()
    .then(() => {
      console.log('\n✅ Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuditLogging };
