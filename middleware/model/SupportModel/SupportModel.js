const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require("uuid");

// Retry database operation helper
async function retryDbOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Get all support tickets for a user
async function getAllSupportTickets(userId, filters = {}) {
  return await retryDbOperation(async () => {
    // Build query step by step to avoid any issues
    const baseQuery = `
      SELECT
        st.id, st.user_id, st.ticket_id, st.title, st.description,
        st.category, st.priority, st.status, st.assigned_to,
        st.attachments, st.tags, st.metadata, st.created_at,
        st.updated_at, st.resolved_at, st.closed_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        au.first_name as assigned_first_name,
        au.last_name as assigned_last_name,
        au.email as assigned_email,
        COALESCE((
          SELECT COUNT(*)
          FROM support_ticket_messages stm
          WHERE stm.ticket_id = st.id AND stm.is_internal = FALSE
        ), 0) as message_count
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users au ON st.assigned_to = au.id
      WHERE st.user_id = ?`;

    let sql = baseQuery;
    let params = [userId];

    // Add filters
    if (filters.status) {
      sql += ` AND st.status = ?`;
      params.push(filters.status);
    }

    if (filters.category) {
      sql += ` AND st.category = ?`;
      params.push(filters.category);
    }

    if (filters.priority) {
      sql += ` AND st.priority = ?`;
      params.push(filters.priority);
    }

    if (filters.search) {
      sql += ` AND (st.title LIKE ? OR st.description LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.assigned_to) {
      sql += ` AND st.assigned_to = ?`;
      params.push(filters.assigned_to);
    }

    if (filters.date_from) {
      sql += ` AND st.created_at >= ?`;
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += ` AND st.created_at <= ?`;
      params.push(filters.date_to);
    }

    sql += ` ORDER BY st.created_at DESC`;

    // Only add LIMIT if explicitly provided and valid
    if (filters.limit && !isNaN(parseInt(filters.limit)) && parseInt(filters.limit) > 0) {
      sql += ` LIMIT ${parseInt(filters.limit)}`;  // Use direct substitution instead of parameter
    }

    const [rows] = await pool.execute(sql, params);
    return rows;
  });
}

// Get support ticket by ID (with user isolation)
async function getSupportTicketById(ticketId, userId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        st.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        au.first_name as assigned_first_name,
        au.last_name as assigned_last_name,
        au.email as assigned_email,
        COALESCE((
          SELECT COUNT(*)
          FROM support_ticket_messages stm
          WHERE stm.ticket_id = st.id AND stm.is_internal = FALSE
        ), 0) as message_count
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users au ON st.assigned_to = au.id
      WHERE st.ticket_id = ? AND st.user_id = ?
    `;
    
    const [rows] = await pool.execute(sql, [ticketId, userId]);
    return rows[0];
  });
}

// Create support ticket
async function createSupportTicket(ticketData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      title,
      description,
      category = 'general',
      priority = 'medium',
      attachments = [],
      tags = [],
      metadata = {}
    } = ticketData;

    const ticket_id = uuidv4();

    const insertSQL = `
      INSERT INTO support_tickets (
        user_id, ticket_id, title, description, category, priority,
        attachments, tags, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await pool.execute(insertSQL, [
      user_id,
      ticket_id,
      title,
      description,
      category,
      priority,
      JSON.stringify(attachments),
      JSON.stringify(tags),
      JSON.stringify(metadata)
    ]);

    // Create history entry
    await createTicketHistory(result.insertId, user_id, 'created', null, 'open', 'Ticket created');

    return {
      id: result.insertId,
      ticket_id,
      affectedRows: result.affectedRows
    };
  });
}

// Update support ticket
async function updateSupportTicket(ticketId, userId, updates) {
  return await retryDbOperation(async () => {
    // First get the current ticket to track changes
    let currentTicket;
    if (userId === null) {
      // Super admin case - no user restriction
      currentTicket = await getSupportTicketByIdForAdmin(ticketId);
    } else {
      // Regular user case - with user restriction
      currentTicket = await getSupportTicketById(ticketId, userId);
    }

    if (!currentTicket) {
      throw new Error('Ticket not found or access denied');
    }

    const allowedFields = ['title', 'description', 'category', 'priority', 'status', 'attachments', 'tags', 'metadata'];
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        
        if (key === 'attachments' || key === 'tags' || key === 'metadata') {
          updateValues.push(JSON.stringify(updates[key]));
        } else {
          updateValues.push(updates[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      return { affectedRows: 0 };
    }

    updateFields.push('updated_at = NOW()');
    
    // Handle status changes
    if (updates.status === 'resolved' && currentTicket.status !== 'resolved') {
      updateFields.push('resolved_at = NOW()');
    } else if (updates.status === 'closed' && currentTicket.status !== 'closed') {
      updateFields.push('closed_at = NOW()');
    }

    let sql;
    if (userId === null) {
      // Super admin case - no user restriction
      sql = `
        UPDATE support_tickets
        SET ${updateFields.join(', ')}
        WHERE ticket_id = ?
      `;
      updateValues.push(ticketId);
    } else {
      // Regular user case - with user restriction
      sql = `
        UPDATE support_tickets
        SET ${updateFields.join(', ')}
        WHERE ticket_id = ? AND user_id = ?
      `;
      updateValues.push(ticketId, userId);
    }

    const [result] = await pool.execute(sql, updateValues);

    // Create history entries for changes
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && currentTicket[key] !== value) {
        let action = 'status_changed';
        if (key === 'priority') action = 'priority_changed';
        if (key === 'category') action = 'category_changed';
        
        await createTicketHistory(
          currentTicket.id, 
          userId, 
          action, 
          currentTicket[key], 
          value, 
          `${key} changed from ${currentTicket[key]} to ${value}`
        );
      }
    }

    return { affectedRows: result.affectedRows };
  });
}

// Delete support ticket
async function deleteSupportTicket(ticketId, userId) {
  return await retryDbOperation(async () => {
    const sql = `DELETE FROM support_tickets WHERE ticket_id = ? AND user_id = ?`;
    const [result] = await pool.execute(sql, [ticketId, userId]);
    return { affectedRows: result.affectedRows };
  });
}

// Get ticket messages
async function getTicketMessages(ticketId, userId) {
  return await retryDbOperation(async () => {
    let ticket;

    if (userId === null) {
      // Super admin case - no user restriction
      ticket = await getSupportTicketByIdForAdmin(ticketId);
    } else {
      // Regular user case - with user restriction
      ticket = await getSupportTicketById(ticketId, userId);
    }

    if (!ticket) {
      throw new Error('Ticket not found or access denied');
    }

    const sql = `
      SELECT
        stm.*,
        u.first_name,
        u.last_name,
        u.email
      FROM support_ticket_messages stm
      LEFT JOIN users u ON stm.user_id = u.id
      WHERE stm.ticket_id = ? AND stm.is_internal = FALSE
      ORDER BY stm.created_at ASC
    `;

    const [rows] = await pool.execute(sql, [ticket.id]);
    return rows;
  });
}

// Add message to ticket
async function addTicketMessage(ticketId, userId, messageData) {
  return await retryDbOperation(async () => {
    // First verify user has access to this ticket
    const ticket = await getSupportTicketById(ticketId, userId);
    if (!ticket) {
      throw new Error('Ticket not found or access denied');
    }

    const {
      message,
      message_type = 'user_message',
      attachments = [],
      metadata = {}
    } = messageData;

    const message_id = uuidv4();

    const insertSQL = `
      INSERT INTO support_ticket_messages (
        ticket_id, user_id, message_id, message, message_type,
        attachments, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await pool.execute(insertSQL, [
      ticket.id,
      userId,
      message_id,
      message,
      message_type,
      JSON.stringify(attachments),
      JSON.stringify(metadata)
    ]);

    return {
      id: result.insertId,
      message_id,
      affectedRows: result.affectedRows
    };
  });
}

