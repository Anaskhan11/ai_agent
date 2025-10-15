const RolePermission = require("../../model/rbacModel/rolePermissionModel");
const Role = require("../../model/roleModel/roleModel");
const Permission = require("../../model/rbacModel/permissionModel");

// Get all role permissions
exports.getAllRolePermissions = async (req, res) => {
  try {
    const rolePermissions = await RolePermission.getAllRolePermissions();
    res.status(200).json({
      success: true,
      message: "Role permissions retrieved successfully",
      data: rolePermissions
    });
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching role permissions"
    });
  }
};

// Get role permissions by role ID
exports.getRolePermissionsByRoleId = async (req, res) => {
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
    
    const rolePermissions = await RolePermission.getRolePermissionsByRoleId(roleId);
    res.status(200).json({
      success: true,
      message: "Role permissions retrieved successfully",
      data: rolePermissions
    });
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching role permissions"
    });
  }
};

// Grant permission to role
exports.grantPermissionToRole = async (req, res) => {
  try {
    const { roleId, permissionId } = req.params;
    const grantedBy = req.user.id;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Check if permission exists
    const permission = await Permission.getPermissionById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    const result = await RolePermission.grantPermissionToRole(roleId, permissionId, grantedBy);
    
    res.status(200).json({
      success: true,
      message: "Permission granted to role successfully",
      data: { id: result }
    });
  } catch (error) {
    console.error("Error granting permission to role:", error);
    if (error.message === 'Permission already granted to this role') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while granting permission to role"
    });
  }
};

// Revoke permission from role
exports.revokePermissionFromRole = async (req, res) => {
  try {
    const { roleId, permissionId } = req.params;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Check if permission exists
    const permission = await Permission.getPermissionById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    const affectedRows = await RolePermission.revokePermissionFromRole(roleId, permissionId);
    
    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found for this role"
      });
    }

    res.status(200).json({
      success: true,
      message: "Permission revoked from role successfully"
    });
  } catch (error) {
    console.error("Error revoking permission from role:", error);
    res.status(500).json({
      success: false,
      message: "Server error while revoking permission from role"
    });
  }
};

// Bulk grant permissions to role
exports.bulkGrantPermissionsToRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    const grantedBy = req.user.id;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // Validate permission IDs array
    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: "Permission IDs must be an array"
      });
    }

    // Validate that all permissions exist
    for (const permissionId of permissionIds) {
      const permission = await Permission.getPermissionById(permissionId);
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: `Permission with ID ${permissionId} not found`
        });
      }
    }

    await RolePermission.bulkGrantPermissionsToRole(roleId, permissionIds, grantedBy);
    
    res.status(200).json({
      success: true,
      message: "Permissions granted to role successfully"
    });
  } catch (error) {
    console.error("Error bulk granting permissions to role:", error);
    res.status(500).json({
      success: false,
      message: "Server error while granting permissions to role"
    });
  }
};

// Check if role has specific permission
exports.checkRolePermission = async (req, res) => {
  try {
    const { roleId, permissionName } = req.params;

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    const hasPermission = await RolePermission.checkRolePermission(roleId, permissionName);
    
    res.status(200).json({
      success: true,
      message: "Permission check completed",
      data: { hasPermission }
    });
  } catch (error) {
    console.error("Error checking role permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking role permission"
    });
  }
};

// Get roles with specific permission
exports.getRolesWithPermission = async (req, res) => {
  try {
    const { permissionId } = req.params;

    // Check if permission exists
    const permission = await Permission.getPermissionById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found"
      });
    }

    const roles = await RolePermission.getRolesWithPermission(permissionId);
    
    res.status(200).json({
      success: true,
      message: "Roles with permission retrieved successfully",
      data: roles
    });
  } catch (error) {
    console.error("Error fetching roles with permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching roles with permission"
    });
  }
};

// Bulk update role permissions
exports.bulkUpdateRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({
        success: false,
        message: "permission_ids must be an array"
      });
    }

    // Check if role exists
    const role = await Role.findRoleById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    // First, remove all existing permissions for this role
    await RolePermission.removeAllRolePermissions(roleId);

    // Then add the new permissions
    if (permission_ids.length > 0) {
      const grantedBy = req.user.id;
      for (const permissionId of permission_ids) {
        await RolePermission.grantPermissionToRole(roleId, permissionId, grantedBy);
      }
    }

    res.status(200).json({
      success: true,
      message: "Role permissions updated successfully"
    });
  } catch (error) {
    console.error("Error bulk updating role permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating role permissions",
      error: error.message
    });
  }
};
