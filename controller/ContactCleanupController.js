const pool = require("../config/DBConnection");
const systemAuditLogger = require("../utils/systemAuditLogger");

// Clean up contacts with JSON concatenation in fullName field
const cleanupContactsWithJSON = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Find contacts with JSON data in fullName field
      const [contacts] = await connection.execute(
        `SELECT id, fullName, email, phoneNumber 
         FROM contacts 
         WHERE fullName LIKE '%{%' OR fullName LIKE '%"%'`
      );

      console.log(`Found ${contacts.length} contacts with JSON data in fullName`);

      let cleanedCount = 0;

      for (const contact of contacts) {
        try {
          // Extract clean full name from JSON string
          let cleanFullName = contact.fullName;
          
          // Check if it contains JSON-like data
          if (contact.fullName.includes('"email"') || contact.fullName.includes('"fullName"')) {
            // Try to extract fullName from JSON
            const fullNameMatch = contact.fullName.match(/"fullName":\s*"([^"]+)"/);
            if (fullNameMatch) {
              cleanFullName = fullNameMatch[1];
            } else {
              // Fallback: extract everything before the first | or {
              const parts = contact.fullName.split(/[\|{]/);
              cleanFullName = parts[0].trim();
            }
          } else if (contact.fullName.includes('|')) {
            // Simple pipe separation
            const parts = contact.fullName.split('|');
            cleanFullName = parts[0].trim();
          }

          // Update the contact with clean full name
          if (cleanFullName !== contact.fullName && cleanFullName.length > 0) {
            await connection.execute(
              `UPDATE contacts SET fullName = ? WHERE id = ?`,
              [cleanFullName.substring(0, 250), contact.id]
            );
            cleanedCount++;
            console.log(`Cleaned contact ${contact.id}: "${contact.fullName}" -> "${cleanFullName}"`);
          }
        } catch (error) {
          console.error(`Error cleaning contact ${contact.id}:`, error);
        }
      }

      // Log successful cleanup operation
      await systemAuditLogger.logCleanupOperation(req, 'CONTACT_JSON_CLEANUP', 'contacts', cleanedCount, true);

      res.json({
        success: true,
        message: `Successfully cleaned ${cleanedCount} out of ${contacts.length} contacts`,
        totalFound: contacts.length,
        cleaned: cleanedCount
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error cleaning up contacts:', error);

    // Log failed cleanup operation
    await systemAuditLogger.logCleanupOperation(req, 'CONTACT_JSON_CLEANUP', 'contacts', 0, false, error.message);

    res.status(500).json({
      success: false,
      error: 'Failed to cleanup contacts',
      details: error.message
    });
  }
};

// Preview contacts that need cleanup (without actually cleaning)
const previewContactsCleanup = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      // Find contacts with JSON data in fullName field
      const [contacts] = await connection.execute(
        `SELECT id, fullName, email, phoneNumber 
         FROM contacts 
         WHERE fullName LIKE '%{%' OR fullName LIKE '%"%'
         LIMIT 20`
      );

      const preview = contacts.map(contact => {
        let cleanFullName = contact.fullName;
        
        // Extract clean full name
        if (contact.fullName.includes('"email"') || contact.fullName.includes('"fullName"')) {
          const fullNameMatch = contact.fullName.match(/"fullName":\s*"([^"]+)"/);
          if (fullNameMatch) {
            cleanFullName = fullNameMatch[1];
          } else {
            const parts = contact.fullName.split(/[\|{]/);
            cleanFullName = parts[0].trim();
          }
        } else if (contact.fullName.includes('|')) {
          const parts = contact.fullName.split('|');
          cleanFullName = parts[0].trim();
        }

        return {
          id: contact.id,
          email: contact.email,
          original: contact.fullName,
          cleaned: cleanFullName,
          needsCleaning: cleanFullName !== contact.fullName
        };
      });

      res.json({
        success: true,
        totalFound: contacts.length,
        preview: preview,
        needsCleaningCount: preview.filter(p => p.needsCleaning).length
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error previewing contacts cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview contacts cleanup',
      details: error.message
    });
  }
};

module.exports = {
  cleanupContactsWithJSON,
  previewContactsCleanup
};
