const SupportModel = require("../../model/SupportModel/SupportModel");

// Get all support tickets for the authenticated user
const getAllSupportTickets = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      console.error("User ID not found in token for getAllSupportTickets. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;

    // Extract filters from query parameters
    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      search: req.query.search,
      limit: req.query.limit
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    let tickets;

    if (isSuperAdmin) {
      // Super admin can see all tickets
      console.log("Super admin detected, fetching all tickets");

      // Add additional admin filters
      const adminFilters = {
        ...filters,
        assigned_to: req.query.assigned_to,
        user_id: req.query.user_id,
        created_from: req.query.created_from,
        created_to: req.query.created_to,
        sort_by: req.query.sort_by || "created_at",
        sort_order: req.query.sort_order || "desc",
        page: req.query.page,
        limit: req.query.limit || 50
      };

      // Remove undefined admin filters
      Object.keys(adminFilters).forEach(key => {
        if (adminFilters[key] === undefined) {
          delete adminFilters[key];
        }
      });

      console.log('Admin filters being passed:', adminFilters);
      tickets = await SupportModel.getAdminSupportTickets(adminFilters);
    } else {
      // Regular user can only see their own tickets
      console.log("Regular user detected, fetching user-specific tickets");
      tickets = await SupportModel.getAllSupportTickets(userId, filters);
    }

    return res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully",
      data: tickets,
      count: tickets.length,
      is_super_admin: isSuperAdmin
    });
  } catch (error) {
    console.error("Error getting support tickets:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support tickets",
      error: error.message
    });
  }
};

// Get support ticket by ID
const getSupportTicketById = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      console.error("User ID not found in token for getSupportTicketById. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;

    let ticket;

    if (isSuperAdmin) {
      // Super admin can see any ticket
      console.log("Super admin detected, fetching ticket without user restriction");
      ticket = await SupportModel.getSupportTicketByIdForAdmin(ticketId);
    } else {
      // Regular user can only see their own tickets
      console.log("Regular user detected, fetching user-specific ticket");
      ticket = await SupportModel.getSupportTicketById(ticketId, userId);
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket retrieved successfully",
      data: ticket,
      is_super_admin: isSuperAdmin
    });
  } catch (error) {
    console.error("Error getting support ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support ticket",
      error: error.message
    });
  }
};

// Create new support ticket
const createSupportTicket = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      console.error("User ID not found in token for createSupportTicket. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    const { title, description, category, priority, attachments, tags } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required"
      });
    }

    if (title.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Title must be less than 500 characters"
      });
    }

    const ticketData = {
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'general',
      priority: priority || 'medium',
      attachments: attachments || [],
      tags: tags || [],
      metadata: {
        created_by: userId,
        user_agent: req.get('User-Agent'),
        ip_address: req.ip
      }
    };

    const result = await SupportModel.createSupportTicket(ticketData);

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: {
        id: result.id,
        ticket_id: result.ticket_id
      }
    });
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create support ticket",
      error: error.message
    });
  }
};

// Update support ticket
const updateSupportTicket = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      console.error("User ID not found in token for updateSupportTicket. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    const updates = req.body;

    // Validation for title length if provided
    if (updates.title && updates.title.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Title must be less than 500 characters"
      });
    }

    // Trim string fields
    if (updates.title) updates.title = updates.title.trim();
    if (updates.description) updates.description = updates.description.trim();

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;

    let result;

    if (isSuperAdmin) {
      // Super admin can update any ticket
      console.log("Super admin detected, updating ticket without user restriction");

      // For super admin, we can use the admin status update function if it's a status change
      if (updates.status && Object.keys(updates).length === 1) {
        result = await SupportModel.updateTicketStatusByAdmin(ticketId, updates.status, userId, updates.notes);
      } else {
        // For other updates, create an admin-specific update
        result = await SupportModel.updateSupportTicketByAdmin(ticketId, userId, updates);
      }
    } else {
      // Regular user can only update their own tickets
      console.log("Regular user detected, updating user-specific ticket");
      result = await SupportModel.updateSupportTicket(ticketId, userId, updates);
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found or no changes made"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket updated successfully",
      is_super_admin: isSuperAdmin
    });
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update support ticket",
      error: error.message
    });
  }
};

// Delete support ticket
const deleteSupportTicket = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      console.error("User ID not found in token for deleteSupportTicket. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    const result = await SupportModel.deleteSupportTicket(ticketId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting support ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete support ticket",
      error: error.message
    });
  }
};

// Get ticket messages
const getTicketMessages = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      console.error("User ID not found in token for getTicketMessages. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;

    if (isSuperAdmin) {
      console.log("Super admin detected, fetching ticket messages without user restriction");
    }

    const messages = await SupportModel.getTicketMessages(ticketId, isSuperAdmin ? null : userId);

    return res.status(200).json({
      success: true,
      message: "Ticket messages retrieved successfully",
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error("Error getting ticket messages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket messages",
      error: error.message
    });
  }
};