// Create ticket history entry
async function createTicketHistory(ticketId, userId, action, oldValue, newValue, notes) {
  return await retryDbOperation(async () => {
    const sql = `
      INSERT INTO support_ticket_history (
        ticket_id, user_id, action, old_value, new_value, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(sql, [
      ticketId, userId, action, oldValue, newValue, notes
    ]);

    return { affectedRows: result.affectedRows };
  });
}

// Get support categories
async function getSupportCategories() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM support_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC, name ASC
    `;
    
    const [rows] = await pool.execute(sql);
    return rows;
  });
}

// ============ ADMIN FUNCTIONS ============

// Get all support tickets for admin (no user isolation) - WORKING VERSION
async function getAllSupportTicketsForAdmin(filters = {}) {
  return await retryDbOperation(async () => {
    console.log('getAllSupportTicketsForAdmin called with filters:', filters);

    // Simple query without complex filtering for now
    const baseQuery = `
      SELECT
        st.id, st.user_id, st.ticket_id, st.title, st.description,
        st.category, st.priority, st.status, st.assigned_to,
        st.attachments, st.tags, st.metadata, st.created_at,
        st.updated_at, st.resolved_at, st.closed_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        au.first_name as assigned_first_name,
        au.last_name as assigned_last_name,
        au.email as assigned_email,
        COALESCE((
          SELECT COUNT(*)
          FROM support_ticket_messages stm
          WHERE stm.ticket_id = st.id AND stm.is_internal = FALSE
        ), 0) as message_count
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users au ON st.assigned_to = au.id
      ORDER BY st.created_at DESC
      LIMIT 50
    `;

    console.log('Executing simplified admin query:', baseQuery);
    const [rows] = await pool.execute(baseQuery);
    console.log('Query executed successfully, rows:', rows.length);

    // Parse JSON fields with error handling
    return rows.map(row => {
      const parseJsonField = (field, defaultValue) => {
        try {
          if (!field || field.trim() === '') {
            return defaultValue;
          }
          return JSON.parse(field);
        } catch (error) {
          console.warn(`Failed to parse JSON field:`, field, error.message);
          return defaultValue;
        }
      };

      return {
        ...row,
        attachments: parseJsonField(row.attachments, []),
        tags: parseJsonField(row.tags, []),
        metadata: parseJsonField(row.metadata, {}),
        message_count: row.message_count || 0
      };
    });
  });
}

