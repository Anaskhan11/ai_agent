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

// Create knowledge base
async function createKnowledgeBase(kbData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      kb_id,
      org_id,
      name,
      description,
      file_ids = [],
      urls = [],
      provider = 'openai',
      embedding_model = 'text-embedding-ada-002',
      chunk_size = 1000,
      chunk_overlap = 200,
      top_k = 5,
      similarity_threshold = 0.7,
      preprocessing_config = {},
      indexing_config = {},
      retrieval_config = {},
      status = 'creating',
      metadata = {}
    } = kbData;

    const insertSQL = `
      INSERT INTO knowledge_bases (
        user_id, kb_id, org_id, name, description, file_ids, urls,
        provider, embedding_model, chunk_size, chunk_overlap, top_k,
        similarity_threshold, preprocessing_config, indexing_config,
        retrieval_config, status, metadata, documents_count, chunks_count,
        total_tokens, last_indexed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NOW(), NOW())
    `;

    const params = [
      user_id,
      kb_id,
      org_id,
      name,
      description,
      JSON.stringify(file_ids),
      JSON.stringify(urls),
      provider,
      embedding_model,
      chunk_size,
      chunk_overlap,
      top_k,
      similarity_threshold,
      JSON.stringify(preprocessing_config),
      JSON.stringify(indexing_config),
      JSON.stringify(retrieval_config),
      status,
      JSON.stringify(metadata)
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

// Get knowledge bases with pagination and filtering
async function getKnowledgeBases(page, limit, search = "", status = "", user_id = null) {
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
    const countQuery = `SELECT COUNT(*) AS total FROM knowledge_bases ${whereClause}`;
    const [totalRows] = await db.query(countQuery, values);
    const totalKBs = totalRows[0]?.total || 0;

    // Calculate pagination
    const totalPages = Math.ceil(totalKBs / limit);
    const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (adjustedPage - 1) * limit;

    // Main query
    const selectQuery = `
      SELECT kb.*, 
             (SELECT COUNT(*) FROM kb_search_queries WHERE kb_id = kb.kb_id) as search_count,
             (SELECT AVG(response_time_ms) FROM kb_search_queries WHERE kb_id = kb.kb_id) as avg_response_time
      FROM knowledge_bases kb
      ${whereClause}
      ORDER BY kb.updated_at DESC 
      LIMIT ? OFFSET ?
    `;

    const [knowledgeBases] = await db.query(selectQuery, [...values, limit, offset]);

    return {
      knowledgeBases,
      pagination: {
        currentPage: adjustedPage,
        totalPages,
        totalItems: totalKBs,
        itemsPerPage: limit,
        hasNextPage: adjustedPage < totalPages,
        hasPrevPage: adjustedPage > 1
      }
    };
  });
}