// Add message to ticket
const addTicketMessage = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      console.error("User ID not found in token for addTicketMessage. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    const { message, attachments } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    const messageData = {
      message: message.trim(),
      message_type: 'user_message',
      attachments: attachments || [],
      metadata: {
        user_agent: req.get('User-Agent'),
        ip_address: req.ip
      }
    };

    const result = await SupportModel.addTicketMessage(ticketId, userId, messageData);

    return res.status(201).json({
      success: true,
      message: "Message added successfully",
      data: {
        id: result.id,
        message_id: result.message_id
      }
    });
  } catch (error) {
    console.error("Error adding ticket message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add message",
      error: error.message
    });
  }
};

// Get support categories
const getSupportCategories = async (req, res) => {
  try {
    const categories = await SupportModel.getSupportCategories();

    return res.status(200).json({
      success: true,
      message: "Support categories retrieved successfully",
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error("Error getting support categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support categories",
      error: error.message
    });
  }
};

// ============ ADMIN FUNCTIONS ============

// Get all support tickets for admin (no user isolation)
const getAllSupportTicketsForAdmin = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    // Extract filters from query parameters
    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      assigned_to: req.query.assigned_to,
      user_id: req.query.user_id,
      search: req.query.search,
      created_from: req.query.created_from,
      created_to: req.query.created_to,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      page: req.query.page,
      limit: req.query.limit || 50
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const tickets = await SupportModel.getAllSupportTicketsForAdmin(filters);

    return res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully",
      data: tickets,
      count: tickets.length,
      filters: filters
    });
  } catch (error) {
    console.error("Error getting admin support tickets:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support tickets",
      error: error.message
    });
  }
};

// Get support ticket by ID for admin (no user isolation)
const getSupportTicketByIdForAdmin = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required"
      });
    }

    const ticket = await SupportModel.getSupportTicketByIdForAdmin(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket retrieved successfully",
      data: ticket
    });
  } catch (error) {
    console.error("Error getting admin support ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support ticket",
      error: error.message
    });
  }
};

// Assign ticket to support staff
const assignTicketToStaff = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;
    const { assigned_to } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    if (!ticketId || !assigned_to) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID and assigned_to are required"
      });
    }

    const result = await SupportModel.assignTicketToStaff(ticketId, assigned_to, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket assigned successfully"
    });
  } catch (error) {
    console.error("Error assigning ticket:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign ticket",
      error: error.message
    });
  }
};

// Update ticket status by admin
const updateTicketStatusByAdmin = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    const { ticketId } = req.params;
    const { status, notes } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    if (!ticketId || !status) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID and status are required"
      });
    }

    // Validate status
    const validStatuses = ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const result = await SupportModel.updateTicketStatusByAdmin(ticketId, status, userId, notes);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket status updated successfully"
    });
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update ticket status",
      error: error.message
    });
  }
};

// Get support ticket statistics for admin dashboard
const getSupportTicketStats = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    const stats = await SupportModel.getSupportTicketStats();

    return res.status(200).json({
      success: true,
      message: "Support ticket statistics retrieved successfully",
      data: stats
    });
  } catch (error) {
    console.error("Error getting support ticket stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support ticket statistics",
      error: error.message
    });
  }
};

// Get ticket count by category for admin
const getTicketCountByCategory = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    const categoryStats = await SupportModel.getTicketCountByCategory();

    return res.status(200).json({
      success: true,
      message: "Ticket count by category retrieved successfully",
      data: categoryStats
    });
  } catch (error) {
    console.error("Error getting ticket count by category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket count by category",
      error: error.message
    });
  }
};

// Get recent ticket activity for admin dashboard
const getRecentTicketActivity = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const activity = await SupportModel.getRecentTicketActivity(limit);

    return res.status(200).json({
      success: true,
      message: "Recent ticket activity retrieved successfully",
      data: activity
    });
  } catch (error) {
    console.error("Error getting recent ticket activity:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve recent ticket activity",
      error: error.message
    });
  }
};

// Get all support staff
const getAllSupportStaff = async (req, res) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.role_id === 1;
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required."
      });
    }

    const staff = await SupportModel.getAllSupportStaff();

    return res.status(200).json({
      success: true,
      message: "Support staff retrieved successfully",
      data: staff
    });
  } catch (error) {
    console.error("Error getting support staff:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve support staff",
      error: error.message
    });
  }
};

module.exports = {
  getAllSupportTickets,
  getSupportTicketById,
  createSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
  getTicketMessages,
  addTicketMessage,
  getSupportCategories,
  // Admin functions
  getAllSupportTicketsForAdmin,
  getSupportTicketByIdForAdmin,
  assignTicketToStaff,
  updateTicketStatusByAdmin,
  getSupportTicketStats,
  getTicketCountByCategory,
  getRecentTicketActivity,
  getAllSupportStaff
};
