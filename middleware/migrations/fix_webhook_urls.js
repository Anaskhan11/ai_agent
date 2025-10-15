const pool = require('../config/DBConnection');

/**
 * Migration script to fix webhook URLs from /api/webhooks/ to /api/webhook-data/capture/
 * This fixes webhooks created before the URL format fix
 */
async function fixWebhookUrls() {
  console.log('🔧 Starting webhook URL migration...');
  
  const connection = await pool.getConnection();
  try {
    // Find all webhooks with the old URL format
    const [webhooks] = await connection.execute(
      `SELECT id, webhook_id, url FROM webhooks WHERE url LIKE '%/api/webhooks/%'`
    );

    console.log(`📊 Found ${webhooks.length} webhooks with old URL format`);

    if (webhooks.length === 0) {
      console.log('✅ No webhooks need URL migration');
      return;
    }

    // Update each webhook URL
    let updatedCount = 0;
    for (const webhook of webhooks) {
      const oldUrl = webhook.url;
      
      // Extract the webhook ID from the old URL
      const webhookId = webhook.webhook_id;
      
      // Create new URL with correct format
      const baseUrl = process.env.BACKEND_URL || process.env.BASE_URL || 'https://ai.research-hero.com';
      const newUrl = `${baseUrl}/api/webhook-data/capture/${webhookId}`;
      
      // Update the webhook URL in database
      await connection.execute(
        `UPDATE webhooks SET url = ?, updated_at = NOW() WHERE id = ?`,
        [newUrl, webhook.id]
      );
      
      console.log(`✅ Updated webhook ${webhook.id}: ${oldUrl} → ${newUrl}`);
      updatedCount++;
    }

    console.log(`🎉 Successfully updated ${updatedCount} webhook URLs`);
    
  } catch (error) {
    console.error('❌ Error during webhook URL migration:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  fixWebhookUrls()
    .then(() => {
      console.log('✅ Webhook URL migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Webhook URL migration failed:', error);
      process.exit(1);
    });
}

module.exports = { fixWebhookUrls };
