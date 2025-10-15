const db = require("../../config/DBConnection");

// Retry database operations
async function retryDbOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation failed (attempt ${i + 1}):`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Create workflow record
async function createWorkflow(workflowData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      workflow_id,
      vapi_workflow_id,
      org_id,
      assistant_id = null,
      name,
      description = "",
      nodes = [],
      edges = [],
      model = null,
      transcriber = null,
      voice = null,
      global_prompt = "",
      background_sound = "off",
      credentials = null,
      credential_ids = null,
      variables = {},
      triggers = [],
      status = "active",
      version = "1.0.0",
      tags = [],
      metadata = {},
      execution_count = 0
    } = workflowData;

    const insertSQL = `
      INSERT INTO workflows (
        user_id, workflow_id, vapi_workflow_id, org_id, assistant_id, name, description,
        nodes, edges, model, transcriber, voice, global_prompt, background_sound,
        credentials, credential_ids, variables, triggers, status, version, tags,
        metadata, execution_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id,
      workflow_id,
      vapi_workflow_id || workflow_id,
      org_id,
      assistant_id,
      name,
      description,
      JSON.stringify(nodes),
      JSON.stringify(edges),
      model ? JSON.stringify(model) : null,
      transcriber ? JSON.stringify(transcriber) : null,
      voice ? JSON.stringify(voice) : null,
      global_prompt,
      background_sound,
      credentials ? JSON.stringify(credentials) : null,
      credential_ids ? JSON.stringify(credential_ids) : null,
      JSON.stringify(variables),
      JSON.stringify(triggers),
      status,
      version,
      JSON.stringify(tags),
      JSON.stringify(metadata),
      execution_count
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

// Get workflows by user ID with pagination
async function getWorkflowsByUserId(user_id, options = {}) {
  return await retryDbOperation(async () => {
    const { page = 1, limit = 10, search = "", status = "" } = options;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE user_id = ?";
    let params = [user_id];

    if (search) {
      whereClause += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    // Get total count
    const countSQL = `SELECT COUNT(*) as total FROM workflows ${whereClause}`;
    const [countResult] = await db.query(countSQL, params);
    const total = countResult[0].total;

    // Get workflows with pagination
    const selectSQL = `
      SELECT * FROM workflows 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const [workflows] = await db.query(selectSQL, params);

    // Parse metadata JSON safely
    const parsedWorkflows = workflows.map(workflow => {
      let metadata = {};
      try {
        if (workflow.metadata && typeof workflow.metadata === 'string') {
          metadata = JSON.parse(workflow.metadata);
        } else if (workflow.metadata && typeof workflow.metadata === 'object') {
          metadata = workflow.metadata;
        }
      } catch (error) {
        console.warn('Failed to parse workflow metadata:', error.message);
        metadata = {};
      }
      return {
        ...workflow,
        metadata
      };
    });

    return {
      workflows: parsedWorkflows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };
  });
}

// Get workflow by workflow_id (Vapi ID)
async function getWorkflowByWorkflowId(workflow_id) {
  return await retryDbOperation(async () => {
    const sql = "SELECT * FROM workflows WHERE workflow_id = ?";
    const [result] = await db.query(sql, [workflow_id]);
    
    if (result[0]) {
      let metadata = {};
      try {
        if (result[0].metadata && typeof result[0].metadata === 'string') {
          metadata = JSON.parse(result[0].metadata);
        } else if (result[0].metadata && typeof result[0].metadata === 'object') {
          metadata = result[0].metadata;
        }
      } catch (error) {
        console.warn('Failed to parse workflow metadata:', error.message);
        metadata = {};
      }
      return {
        ...result[0],
        metadata
      };
    }
    return null;
  });
}

// Get workflow by local ID
async function getWorkflowById(id) {
  return await retryDbOperation(async () => {
    const sql = "SELECT * FROM workflows WHERE id = ?";
    const [result] = await db.query(sql, [id]);
    
    if (result[0]) {
      let metadata = {};
      try {
        if (result[0].metadata && typeof result[0].metadata === 'string') {
          metadata = JSON.parse(result[0].metadata);
        } else if (result[0].metadata && typeof result[0].metadata === 'object') {
          metadata = result[0].metadata;
        }
      } catch (error) {
        console.warn('Failed to parse workflow metadata:', error.message);
        metadata = {};
      }
      return {
        ...result[0],
        metadata
      };
    }
    return null;
  });
}

// Update workflow by workflow_id
async function updateWorkflowByWorkflowId(workflow_id, updateData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      status,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE workflows 
      SET name = ?, description = ?, status = ?, metadata = ?, updated_at = NOW()
      WHERE workflow_id = ?
    `;

    const params = [
      name,
      description,
      status,
      JSON.stringify(metadata),
      workflow_id
    ];

    const [result] = await db.query(updateSQL, params);
    return result.affectedRows > 0;
  });
}

// Update workflow by local ID
async function updateWorkflowById(id, updateData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      status,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE workflows 
      SET name = ?, description = ?, status = ?, metadata = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      name,
      description,
      status,
      JSON.stringify(metadata),
      id
    ];

    const [result] = await db.query(updateSQL, params);
    return result.affectedRows > 0;
  });
}

