const db = require("../config/DBConnection");

async function createWorkflowsTable() {
  try {
    console.log("Creating workflows table...");
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        workflow_id VARCHAR(255) UNIQUE NOT NULL,
        org_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'active',
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_workflow_id (workflow_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `;
    
    await db.query(createTableSQL);
    console.log("✅ Workflows table created successfully");
    
    // Test the table
    const [result] = await db.query("SHOW TABLES LIKE 'workflows'");
    if (result.length > 0) {
      console.log("✅ Workflows table exists and is ready");
    } else {
      console.log("❌ Workflows table was not created");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating workflows table:", error);
    process.exit(1);
  }
}

createWorkflowsTable();
