const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require('uuid');

// Retry mechanism for database operations
const retryDbOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Get all active credit packages
async function getAllCreditPackages(includeInactive = false) {
  return await retryDbOperation(async () => {
    let sql = `
      SELECT 
        id,
        package_id,
        name,
        description,
        credits_amount,
        price_cents,
        currency,
        stripe_price_id,
        is_active,
        is_popular,
        bonus_credits,
        valid_for_days,
        metadata,
        created_at,
        updated_at
      FROM credit_packages
    `;
    
    if (!includeInactive) {
      sql += ' WHERE is_active = TRUE';
    }
    
    sql += ' ORDER BY price_cents ASC';
    
    const [rows] = await pool.execute(sql);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata, // MySQL JSON column already returns parsed object
      total_credits: row.credits_amount + (row.bonus_credits || 0),
      price_dollars: row.price_cents / 100
    }));
  });
}

// Get credit package by ID
async function getCreditPackageById(packageId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        id,
        package_id,
        name,
        description,
        credits_amount,
        price_cents,
        currency,
        stripe_price_id,
        is_active,
        is_popular,
        bonus_credits,
        valid_for_days,
        metadata,
        created_at,
        updated_at
      FROM credit_packages 
      WHERE package_id = ?
    `;
    const [rows] = await pool.execute(sql, [packageId]);
    
    if (rows.length === 0) return null;
    
    const package = rows[0];
    return {
      ...package,
      metadata: package.metadata, // MySQL JSON column already returns parsed object
      total_credits: package.credits_amount + (package.bonus_credits || 0),
      price_dollars: package.price_cents / 100
    };
  });
}

// Create new credit package
async function createCreditPackage(packageData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      credits_amount,
      price_cents,
      currency = 'USD',
      stripe_price_id = null,
      is_active = true,
      is_popular = false,
      bonus_credits = 0,
      valid_for_days = null,
      metadata = {}
    } = packageData;

    const package_id = packageData.package_id || uuidv4();

    const sql = `
      INSERT INTO credit_packages (
        package_id, name, description, credits_amount, price_cents, currency,
        stripe_price_id, is_active, is_popular, bonus_credits, valid_for_days, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      package_id,
      name,
      description,
      credits_amount,
      price_cents,
      currency,
      stripe_price_id,
      is_active,
      is_popular,
      bonus_credits,
      valid_for_days,
      JSON.stringify(metadata)
    ]);

    return {
      id: result.insertId,
      package_id,
      affectedRows: result.affectedRows
    };
  });
}

// Update credit package
async function updateCreditPackage(packageId, updateData) {
  return await retryDbOperation(async () => {
    const allowedFields = [
      'name', 'description', 'credits_amount', 'price_cents', 'currency',
      'stripe_price_id', 'is_active', 'is_popular', 'bonus_credits', 
      'valid_for_days', 'metadata'
    ];

    const updateFields = [];
    const updateValues = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        if (key === 'metadata') {
          updateValues.push(JSON.stringify(updateData[key]));
        } else {
          updateValues.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(packageId);

    const sql = `
      UPDATE credit_packages 
      SET ${updateFields.join(', ')}
      WHERE package_id = ?
    `;

    const [result] = await pool.execute(sql, updateValues);
    return {
      affectedRows: result.affectedRows,
      updated: result.affectedRows > 0
    };
  });
}

// Delete credit package (soft delete by setting inactive)
async function deleteCreditPackage(packageId, hardDelete = false) {
  return await retryDbOperation(async () => {
    let sql, params;
    
    if (hardDelete) {
      // Check if package has been purchased
      const [purchaseCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM stripe_payments WHERE package_id = ?',
        [packageId]
      );
      
      if (purchaseCheck[0].count > 0) {
        throw new Error('Cannot delete package that has been purchased. Use soft delete instead.');
      }
      
      sql = 'DELETE FROM credit_packages WHERE package_id = ?';
      params = [packageId];
    } else {
      sql = 'UPDATE credit_packages SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE package_id = ?';
      params = [packageId];
    }

    const [result] = await pool.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      deleted: result.affectedRows > 0
    };
  });
}