// Get knowledge base by ID
async function getKnowledgeBaseById(kb_id) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT kb.*, 
             (SELECT COUNT(*) FROM kb_search_queries WHERE kb_id = kb.kb_id) as search_count,
             (SELECT AVG(response_time_ms) FROM kb_search_queries WHERE kb_id = kb.kb_id) as avg_response_time
      FROM knowledge_bases kb 
      WHERE kb.kb_id = ?
    `;
    const [result] = await db.query(sql, [kb_id]);
    return result[0] || null;
  });
}

// Update knowledge base
async function updateKnowledgeBase(kb_id, updateData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      file_ids,
      urls,
      provider,
      embedding_model,
      chunk_size,
      chunk_overlap,
      top_k,
      similarity_threshold,
      preprocessing_config,
      indexing_config,
      retrieval_config,
      status,
      metadata,
      documents_count,
      chunks_count,
      total_tokens
    } = updateData;

    const updateSQL = `
      UPDATE knowledge_bases SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        file_ids = COALESCE(?, file_ids),
        urls = COALESCE(?, urls),
        provider = COALESCE(?, provider),
        embedding_model = COALESCE(?, embedding_model),
        chunk_size = COALESCE(?, chunk_size),
        chunk_overlap = COALESCE(?, chunk_overlap),
        top_k = COALESCE(?, top_k),
        similarity_threshold = COALESCE(?, similarity_threshold),
        preprocessing_config = COALESCE(?, preprocessing_config),
        indexing_config = COALESCE(?, indexing_config),
        retrieval_config = COALESCE(?, retrieval_config),
        status = COALESCE(?, status),
        metadata = COALESCE(?, metadata),
        documents_count = COALESCE(?, documents_count),
        chunks_count = COALESCE(?, chunks_count),
        total_tokens = COALESCE(?, total_tokens),
        last_indexed = CASE WHEN ? = 'ready' THEN NOW() ELSE last_indexed END,
        updated_at = NOW()
      WHERE kb_id = ?
    `;

    const params = [
      name,
      description,
      file_ids ? JSON.stringify(file_ids) : null,
      urls ? JSON.stringify(urls) : null,
      provider,
      embedding_model,
      chunk_size,
      chunk_overlap,
      top_k,
      similarity_threshold,
      preprocessing_config ? JSON.stringify(preprocessing_config) : null,
      indexing_config ? JSON.stringify(indexing_config) : null,
      retrieval_config ? JSON.stringify(retrieval_config) : null,
      status,
      metadata ? JSON.stringify(metadata) : null,
      documents_count,
      chunks_count,
      total_tokens,
      status, // For the CASE WHEN condition
      kb_id
    ];

    const [result] = await db.query(updateSQL, params);
    return result.affectedRows;
  });
}

// Delete knowledge base
async function deleteKnowledgeBase(kb_id) {
  return await retryDbOperation(async () => {
    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Delete related search queries
      await connection.query("DELETE FROM kb_search_queries WHERE kb_id = ?", [kb_id]);
      
      // Delete knowledge base
      const [result] = await connection.query("DELETE FROM knowledge_bases WHERE kb_id = ?", [kb_id]);
      
      await connection.commit();
      connection.release();
      
      return result.affectedRows;
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  });
}

// Log search query
async function logSearchQuery(kb_id, query, results, response_time_ms, user_id = null) {
  return await retryDbOperation(async () => {
    const insertSQL = `
      INSERT INTO kb_search_queries (
        kb_id, user_id, query, results_count, response_time_ms,
        results_preview, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const resultsPreview = results.slice(0, 3).map(r => ({
      content: r.content.substring(0, 200),
      score: r.score,
      source: r.source
    }));

    const params = [
      kb_id,
      user_id,
      query,
      results.length,
      response_time_ms,
      JSON.stringify(resultsPreview)
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

// Get knowledge base analytics
async function getKnowledgeBaseAnalytics(kb_id, date_from, date_to) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        COUNT(*) as total_searches,
        AVG(response_time_ms) as avg_response_time,
        AVG(results_count) as avg_results_count,
        COUNT(DISTINCT user_id) as unique_users,
        DATE(created_at) as search_date,
        COUNT(*) as daily_searches
      FROM kb_search_queries 
      WHERE kb_id = ? 
        AND created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY search_date DESC
    `;

    const [analytics] = await db.query(sql, [kb_id, date_from, date_to]);
    
    // Get top queries
    const topQueriesSql = `
      SELECT query, COUNT(*) as frequency
      FROM kb_search_queries 
      WHERE kb_id = ? 
        AND created_at BETWEEN ? AND ?
      GROUP BY query
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const [topQueries] = await db.query(topQueriesSql, [kb_id, date_from, date_to]);

    return {
      daily_analytics: analytics,
      top_queries: topQueries
    };
  });
}

module.exports = {
  createKnowledgeBase,
  getKnowledgeBases,
  getKnowledgeBaseById,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  logSearchQuery,
  getKnowledgeBaseAnalytics
};
