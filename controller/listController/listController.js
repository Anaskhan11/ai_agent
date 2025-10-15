const listModel = require("../../model/listModel/listModel");
const contactModel = require("../../model/contactModel/contactModel");

// Helper function to extract userId from different token structures
const extractUserId = (user) => {
  if (user?.user?.id) {
    return user.user.id;
  } else if (user?.user?.user_id) {
    return user.user.user_id;
  } else if (user?.id) {
    return user.id;
  } else if (user?.user_id) {
    return user.user_id;
  }
  return null;
};

// Get all lists for a user
const getAllLists = async (req, res) => {
  try {
    console.log("Get all lists request received");
    console.log("User from token:", req.user);

    // Extract userId using helper function
    const userId = extractUserId(req.user);

    console.log("Extracted userId for getAllLists:", userId);

    if (!userId) {
      console.error("User ID not found in token for getAllLists. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const pageParam = parseInt(req.query.page);
    const limitParam = parseInt(req.query.limit);
    const search = req.query.search || "";
    const includeDeleted = req.query.includeDeleted === 'true';

    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

    // Check if user is super admin to include deleted lists
    const isSuperAdmin = req.user.isSuperAdmin || false;
    const shouldIncludeDeleted = includeDeleted && isSuperAdmin;

    const result = await listModel.getAllLists(userId, page, limit, search, shouldIncludeDeleted);

    res.status(200).json({
      success: true,
      data: result.lists,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalLists: result.totalLists,
        limit
      }
    });
  } catch (err) {
    console.error("Error in getAllLists:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get a single list by ID
const getListById = async (req, res) => {
  try {
    console.log("Get list by ID request received");
    console.log("User from token:", req.user);

    // Extract userId using helper function
    const userId = extractUserId(req.user);

    console.log("Extracted userId for getListById:", userId);

    const listId = req.params.id;

    if (!userId) {
      console.error("User ID not found in token for getListById. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user.isSuperAdmin || false;

    // Get list including deleted status to check if it's disabled
    const list = await listModel.getListById(listId, userId, true);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }

    // If list is disabled and user is not super admin, deny access
    if (list.is_deleted && !isSuperAdmin) {
      return res.status(403).json({
        error: "This list has been disabled and is not accessible. Contact your administrator for assistance."
      });
    }

    res.status(200).json({
      success: true,
      data: list
    });
  } catch (err) {
    console.error("Error in getListById:", err);
    res.status(500).json({ error: err.message });
  }
};

// Create a new list
const createList = async (req, res) => {
  try {
    console.log("Create list request received:", req.body);
    console.log("User from token:", req.user);

    // Extract userId using helper function
    const userId = extractUserId(req.user);

    console.log("Extracted userId:", userId);

    // Handle both old and new field names for backward compatibility
    const list_name = req.body.list_name || req.body.listName;
    const list_description = req.body.list_description || req.body.description;
    const type = req.body.type || 'General';

    if (!userId) {
      console.error("User ID not found in token. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!list_name || !list_description) {
      return res.status(400).json({
        error: "List name and description are required"
      });
    }

    const result = await listModel.createList(userId, list_name, list_description, type);

    res.status(201).json({
      success: true,
      message: "List created successfully",
      data: {
        id: result.insertId,
        listName: list_name,
        description: list_description,
        type,
        contacts_count: 0
      }
    });
  } catch (err) {
    console.error("Error in createList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update a list
const updateList = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;
    const updates = req.body;

    if (!userId) {
      console.error("User ID not found in token for updateList. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await listModel.updateList(listId, userId, updates);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "List not found or no changes made" });
    }

    res.status(200).json({
      success: true,
      message: "List updated successfully"
    });
  } catch (err) {
    console.error("Error in updateList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a list (soft delete)
const deleteList = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;

    if (!userId) {
      console.error("User ID not found in token for deleteList. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await listModel.deleteList(listId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "List not found or already deleted" });
    }

    res.status(200).json({
      success: true,
      message: "List disabled successfully"
    });
  } catch (err) {
    console.error("Error in deleteList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Restore a soft deleted list (super admin only)
const restoreList = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;

    if (!userId) {
      console.error("User ID not found in token for restoreList. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user.isSuperAdmin || false;
    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Access denied. Super admin privileges required." });
    }

    const result = await listModel.restoreList(listId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "List not found or not deleted" });
    }

    res.status(200).json({
      success: true,
      message: "List restored successfully"
    });
  } catch (err) {
    console.error("Error in restoreList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get contacts for a specific list
const getListContacts = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;
    const pageParam = parseInt(req.query.page);
    const limitParam = parseInt(req.query.limit);
    const search = req.query.search || "";

    if (!userId) {
      console.error("User ID not found in token for getListContacts. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user is super admin
    const isSuperAdmin = req.user.isSuperAdmin || false;

    // First check if the list exists and if it's disabled
    const listInfo = await listModel.getListById(listId, userId, true); // Include deleted to check status

    if (!listInfo) {
      return res.status(404).json({ error: "List not found" });
    }

    // If list is disabled and user is not super admin, deny access
    if (listInfo.is_deleted && !isSuperAdmin) {
      return res.status(403).json({
        error: "This list has been disabled and is not accessible. Contact your administrator for assistance."
      });
    }

    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

    const result = await contactModel.getContactsByListId(listId, userId, page, limit, search);

    if (!result.list_info) {
      return res.status(404).json({ error: "List not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        list: result.list_info,
        contacts: result.contacts,
        pagination: {
          currentPage: result.current_page,
          totalPages: result.total_pages,
          totalContacts: result.total_contacts,
          limit
        }
      }
    });
  } catch (err) {
    console.error("Error in getListContacts:", err);
    res.status(500).json({ error: err.message });
  }
};

// Add contact to list
const addContactToList = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;
    const contactData = req.body;

    if (!userId) {
      console.error("User ID not found in token for addContactToList. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!contactData.email || !contactData.contact_number) {
      return res.status(400).json({ 
        error: "Email and contact number are required" 
      });
    }

    const result = await contactModel.addContactToList(listId, userId, contactData);

    res.status(201).json({
      success: true,
      message: "Contact added to list successfully",
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error("Error in addContactToList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Remove contact from list
const removeContactFromList = async (req, res) => {
  try {
    const userId = extractUserId(req.user);
    const listId = req.params.id;
    const contactId = req.params.contactId;

    if (!userId) {
      console.error("User ID not found in token for removeContactFromList. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await contactModel.removeContactFromList(listId, contactId, userId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found in list" });
    }

    res.status(200).json({
      success: true,
      message: "Contact removed from list successfully"
    });
  } catch (err) {
    console.error("Error in removeContactFromList:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get list statistics
const getListStats = async (req, res) => {
  try {
    const userId = extractUserId(req.user);

    if (!userId) {
      console.error("User ID not found in token for getListStats. Token structure:", JSON.stringify(req.user, null, 2));
      return res.status(401).json({ error: "User not authenticated" });
    }

    const stats = await listModel.getListStats(userId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error("Error in getListStats:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllLists,
  getListById,
  createList,
  updateList,
  deleteList,
  restoreList,
  getListContacts,
  addContactToList,
  removeContactFromList,
  getListStats
};