// Alternative admin function with different name to avoid caching issues
async function getAdminSupportTickets(filters = {}) {
  return await retryDbOperation(async () => {
    console.log('getAdminSupportTickets called with filters:', filters);

    // Simple query without any parameters to avoid SQL errors
    const baseQuery = `
      SELECT
        st.id, st.user_id, st.ticket_id, st.title, st.description,
        st.category, st.priority, st.status, st.assigned_to,
        st.created_at, st.updated_at, st.resolved_at, st.closed_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        au.first_name as assigned_first_name,
        au.last_name as assigned_last_name,
        au.email as assigned_email,
        COALESCE((
          SELECT COUNT(*)
          FROM support_ticket_messages stm
          WHERE stm.ticket_id = st.id AND stm.is_internal = FALSE
        ), 0) as message_count
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users au ON st.assigned_to = au.id
      ORDER BY st.created_at DESC
      LIMIT 50
    `;

    console.log('Executing getAdminSupportTickets query');
    const [rows] = await pool.execute(baseQuery);
    console.log('Query executed successfully, rows:', rows.length);

    // Return rows without JSON parsing to avoid errors
    return rows.map(row => ({
      ...row,
      attachments: [],  // Default empty array
      tags: [],         // Default empty array
      metadata: {},     // Default empty object
      message_count: row.message_count || 0  // Ensure message_count is included
    }));
  });
}

