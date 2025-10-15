const RolePagePermission = require("../../model/rbacModel/rolePagePermissionModel");
const Role = require("../../model/roleModel/roleModel");
const PagePermission = require("../../model/rbacModel/pagePermissionModel");

// Get all role page permissions
exports.getAllRolePagePermissions = async (req, res) => {
  try {
    const rolePagePermissions = await RolePagePermission.getAllRolePagePermissions();
    res.status(200).json({
      success: true,
      message: "Role page permissions retrieved successfully",
      data: rolePagePermissions
    });
  } catch (error) {
    console.error("Error fetching role page permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching role page permissions"
    });
  }
};

// Get role page permissions by role ID
exports.getRolePagePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    
    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const permissions = await RolePagePermission.getRolePagePermissionsWithDetails(roleId);
    res.status(200).json({
      success: true,
      message: "Role page permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching role page permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions"
    });
  }
};

// Get accessible pages by role ID
exports.getAccessiblePagesByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    
    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const pages = await RolePagePermission.getAccessiblePagesByRoleId(roleId);
    res.status(200).json({
      success: true,
      message: "Accessible pages retrieved successfully",
      data: pages
    });
  } catch (error) {
    console.error("Error fetching accessible pages:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pages"
    });
  }
};

// Set role page permissions (bulk update)
exports.setRolePagePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { pagePermissions } = req.body;
    const updatedBy = req.user.id;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Validate page permissions format
    if (!Array.isArray(pagePermissions)) {
      return res.status(400).json({
        success: false,
        message: "Page permissions must be an array"
      });
    }

    // Validate each permission object
    for (const permission of pagePermissions) {
      const { pageId, canView, canAdd, canUpdate, canDelete } = permission;
      
      if (!pageId || typeof pageId !== 'number') {
        return res.status(400).json({
          success: false,
          message: "Each permission must have a valid pageId"
        });
      }

      // Check if page exists
      const page = await PagePermission.getPagePermissionById(pageId);
      if (!page) {
        return res.status(404).json({
          success: false,
          message: `Page with ID ${pageId} not found`
        });
      }
    }

    await RolePagePermission.setRolePagePermissions(roleId, pagePermissions, updatedBy);
    
    res.status(200).json({
      success: true,
      message: "Role page permissions updated successfully"
    });
  } catch (error) {
    console.error("Error setting role page permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating permissions"
    });
  }
};

// Get user page permissions (through roles)
exports.getUserPagePermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const permissions = await RolePagePermission.getUserPagePermissions(userId);
    res.status(200).json({
      success: true,
      message: "User page permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching user page permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions"
    });
  }
};

// Get all pages for role management
exports.getAllPagesForRoleManagement = async (req, res) => {
  try {
    const pages = await RolePagePermission.getAllPagesForRoleManagement();
    res.status(200).json({
      success: true,
      message: "Pages retrieved successfully",
      data: pages
    });
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pages"
    });
  }
};

// Check role page permission
exports.checkRolePagePermission = async (req, res) => {
  try {
    const { roleId, pageId, permissionType } = req.params;
    
    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Check if page exists
    const page = await PagePermission.getPagePermissionById(pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    const hasPermission = await RolePagePermission.checkRolePagePermission(roleId, pageId, permissionType);
    res.status(200).json({
      success: true,
      message: "Permission check completed",
      data: { hasPermission }
    });
  } catch (error) {
    console.error("Error checking role page permission:", error);
    if (error.message === 'Invalid permission type') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while checking permission"
    });
  }
};

// Delete role page permission
exports.deleteRolePagePermission = async (req, res) => {
  try {
    const { roleId, pageId } = req.params;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Check if page exists
    const page = await PagePermission.getPagePermissionById(pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Page not found"
      });
    }

    const result = await RolePagePermission.deleteRolePagePermission(roleId, pageId);
    
    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Role page permission deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting role page permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting permission"
    });
  }
};
