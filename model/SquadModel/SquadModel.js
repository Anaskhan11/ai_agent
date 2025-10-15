const db = require("../../config/DBConnection");

// Retry function for database operations
async function retryDbOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Check if it's a connection error that might be retryable
      if (error.code === 'ECONNRESET' ||
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT') {
        console.log(`Retrying database operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }

      // If it's not a retryable error, throw immediately
      throw error;
    }
  }
}

// Create squad
async function createSquad(squadData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      squad_id,
      org_id,
      name,
      description,
      members,
      routing_strategy = 'round_robin',
      escalation_rules,
      availability_schedule,
      max_concurrent_calls,
      priority_levels,
      skills_required,
      performance_metrics,
      status = 'active',
      metadata = {}
    } = squadData;

    const insertSQL = `
      INSERT INTO squads (
        user_id, squad_id, org_id, name, description, members,
        routing_strategy, escalation_rules, availability_schedule,
        max_concurrent_calls, priority_levels, skills_required,
        performance_metrics, status, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id,
      squad_id,
      org_id,
      name,
      description,
      JSON.stringify(members || []),
      routing_strategy,
      JSON.stringify(escalation_rules || {}),
      JSON.stringify(availability_schedule || {}),
      max_concurrent_calls || 10,
      JSON.stringify(priority_levels || []),
      JSON.stringify(skills_required || []),
      JSON.stringify(performance_metrics || {}),
      status,
      JSON.stringify(metadata)
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

// Get squads with pagination and filtering
async function getSquads(page, limit, search = "", status = "", user_id = null) {
  return await retryDbOperation(async () => {
    let values = [];
    let whereConditions = [];

    // Build WHERE conditions
    if (search) {
      whereConditions.push("(name LIKE ? OR description LIKE ?)");
      values.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereConditions.push("status = ?");
      values.push(status);
    }

    if (user_id) {
      whereConditions.push("user_id = ?");
      values.push(user_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM squads ${whereClause}`;
    const [totalRows] = await db.query(countQuery, values);
    const totalSquads = totalRows[0]?.total || 0;

    // Calculate pagination
    const totalPages = Math.ceil(totalSquads / limit);
    const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (adjustedPage - 1) * limit;

    // Main query with member count
    const selectQuery = `
      SELECT s.*, 
             JSON_LENGTH(s.members) as member_count,
             (SELECT COUNT(*) FROM calls WHERE squad_id = s.squad_id AND status = 'active') as active_calls
      FROM squads s
      ${whereClause}
      ORDER BY s.updated_at DESC 
      LIMIT ? OFFSET ?
    `;

    const [squads] = await db.query(selectQuery, [...values, limit, offset]);

    return {
      squads,
      pagination: {
        currentPage: adjustedPage,
        totalPages,
        totalItems: totalSquads,
        itemsPerPage: limit,
        hasNextPage: adjustedPage < totalPages,
        hasPrevPage: adjustedPage > 1
      }
    };
  });
}

// Get squad by ID
async function getSquadById(squad_id) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT s.*, 
             JSON_LENGTH(s.members) as member_count,
             (SELECT COUNT(*) FROM calls WHERE squad_id = s.squad_id AND status = 'active') as active_calls
      FROM squads s 
      WHERE s.squad_id = ?
    `;
    const [result] = await db.query(sql, [squad_id]);
    return result[0] || null;
  });
}

// Update squad
async function updateSquad(squad_id, updateData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      members,
      routing_strategy,
      escalation_rules,
      availability_schedule,
      max_concurrent_calls,
      priority_levels,
      skills_required,
      performance_metrics,
      status,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE squads SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        members = COALESCE(?, members),
        routing_strategy = COALESCE(?, routing_strategy),
        escalation_rules = COALESCE(?, escalation_rules),
        availability_schedule = COALESCE(?, availability_schedule),
        max_concurrent_calls = COALESCE(?, max_concurrent_calls),
        priority_levels = COALESCE(?, priority_levels),
        skills_required = COALESCE(?, skills_required),
        performance_metrics = COALESCE(?, performance_metrics),
        status = COALESCE(?, status),
        metadata = COALESCE(?, metadata),
        updated_at = NOW()
      WHERE squad_id = ?
    `;

    const params = [
      name,
      description,
      members ? JSON.stringify(members) : null,
      routing_strategy,
      escalation_rules ? JSON.stringify(escalation_rules) : null,
      availability_schedule ? JSON.stringify(availability_schedule) : null,
      max_concurrent_calls,
      priority_levels ? JSON.stringify(priority_levels) : null,
      skills_required ? JSON.stringify(skills_required) : null,
      performance_metrics ? JSON.stringify(performance_metrics) : null,
      status,
      metadata ? JSON.stringify(metadata) : null,
      squad_id
    ];

    const [result] = await db.query(updateSQL, params);
    return result.affectedRows;
  });
}

// Delete squad
async function deleteSquad(squad_id) {
  return await retryDbOperation(async () => {
    const sql = "DELETE FROM squads WHERE squad_id = ?";
    const [result] = await db.query(sql, [squad_id]);
    return result.affectedRows;
  });
}

// Add member to squad
async function addSquadMember(squad_id, memberData) {
  return await retryDbOperation(async () => {
    // Get current squad
    const squad = await getSquadById(squad_id);
    if (!squad) {
      throw new Error("Squad not found");
    }

    const currentMembers = JSON.parse(squad.members || '[]');
    
    // Check if member already exists
    const memberExists = currentMembers.some(member => 
      member.assistant_id === memberData.assistant_id || 
      member.user_id === memberData.user_id
    );

    if (memberExists) {
      throw new Error("Member already exists in squad");
    }

    // Add new member
    const newMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...memberData,
      joined_at: new Date().toISOString(),
      status: 'active'
    };

    currentMembers.push(newMember);

    // Update squad
    const updateSQL = `
      UPDATE squads SET
        members = ?,
        updated_at = NOW()
      WHERE squad_id = ?
    `;

    const [result] = await db.query(updateSQL, [JSON.stringify(currentMembers), squad_id]);
    return result.affectedRows;
  });
}

// Remove member from squad
async function removeSquadMember(squad_id, member_id) {
  return await retryDbOperation(async () => {
    // Get current squad
    const squad = await getSquadById(squad_id);
    if (!squad) {
      throw new Error("Squad not found");
    }

    const currentMembers = JSON.parse(squad.members || '[]');
    const updatedMembers = currentMembers.filter(member => member.id !== member_id);

    // Update squad
    const updateSQL = `
      UPDATE squads SET
        members = ?,
        updated_at = NOW()
      WHERE squad_id = ?
    `;

    const [result] = await db.query(updateSQL, [JSON.stringify(updatedMembers), squad_id]);
    return result.affectedRows;
  });
}

// Get squad performance metrics
async function getSquadMetrics(squad_id, date_from, date_to) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        COUNT(*) as total_calls,
        AVG(duration) as avg_call_duration,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_calls,
        AVG(customer_satisfaction_score) as avg_satisfaction
      FROM calls 
      WHERE squad_id = ? 
        AND created_at BETWEEN ? AND ?
    `;

    const [result] = await db.query(sql, [squad_id, date_from, date_to]);
    return result[0] || {};
  });
}

module.exports = {
  createSquad,
  getSquads,
  getSquadById,
  updateSquad,
  deleteSquad,
  addSquadMember,
  removeSquadMember,
  getSquadMetrics
};
