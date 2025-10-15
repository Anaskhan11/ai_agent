const clinicalRoleModel = require("../../model/clinicalRoleModel/clinicalRoleModel");

// Get all clinical roles
const getAllClinicalRoles = async (req, res) => {
  try {
    const roles = await clinicalRoleModel.getAllClinicalRoles();
    res.status(200).json({
      success: true,
      data: roles,
      message: "Clinical roles retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching clinical roles:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinical roles",
      error: error.message
    });
  }
};

// Get clinical role by ID
const getClinicalRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await clinicalRoleModel.getClinicalRoleById(id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Clinical role not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: role,
      message: "Clinical role retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching clinical role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinical role",
      error: error.message
    });
  }
};

// Create new clinical role
const createClinicalRole = async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      permissions,
      hierarchy_level
    } = req.body;

    // Validate required fields
    if (!name || !display_name || !permissions) {
      return res.status(400).json({
        success: false,
        message: "Name, display name, and permissions are required"
      });
    }

    // Validate permissions structure
    if (!permissions.view || !Array.isArray(permissions.view)) {
      return res.status(400).json({
        success: false,
        message: "Permissions must include a 'view' array"
      });
    }

    // Check if role name already exists
    const existingRole = await clinicalRoleModel.getClinicalRoleByName(name);
    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: "Clinical role with this name already exists"
      });
    }

    const roleId = await clinicalRoleModel.createClinicalRole({
      name,
      display_name,
      description,
      permissions,
      hierarchy_level: hierarchy_level || 5
    });

    const newRole = await clinicalRoleModel.getClinicalRoleById(roleId);

    res.status(201).json({
      success: true,
      data: newRole,
      message: "Clinical role created successfully"
    });
  } catch (error) {
    console.error("Error creating clinical role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create clinical role",
      error: error.message
    });
  }
};

// Update clinical role
const updateClinicalRole = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      display_name,
      description,
      permissions,
      hierarchy_level
    } = req.body;

    // Check if role exists
    const existingRole = await clinicalRoleModel.getClinicalRoleById(id);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: "Clinical role not found"
      });
    }

    // Validate required fields
    if (!name || !display_name || !permissions) {
      return res.status(400).json({
        success: false,
        message: "Name, display name, and permissions are required"
      });
    }

    // Check if new name conflicts with existing role (excluding current role)
    if (name !== existingRole.name) {
      const conflictingRole = await clinicalRoleModel.getClinicalRoleByName(name);
      if (conflictingRole) {
        return res.status(409).json({
          success: false,
          message: "Clinical role with this name already exists"
        });
      }
    }

    const updated = await clinicalRoleModel.updateClinicalRole(id, {
      name,
      display_name,
      description,
      permissions,
      hierarchy_level: hierarchy_level || existingRole.hierarchy_level
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Failed to update clinical role"
      });
    }

    const updatedRole = await clinicalRoleModel.getClinicalRoleById(id);

    res.status(200).json({
      success: true,
      data: updatedRole,
      message: "Clinical role updated successfully"
    });
  } catch (error) {
    console.error("Error updating clinical role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update clinical role",
      error: error.message
    });
  }
};

// Delete clinical role
const deleteClinicalRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const existingRole = await clinicalRoleModel.getClinicalRoleById(id);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: "Clinical role not found"
      });
    }

    // Check if it's a system role
    if (existingRole.is_system_role) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete system roles"
      });
    }

    const deleted = await clinicalRoleModel.deleteClinicalRole(id);

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: "Failed to delete clinical role"
      });
    }

    res.status(200).json({
      success: true,
      message: "Clinical role deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting clinical role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete clinical role",
      error: error.message
    });
  }
};

// Get users with specific clinical role
const getUsersWithRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await clinicalRoleModel.getClinicalRoleById(id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Clinical role not found"
      });
    }

    const users = await clinicalRoleModel.getUsersWithClinicalRole(id);

    res.status(200).json({
      success: true,
      data: {
        role: role,
        users: users
      },
      message: "Users with clinical role retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching users with role:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users with role",
      error: error.message
    });
  }
};

// Assign clinical role to user
const assignRoleToUser = async (req, res) => {
  try {
    const { roleId, userId } = req.params;
    const { expires_at } = req.body;
    const assignedBy = req.user?.user?.id || req.user?.id;

    // Validate role exists
    const role = await clinicalRoleModel.getClinicalRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Clinical role not found"
      });
    }

    const assigned = await clinicalRoleModel.assignClinicalRoleToUser(
      userId, 
      roleId, 
      assignedBy, 
      expires_at
    );

    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: "Failed to assign clinical role to user"
      });
    }

    res.status(200).json({
      success: true,
      message: "Clinical role assigned to user successfully"
    });
  } catch (error) {
    console.error("Error assigning role to user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign role to user",
      error: error.message
    });
  }
};

// Remove clinical role from user
const removeRoleFromUser = async (req, res) => {
  try {
    const { roleId, userId } = req.params;

    const removed = await clinicalRoleModel.removeClinicalRoleFromUser(userId, roleId);

    if (!removed) {
      return res.status(400).json({
        success: false,
        message: "Failed to remove clinical role from user"
      });
    }

    res.status(200).json({
      success: true,
      message: "Clinical role removed from user successfully"
    });
  } catch (error) {
    console.error("Error removing role from user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove role from user",
      error: error.message
    });
  }
};

// Get clinical role statistics
const getClinicalRoleStats = async (req, res) => {
  try {
    const stats = await clinicalRoleModel.getClinicalRoleStats();
    
    res.status(200).json({
      success: true,
      data: stats,
      message: "Clinical role statistics retrieved successfully"
    });
  } catch (error) {
    console.error("Error fetching clinical role stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinical role statistics",
      error: error.message
    });
  }
};

module.exports = {
  getAllClinicalRoles,
  getClinicalRoleById,
  createClinicalRole,
  updateClinicalRole,
  deleteClinicalRole,
  getUsersWithRole,
  assignRoleToUser,
  removeRoleFromUser,
  getClinicalRoleStats
};
