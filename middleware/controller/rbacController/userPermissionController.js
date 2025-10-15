const UserPermission = require("../../model/rbacModel/userPermissionModel");
const User = require("../../model/userModel/userModel");
const Permission = require("../../model/rbacModel/permissionModel");

// Get all user permissions
exports.getAllUserPermissions = async (req, res) => {
  try {
    const userPermissions = await UserPermission.getAllUserPermissions();
    res.status(200).json({
      success: true,
      message: "User permissions retrieved successfully",
      data: userPermissions
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user permissions"
    });
  }
};

// Get user permissions by user ID
exports.getUserPermissionsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const userPermissions = await UserPermission.getUserPermissionsByUserId(userId);
    res.status(200).json({
      success: true,
      message: "User permissions retrieved successfully",
      data: userPermissions
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user permissions"
    });
  }
};

// Grant permission to user
exports.grantPermissionToUser = async (req, res) => {
  try {
    const { userId, permissionId } = req.params;
    const { expires_at, reason } = req.body;
    const grantedBy = req.user.id;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    const result = await UserPermission.grantPermissionToUser(
      userId, 
      permissionId, 
      grantedBy, 
      expires_at, 
      reason
    );
    
    res.status(200).json({
      success: true,
      message: "Permission granted to user successfully",
      data: { id: result }
    });
  } catch (error) {
    console.error("Error granting permission to user:", error);
    if (error.message === 'Permission already granted to this user') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while granting permission to user"
    });
  }
};

// Revoke permission from user
exports.revokePermissionFromUser = async (req, res) => {
  try {
    const { userId, permissionId } = req.params;
    const { reason } = req.body;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    const affectedRows = await UserPermission.revokePermissionFromUser(userId, permissionId, reason);
    
    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Permission not found for this user"
      });
    }

    res.status(200).json({
      success: true,
      message: "Permission revoked from user successfully"
    });
  } catch (error) {
    console.error("Error revoking permission from user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while revoking permission from user"
    });
  }
};

// Bulk grant permissions to user
exports.bulkGrantPermissionsToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissionIds, expires_at, reason } = req.body;
    const grantedBy = req.user.id;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    await UserPermission.bulkGrantPermissionsToUser(
      userId, 
      permissionIds, 
      grantedBy, 
      expires_at, 
      reason
    );
    
    res.status(200).json({
      success: true,
      message: "Permissions granted to user successfully"
    });
  } catch (error) {
    console.error("Error bulk granting permissions to user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while granting permissions to user"
    });
  }
};

// Check if user has specific permission
exports.checkUserPermission = async (req, res) => {
  try {
    const { userId, permissionName } = req.params;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const hasPermission = await UserPermission.checkUserPermission(userId, permissionName);
    
    res.status(200).json({
      success: true,
      message: "Permission check completed",
      data: { hasPermission }
    });
  } catch (error) {
    console.error("Error checking user permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking user permission"
    });
  }
};

// Get users with specific permission
exports.getUsersWithPermission = async (req, res) => {
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

    const users = await UserPermission.getUsersWithPermission(permissionId);
    
    res.status(200).json({
      success: true,
      message: "Users with permission retrieved successfully",
      data: users
    });
  } catch (error) {
    console.error("Error fetching users with permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users with permission"
    });
  }
};

// Get expired user permissions
exports.getExpiredUserPermissions = async (req, res) => {
  try {
    const expiredPermissions = await UserPermission.getExpiredUserPermissions();
    
    res.status(200).json({
      success: true,
      message: "Expired user permissions retrieved successfully",
      data: expiredPermissions
    });
  } catch (error) {
    console.error("Error fetching expired user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching expired user permissions"
    });
  }
};

// Clean up expired permissions
exports.cleanupExpiredPermissions = async (req, res) => {
  try {
    const affectedRows = await UserPermission.cleanupExpiredPermissions();
    
    res.status(200).json({
      success: true,
      message: "Expired permissions cleaned up successfully",
      data: { affectedRows }
    });
  } catch (error) {
    console.error("Error cleaning up expired permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cleaning up expired permissions"
    });
  }
};
