const Permission = require("../../model/rbacModel/permissionModel");
const User = require("../../model/userModel/userModel");
const Role = require("../../model/roleModel/roleModel");

// Get all permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.getAllPermissions();
    res.status(200).json({
      success: true,
      message: "Permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions"
    });
  }
};

// Get permissions by category
exports.getPermissionsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const permissions = await Permission.getPermissionsByCategory(category);
    res.status(200).json({
      success: true,
      message: "Permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching permissions by category:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions"
    });
  }
};

// Get permission by ID
exports.getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.getPermissionById(id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Permission retrieved successfully",
      data: permission
    });
  } catch (error) {
    console.error("Error fetching permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permission"
    });
  }
};

// Create new permission
exports.createPermission = async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      category,
      resource,
      action,
      is_system_permission
    } = req.body;

    // Validate required fields
    if (!name || !display_name || !category || !resource || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, display_name, category, resource, action"
      });
    }

    // Check if permission already exists
    const existingPermission = await Permission.getPermissionByName(name);
    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: "Permission with this name already exists"
      });
    }

    const permissionId = await Permission.createPermission({
      name,
      display_name,
      description,
      category,
      resource,
      action,
      is_system_permission
    });

    res.status(201).json({
      success: true,
      message: "Permission created successfully",
      data: { id: permissionId }
    });
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating permission"
    });
  }
};

// Update permission
exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      display_name,
      description,
      category,
      resource,
      action,
      is_active
    } = req.body;

    // Check if permission exists
    const existingPermission = await Permission.getPermissionById(id);
    if (!existingPermission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== existingPermission.name) {
      const duplicatePermission = await Permission.getPermissionByName(name);
      if (duplicatePermission) {
        return res.status(400).json({
          success: false,
          message: "Permission with this name already exists"
        });
      }
    }

    const affectedRows = await Permission.updatePermission(id, {
      name,
      display_name,
      description,
      category,
      resource,
      action,
      is_active
    });

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found or no changes made"
      });
    }

    res.status(200).json({
      success: true,
      message: "Permission updated successfully"
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating permission"
    });
  }
};

// Get permissions for a specific user
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's role
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is super admin
    if (user.role_id) {
      const isSuperAdmin = await Role.isSuperAdminRole(user.role_id) || user.role_id === 1;

      if (isSuperAdmin) {
        // Super admin gets all permissions
        const allPermissions = await Permission.getAllPermissions();
        return res.status(200).json({
          success: true,
          message: "User permissions retrieved successfully",
          data: allPermissions,
          is_super_admin: true
        });
      }
    }

    // Get permissions through role
    const permissions = await Permission.getPermissionsByUserId(userId);

    res.status(200).json({
      success: true,
      message: "User permissions retrieved successfully",
      data: permissions,
      is_super_admin: false
    });
  } catch (error) {
    console.error("Error getting user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving user permissions",
      error: error.message
    });
  }
};

// Delete permission
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if permission exists
    const existingPermission = await Permission.getPermissionById(id);
    if (!existingPermission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    // Check if it's a system permission
    if (existingPermission.is_system_permission) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete system permissions"
      });
    }

    const affectedRows = await Permission.deletePermission(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Permission deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting permission"
    });
  }
};

// Get permissions for a specific role
exports.getPermissionsByRoleId = async (req, res) => {
  try {
    const { roleId } = req.params;
    const permissions = await Permission.getPermissionsByRoleId(roleId);
    
    res.status(200).json({
      success: true,
      message: "Role permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching role permissions"
    });
  }
};

// Get permissions for a specific user
exports.getPermissionsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const permissions = await Permission.getPermissionsByUserId(userId);
    
    res.status(200).json({
      success: true,
      message: "User permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user permissions"
    });
  }
};