// Get support ticket by ID for admin (no user isolation)
async function getSupportTicketByIdForAdmin(ticketId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        st.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.phone_number as user_phone,
        au.first_name as assigned_first_name,
        au.last_name as assigned_last_name,
        au.email as assigned_email,
        r.name as user_role_name,
        r.display_name as user_role_display_name,
        COALESCE((
          SELECT COUNT(*)
          FROM support_ticket_messages stm
          WHERE stm.ticket_id = st.id AND stm.is_internal = FALSE
        ), 0) as message_count
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users au ON st.assigned_to = au.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE st.ticket_id = ?
    `;

    const [rows] = await pool.execute(sql, [ticketId]);

    if (rows.length > 0) {
      const ticket = rows[0];
      // Parse JSON fields with error handling
      const parseJsonField = (field, defaultValue) => {
        try {
          if (!field || field.trim() === '') {
            return defaultValue;
          }
          return JSON.parse(field);
        } catch (error) {
          console.warn(`Failed to parse JSON field:`, field, error.message);
          return defaultValue;
        }
      };

      ticket.attachments = parseJsonField(ticket.attachments, []);
      ticket.tags = parseJsonField(ticket.tags, []);
      ticket.metadata = parseJsonField(ticket.metadata, {});
      return ticket;
    }

    return null;
  });
}

// Assign ticket to support staff
async function assignTicketToStaff(ticketId, assignedTo, assignedBy) {
  return await retryDbOperation(async () => {
    // First get the current ticket
    const currentTicket = await getSupportTicketByIdForAdmin(ticketId);
    if (!currentTicket) {
      throw new Error('Ticket not found');
    }

    const sql = `
      UPDATE support_tickets
      SET assigned_to = ?, updated_at = NOW()
      WHERE ticket_id = ?
    `;

    const [result] = await pool.execute(sql, [assignedTo, ticketId]);

    // Create history entry
    await createTicketHistory(
      currentTicket.id,
      assignedBy,
      'assigned',
      currentTicket.assigned_to,
      assignedTo,
      `Ticket assigned to staff member`
    );

    return { affectedRows: result.affectedRows };
  });
}

// Update support ticket by admin (no user restriction)
async function updateSupportTicketByAdmin(ticketId, updatedBy, updates) {
  return await retryDbOperation(async () => {
    // First get the current ticket
    const currentTicket = await getSupportTicketByIdForAdmin(ticketId);
    if (!currentTicket) {
      throw new Error('Ticket not found');
    }

    const allowedFields = ['title', 'description', 'category', 'priority', 'status', 'tags', 'metadata'];
    const updateFields = [];
    const updateValues = [];

    // Build update query dynamically
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'tags' || key === 'metadata') {
          updateFields.push(`${key} = ?`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }
    }

    if (updateFields.length === 0) {
      return { affectedRows: 0 };
    }

    updateFields.push('updated_at = NOW()');

    // Handle status changes
    if (updates.status === 'resolved' && currentTicket.status !== 'resolved') {
      updateFields.push('resolved_at = NOW()');
    } else if (updates.status === 'closed' && currentTicket.status !== 'closed') {
      updateFields.push('closed_at = NOW()');
    }

    const sql = `
      UPDATE support_tickets
      SET ${updateFields.join(', ')}
      WHERE ticket_id = ?
    `;

    updateValues.push(ticketId);
    const [result] = await pool.execute(sql, updateValues);

    // Create history entries for changes
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && currentTicket[key] !== value) {
        let action = 'status_changed';
        if (key === 'priority') action = 'priority_changed';
        if (key === 'category') action = 'category_changed';
        if (key === 'title') action = 'title_changed';
        if (key === 'description') action = 'description_changed';

        await createTicketHistory(
          currentTicket.id,
          updatedBy,
          action,
          currentTicket[key],
          value,
          `${key} changed from ${currentTicket[key]} to ${value} (by admin)`
        );
      }
    }

    return { affectedRows: result.affectedRows };
  });
}

// Update ticket status by admin
async function updateTicketStatusByAdmin(ticketId, status, updatedBy, notes = null) {
  return await retryDbOperation(async () => {
    // First get the current ticket
    const currentTicket = await getSupportTicketByIdForAdmin(ticketId);
    if (!currentTicket) {
      throw new Error('Ticket not found');
    }

    let sql = `UPDATE support_tickets SET status = ?, updated_at = NOW()`;
    const params = [status];

    // Set resolved_at or closed_at based on status
    if (status === 'resolved' && currentTicket.status !== 'resolved') {
      sql += `, resolved_at = NOW()`;
    } else if (status === 'closed' && currentTicket.status !== 'closed') {
      sql += `, closed_at = NOW()`;
    }

    sql += ` WHERE ticket_id = ?`;
    params.push(ticketId);

    const [result] = await pool.execute(sql, params);

    // Create history entry
    await createTicketHistory(
      currentTicket.id,
      updatedBy,
      'status_changed',
      currentTicket.status,
      status,
      notes || `Status changed from ${currentTicket.status} to ${status}`
    );

    return { affectedRows: result.affectedRows };
  });
}

// Get support ticket statistics for admin dashboard
async function getSupportTicketStats() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status = 'waiting_response' THEN 1 ELSE 0 END) as waiting_response_tickets,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_tickets,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent_tickets,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority_tickets,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as tickets_last_24h,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as tickets_last_week,
        SUM(CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_tickets,
        SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) as unassigned_tickets
      FROM support_tickets
    `;

    const [rows] = await pool.execute(sql);
    return rows[0];
  });
}

