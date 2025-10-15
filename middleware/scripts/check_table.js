const db = require("../config/DBConnection");

async function checkTable() {
  try {
    console.log("Checking workflows table structure...");
    
    const [result] = await db.query("DESCRIBE workflows");
    console.log("Current table structure:");
    console.table(result);
    
    process.exit(0);
  } catch (error) {
    console.error("Error checking table:", error);
    process.exit(1);
  }
}

checkTable();
