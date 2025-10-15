const fs = require('fs-extra');
const path = require('path');

/**
 * Setup Logs Directory Structure
 * Creates the required directory structure for audit log exports
 */

async function setupLogsDirectory() {
  try {
    console.log('🚀 Setting up logs directory structure...');
    
    // Define paths
    const rootDir = process.cwd();
    const logsDir = path.join(rootDir, 'Logs');
    const combinedFilePath = path.join(logsDir, 'combined.txt');
    
    // Create main Logs directory
    await fs.ensureDir(logsDir);
    console.log('✅ Created Logs directory:', logsDir);
    
    // Create combined.txt file with initial content
    const initialContent = `# Audit Logs Combined File
# This file contains a summary of all audit log activities
# Generated on: ${new Date().toISOString()}
# Format: [Timestamp] Operation on Table by User (Record ID) - Status: Response Status

`;
    
    await fs.writeFile(combinedFilePath, initialContent);
    console.log('✅ Created combined.txt file:', combinedFilePath);
    
    // Create current date folder as example
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDateDir = path.join(logsDir, currentDate);
    await fs.ensureDir(currentDateDir);
    console.log('✅ Created current date directory:', currentDateDir);
    
    // Create a sample Excel file to test the structure
    const sampleExcelPath = path.join(currentDateDir, 'sample_audit_logs.xlsx');
    const sampleContent = `Sample Excel file created on ${new Date().toISOString()}`;
    await fs.writeFile(sampleExcelPath, sampleContent);
    console.log('✅ Created sample Excel file:', sampleExcelPath);
    
    // Create .gitkeep files to ensure directories are tracked in git
    await fs.writeFile(path.join(logsDir, '.gitkeep'), '');
    await fs.writeFile(path.join(currentDateDir, '.gitkeep'), '');
    console.log('✅ Created .gitkeep files for version control');
    
    // Create README file with instructions
    const readmeContent = `# Audit Logs Directory

This directory contains audit log exports and combined log files.

## Structure:
- \`combined.txt\` - Contains a summary of all audit log activities
- \`YYYY-MM-DD/\` - Date-based folders containing Excel exports for each day
  - \`audit_logs_TIMESTAMP.xlsx\` - Excel files with detailed audit log data

## Files:
- Excel files contain detailed audit log information including:
  - User information (ID, email, name)
  - Operation details (type, table, record ID)
  - Request/response information
  - Timestamps and execution times
  - Old and new values for updates
  - Changed fields tracking

## Automatic Management:
- New date folders are created automatically when exporting logs
- Combined.txt is updated automatically with each export
- Old files can be cleaned up using the API cleanup endpoint

## API Endpoints:
- GET /api/audit-logs/export - Export logs to Excel
- GET /api/audit-logs/download/:filename - Download exported files
- DELETE /api/audit-logs/cleanup - Clean up old logs

Generated on: ${new Date().toISOString()}
`;
    
    const readmePath = path.join(logsDir, 'README.md');
    await fs.writeFile(readmePath, readmeContent);
    console.log('✅ Created README.md file:', readmePath);
    
    // Verify the structure
    console.log('\n📋 Directory structure created:');
    console.log(`${logsDir}/`);
    console.log(`├── combined.txt`);
    console.log(`├── README.md`);
    console.log(`├── .gitkeep`);
    console.log(`└── ${currentDate}/`);
    console.log(`    ├── sample_audit_logs.xlsx`);
    console.log(`    └── .gitkeep`);
    
    // Test directory permissions
    try {
      const testFile = path.join(logsDir, 'test_permissions.tmp');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      console.log('✅ Directory permissions verified');
    } catch (permError) {
      console.warn('⚠️ Warning: Directory permission test failed:', permError.message);
    }
    
    console.log('\n🎉 Logs directory structure setup completed successfully!');
    
    return {
      logsDir,
      combinedFilePath,
      currentDateDir,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error setting up logs directory:', error);
    throw error;
  }
}

// Helper function to create date-based directory
async function createDateDirectory(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logsDir = path.join(process.cwd(), 'Logs');
    const dateDir = path.join(logsDir, targetDate);
    
    await fs.ensureDir(dateDir);
    console.log(`✅ Created/ensured date directory: ${dateDir}`);
    
    return dateDir;
  } catch (error) {
    console.error('❌ Error creating date directory:', error);
    throw error;
  }
}

// Helper function to ensure logs directory exists
async function ensureLogsDirectory() {
  try {
    const logsDir = path.join(process.cwd(), 'Logs');
    await fs.ensureDir(logsDir);
    
    // Ensure combined.txt exists
    const combinedFilePath = path.join(logsDir, 'combined.txt');
    if (!await fs.pathExists(combinedFilePath)) {
      const initialContent = `# Audit Logs Combined File
# This file contains a summary of all audit log activities
# Generated on: ${new Date().toISOString()}

`;
      await fs.writeFile(combinedFilePath, initialContent);
    }
    
    return logsDir;
  } catch (error) {
    console.error('❌ Error ensuring logs directory:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  setupLogsDirectory,
  createDateDirectory,
  ensureLogsDirectory
};

// Run setup if called directly
if (require.main === module) {
  setupLogsDirectory().catch(console.error);
}
