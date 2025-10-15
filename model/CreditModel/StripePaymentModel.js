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

// Create stripe payment record
async function createStripePayment(paymentData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      stripe_payment_intent_id,
      stripe_customer_id = null,
      package_id,
      amount_cents,
      currency = 'USD',
      status = 'pending',
      credits_purchased,
      payment_method_id = null,
      metadata = {}
    } = paymentData;

    const payment_id = uuidv4();

    const sql = `
      INSERT INTO stripe_payments (
        payment_id, user_id, stripe_payment_intent_id, stripe_customer_id,
        package_id, amount_cents, currency, status, credits_purchased,
        payment_method_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      payment_id,
      user_id,
      stripe_payment_intent_id,
      stripe_customer_id,
      package_id,
      amount_cents,
      currency,
      status,
      credits_purchased,
      payment_method_id,
      JSON.stringify(metadata)
    ]);

    return {
      id: result.insertId,
      payment_id,
      affectedRows: result.affectedRows
    };
  });
}

// Update stripe payment record
async function updateStripePayment(paymentIntentId, updateData) {
  return await retryDbOperation(async () => {
    const allowedFields = [
      'status', 'receipt_url', 'failure_reason', 'refund_amount_cents',
      'credits_allocated', 'processed_at', 'metadata'
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
    updateValues.push(paymentIntentId);

    const sql = `
      UPDATE stripe_payments 
      SET ${updateFields.join(', ')}
      WHERE stripe_payment_intent_id = ?
    `;

    const [result] = await pool.execute(sql, updateValues);
    return {
      affectedRows: result.affectedRows,
      updated: result.affectedRows > 0
    };
  });
}

// Get stripe payment by payment intent ID
async function getStripePaymentByIntentId(paymentIntentId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        sp.*,
        cp.name as package_name,
        cp.description as package_description,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM stripe_payments sp
      LEFT JOIN credit_packages cp ON sp.package_id = cp.package_id
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE sp.stripe_payment_intent_id = ?
    `;

    const [rows] = await pool.execute(sql, [paymentIntentId]);
    
    if (rows.length === 0) return null;
    
    const payment = rows[0];
    return {
      ...payment,
      metadata: payment.metadata ?
        (typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata)
        : null
    };
  });
}

// Get user payment history
async function getUserPaymentHistory(userId, page = 1, limit = 20, status = null) {
  return await retryDbOperation(async () => {
    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        sp.payment_id,
        sp.stripe_payment_intent_id,
        sp.package_id,
        sp.amount_cents,
        sp.currency,
        sp.status,
        sp.credits_purchased,
        sp.credits_allocated,
        sp.receipt_url,
        sp.created_at,
        sp.processed_at,
        cp.name as package_name,
        cp.description as package_description
      FROM stripe_payments sp
      LEFT JOIN credit_packages cp ON sp.package_id = cp.package_id
      WHERE sp.user_id = ?
    `;
    const params = [userId];

    if (status) {
      sql += ' AND sp.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sp.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM stripe_payments WHERE user_id = ?';
    const countParams = [userId];
    
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [countRows] = await pool.execute(countSql, countParams);
    const total = countRows[0].total;

    return {
      payments: rows.map(row => ({
        ...row,
        amount_dollars: row.amount_cents / 100
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });
}

// Get payments pending credit allocation
async function getPendingCreditAllocations() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        sp.*,
        u.email as user_email,
        cp.name as package_name
      FROM stripe_payments sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN credit_packages cp ON sp.package_id = cp.package_id
      WHERE sp.status = 'succeeded' 
        AND sp.credits_allocated = FALSE
      ORDER BY sp.created_at ASC
    `;

    const [rows] = await pool.execute(sql);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ?
        (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
        : null
    }));
  });
}