// Update assistant_id for a workflow
async function updateWorkflowAssistantId(workflow_id, assistant_id) {
  return await retryDbOperation(async () => {
    const updateSQL = `
      UPDATE workflows
      SET assistant_id = ?, updated_at = NOW()
      WHERE workflow_id = ?
    `;

    const params = [assistant_id, workflow_id];
    const [result] = await db.query(updateSQL, params);
    return result.affectedRows > 0;
  });
}

// Delete workflow by workflow_id
async function deleteWorkflowByWorkflowId(workflow_id) {
  return await retryDbOperation(async () => {
    const deleteSQL = "DELETE FROM workflows WHERE workflow_id = ?";
    const [result] = await db.query(deleteSQL, [workflow_id]);
    return result.affectedRows > 0;
  });
}

// Delete workflow by local ID
async function deleteWorkflowById(id) {
  return await retryDbOperation(async () => {
    const deleteSQL = "DELETE FROM workflows WHERE id = ?";
    const [result] = await db.query(deleteSQL, [id]);
    return result.affectedRows > 0;
  });
}

// Get workflow statistics
async function getWorkflowStats(user_id = null) {
  return await retryDbOperation(async () => {
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
      FROM workflows
    `;

    let params = [];

    if (user_id) {
      sql += " WHERE user_id = ?";
      params.push(user_id);
    }

    const [result] = await db.query(sql, params);
    return result[0];
  });
}

// Search workflows
async function searchWorkflows(searchTerm, user_id = null, options = {}) {
  return await retryDbOperation(async () => {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE (name LIKE ? OR description LIKE ?)";
    let params = [`%${searchTerm}%`, `%${searchTerm}%`];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    // Get total count
    const countSQL = `SELECT COUNT(*) as total FROM workflows ${whereClause}`;
    const [countResult] = await db.query(countSQL, params);
    const total = countResult[0].total;

    // Get workflows
    const selectSQL = `
      SELECT * FROM workflows 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const [workflows] = await db.query(selectSQL, params);

    // Parse metadata JSON safely
    const parsedWorkflows = workflows.map(workflow => {
      let metadata = {};
      try {
        if (workflow.metadata && typeof workflow.metadata === 'string') {
          metadata = JSON.parse(workflow.metadata);
        } else if (workflow.metadata && typeof workflow.metadata === 'object') {
          metadata = workflow.metadata;
        }
      } catch (error) {
        console.warn('Failed to parse workflow metadata:', error.message);
        metadata = {};
      }
      return {
        ...workflow,
        metadata
      };
    });

    return {
      workflows: parsedWorkflows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    };
  });
}

module.exports = {
  createWorkflow,
  getWorkflowsByUserId,
  getWorkflowByWorkflowId,
  getWorkflowById,
  updateWorkflowByWorkflowId,
  updateWorkflowById,
  updateWorkflowAssistantId,
  deleteWorkflowByWorkflowId,
  deleteWorkflowById,
  getWorkflowStats,
  searchWorkflows
};