// Get package purchase statistics
async function getPackagePurchaseStats(packageId = null, days = 30) {
  return await retryDbOperation(async () => {
    let sql = `
      SELECT 
        cp.package_id,
        cp.name,
        COUNT(sp.id) as total_purchases,
        SUM(sp.credits_purchased) as total_credits_sold,
        SUM(sp.amount_cents) as total_revenue_cents,
        AVG(sp.amount_cents) as avg_purchase_amount,
        DATE(sp.created_at) as purchase_date
      FROM credit_packages cp
      LEFT JOIN stripe_payments sp ON cp.package_id = sp.package_id 
        AND sp.status = 'succeeded'
        AND sp.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const params = [days];

    if (packageId) {
      sql += ' WHERE cp.package_id = ?';
      params.push(packageId);
    }

    sql += `
      GROUP BY cp.package_id, cp.name, DATE(sp.created_at)
      ORDER BY total_purchases DESC, purchase_date DESC
    `;

    const [rows] = await pool.execute(sql, params);
    
    return rows.map(row => ({
      ...row,
      total_revenue_dollars: row.total_revenue_cents ? row.total_revenue_cents / 100 : 0,
      avg_purchase_dollars: row.avg_purchase_amount ? row.avg_purchase_amount / 100 : 0
    }));
  });
}

// Get popular packages (most purchased)
async function getPopularPackages(limit = 5, days = 30) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        cp.*,
        COUNT(sp.id) as purchase_count,
        SUM(sp.credits_purchased) as total_credits_sold,
        SUM(sp.amount_cents) as total_revenue_cents
      FROM credit_packages cp
      LEFT JOIN stripe_payments sp ON cp.package_id = sp.package_id 
        AND sp.status = 'succeeded'
        AND sp.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      WHERE cp.is_active = TRUE
      GROUP BY cp.id
      ORDER BY purchase_count DESC, total_revenue_cents DESC
      LIMIT ?
    `;

    const [rows] = await pool.execute(sql, [days, limit]);
    
    return rows.map(row => ({
      ...row,
      metadata: row.metadata, // MySQL JSON column already returns parsed object
      total_credits: row.credits_amount + (row.bonus_credits || 0),
      price_dollars: row.price_cents / 100,
      total_revenue_dollars: row.total_revenue_cents ? row.total_revenue_cents / 100 : 0
    }));
  });
}

// Set package as popular/featured
async function setPackagePopular(packageId, isPopular = true) {
  return await retryDbOperation(async () => {
    // If setting as popular, remove popular flag from other packages first
    if (isPopular) {
      await pool.execute('UPDATE credit_packages SET is_popular = FALSE');
    }

    const sql = `
      UPDATE credit_packages 
      SET is_popular = ?, updated_at = CURRENT_TIMESTAMP
      WHERE package_id = ?
    `;

    const [result] = await pool.execute(sql, [isPopular, packageId]);
    return {
      affectedRows: result.affectedRows,
      updated: result.affectedRows > 0
    };
  });
}

// Get package recommendations based on user usage
async function getPackageRecommendations(userId) {
  return await retryDbOperation(async () => {
    // Get user's average monthly usage
    const [usageRows] = await pool.execute(`
      SELECT AVG(monthly_usage) as avg_monthly_usage
      FROM (
        SELECT 
          YEAR(created_at) as year,
          MONTH(created_at) as month,
          SUM(credits_consumed) as monthly_usage
        FROM usage_tracking 
        WHERE user_id = ? 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
          AND status = 'completed'
        GROUP BY YEAR(created_at), MONTH(created_at)
      ) monthly_stats
    `, [userId]);

    const avgMonthlyUsage = usageRows[0]?.avg_monthly_usage || 0;

    // Get packages that would cover 1-3 months of usage
    const sql = `
      SELECT 
        *,
        (credits_amount + bonus_credits) as total_credits,
        ROUND((credits_amount + bonus_credits) / ?, 1) as months_coverage
      FROM credit_packages 
      WHERE is_active = TRUE
        AND (credits_amount + bonus_credits) >= ?
      ORDER BY 
        CASE 
          WHEN (credits_amount + bonus_credits) BETWEEN ? AND ? THEN 1
          ELSE 2
        END,
        price_cents ASC
      LIMIT 3
    `;

    const minCredits = Math.max(avgMonthlyUsage * 0.5, 50); // At least 50 credits
    const idealMin = avgMonthlyUsage * 1;
    const idealMax = avgMonthlyUsage * 3;

    const [rows] = await pool.execute(sql, [
      avgMonthlyUsage || 1, 
      minCredits, 
      idealMin, 
      idealMax
    ]);

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? parseMetadata(row.metadata) : null,
      price_dollars: row.price_cents / 100,
      recommendation_reason: row.months_coverage <= 1 ? 'Good for light usage' :
                           row.months_coverage <= 2 ? 'Perfect for regular usage' :
                           'Great value for heavy usage'
    }));
  });
}

module.exports = {
  getAllCreditPackages,
  getCreditPackageById,
  createCreditPackage,
  updateCreditPackage,
  deleteCreditPackage,
  getPackagePurchaseStats,
  getPopularPackages,
  setPackagePopular,
  getPackageRecommendations
};