// Mark credits as allocated
async function markCreditsAllocated(paymentIntentId) {
  return await retryDbOperation(async () => {
    const sql = `
      UPDATE stripe_payments 
      SET credits_allocated = TRUE, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_payment_intent_id = ?
    `;

    const [result] = await pool.execute(sql, [paymentIntentId]);
    return {
      affectedRows: result.affectedRows,
      updated: result.affectedRows > 0
    };
  });
}

// Get payment analytics
async function getPaymentAnalytics(days = 30) {
  return await retryDbOperation(async () => {
    // Revenue analytics
    const revenueSql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as payment_count,
        SUM(amount_cents) as total_revenue_cents,
        SUM(credits_purchased) as total_credits_sold,
        AVG(amount_cents) as avg_payment_amount,
        status
      FROM stripe_payments 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at), status
      ORDER BY date DESC
    `;
    const [revenueRows] = await pool.execute(revenueSql, [days]);

    // Package performance
    const packagePerformanceSql = `
      SELECT 
        sp.package_id,
        cp.name as package_name,
        COUNT(*) as purchase_count,
        SUM(sp.amount_cents) as total_revenue_cents,
        SUM(sp.credits_purchased) as total_credits_sold,
        AVG(sp.amount_cents) as avg_purchase_amount
      FROM stripe_payments sp
      LEFT JOIN credit_packages cp ON sp.package_id = cp.package_id
      WHERE sp.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND sp.status = 'succeeded'
      GROUP BY sp.package_id, cp.name
      ORDER BY total_revenue_cents DESC
    `;
    const [packageRows] = await pool.execute(packagePerformanceSql, [days]);

    // Payment status breakdown
    const statusBreakdownSql = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount_cents) as total_amount_cents,
        AVG(amount_cents) as avg_amount_cents
      FROM stripe_payments 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY status
    `;
    const [statusRows] = await pool.execute(statusBreakdownSql, [days]);

    // Top customers
    const topCustomersSql = `
      SELECT 
        sp.user_id,
        u.email,
        u.first_name,
        u.last_name,
        COUNT(*) as purchase_count,
        SUM(sp.amount_cents) as total_spent_cents,
        SUM(sp.credits_purchased) as total_credits_purchased
      FROM stripe_payments sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND sp.status = 'succeeded'
      GROUP BY sp.user_id, u.email, u.first_name, u.last_name
      ORDER BY total_spent_cents DESC
      LIMIT 10
    `;
    const [customerRows] = await pool.execute(topCustomersSql, [days]);

    return {
      period: `${days} days`,
      dailyRevenue: revenueRows.map(row => ({
        ...row,
        total_revenue_dollars: row.total_revenue_cents / 100,
        avg_payment_dollars: row.avg_payment_amount / 100
      })),
      packagePerformance: packageRows.map(row => ({
        ...row,
        total_revenue_dollars: row.total_revenue_cents / 100,
        avg_purchase_dollars: row.avg_purchase_amount / 100
      })),
      statusBreakdown: statusRows.map(row => ({
        ...row,
        total_amount_dollars: row.total_amount_cents / 100,
        avg_amount_dollars: row.avg_amount_cents / 100
      })),
      topCustomers: customerRows.map(row => ({
        ...row,
        total_spent_dollars: row.total_spent_cents / 100
      }))
    };
  });
}

// Get failed payments for retry
async function getFailedPayments(days = 7) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        sp.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        cp.name as package_name
      FROM stripe_payments sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN credit_packages cp ON sp.package_id = cp.package_id
      WHERE sp.status = 'failed'
        AND sp.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY sp.created_at DESC
    `;

    const [rows] = await pool.execute(sql, [days]);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ?
        (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
        : null,
      amount_dollars: row.amount_cents / 100
    }));
  });
}

module.exports = {
  createStripePayment,
  updateStripePayment,
  getStripePaymentByIntentId,
  getUserPaymentHistory,
  getPendingCreditAllocations,
  markCreditsAllocated,
  getPaymentAnalytics,
  getFailedPayments
};