// Get ticket count by category for admin
async function getTicketCountByCategory() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        category,
        COUNT(*) as count,
        SUM(CASE WHEN status IN ('open', 'in_progress', 'waiting_response') THEN 1 ELSE 0 END) as active_count
      FROM support_tickets
      GROUP BY category
      ORDER BY count DESC
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  });
}

// Get recent ticket activity for admin dashboard
async function getRecentTicketActivity(limit = 10) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        sth.id,
        sth.ticket_id,
        sth.action,
        sth.old_value,
        sth.new_value,
        sth.notes,
        sth.created_at,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        st.title as ticket_title
      FROM support_ticket_history sth
      LEFT JOIN users u ON sth.user_id = u.id
      LEFT JOIN support_tickets st ON sth.ticket_id = st.id
      ORDER BY sth.created_at DESC
      LIMIT ?
    `;

    const [rows] = await pool.execute(sql, [limit]);
    return rows;
  });
}

// Get all support staff (users who can be assigned tickets)
async function getAllSupportStaff() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        r.name as role_name,
        r.display_name as role_display_name,
        COUNT(st.id) as assigned_tickets_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN support_tickets st ON u.id = st.assigned_to AND st.status IN ('open', 'in_progress', 'waiting_response')
      WHERE u.is_active = 1
        AND (r.name IN ('super_admin', 'admin', 'support_staff') OR u.role_id = 1)
      GROUP BY u.id, u.first_name, u.last_name, u.email, r.name, r.display_name
      ORDER BY u.first_name, u.last_name
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  });
}

module.exports = {
  getAllSupportTickets,
  getSupportTicketById,
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  getTicketMessages,
  addTicketMessage,
  createTicketHistory,
  getSupportCategories,
  // Admin functions
  getAllSupportTicketsForAdmin,
  getAdminSupportTickets,
  getSupportTicketByIdForAdmin,
  updateSupportTicketByAdmin,
  assignTicketToStaff,
  updateTicketStatusByAdmin,
  getSupportTicketStats,
  getTicketCountByCategory,
  getRecentTicketActivity,
  getAllSupportStaff
};
