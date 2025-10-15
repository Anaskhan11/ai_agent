const UserRole = require("../../model/rbacModel/userRoleModel");
const User = require("../../model/userModel/userModel");
const Role = require("../../model/roleModel/roleModel");

// Get all user roles
exports.getAllUserRoles = async (req, res) => {
  try {
    const userRoles = await UserRole.getAllUserRoles();
    res.status(200).json({
      success: true,
      message: "User roles retrieved successfully",
      data: userRoles
    });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user roles"
    });
  }
};

// Get user roles by user ID
exports.getUserRoles = async (req, res) => {
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

    const userRoles = await UserRole.getUserRolesByUserId(userId);
    res.status(200).json({
      success: true,
      message: "User roles retrieved successfully",
      data: userRoles
    });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user roles"
    });
  }
};

// Get users by role ID
exports.getUsersByRole = async (req, res) => {
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

    const users = await UserRole.getUsersByRoleId(roleId);
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users
    });
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users"
    });
  }
};

// Assign role to user
exports.assignRoleToUser = async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const { expiresAt } = req.body;
    const assignedBy = req.user.id;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    const result = await UserRole.assignRoleToUser(userId, roleId, assignedBy, expiresAt);
    
    res.status(200).json({
      success: true,
      message: "Role assigned to user successfully",
      data: { id: result }
    });
  } catch (error) {
    console.error("Error assigning role to user:", error);
    if (error.message === 'Role already assigned to this user') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while assigning role"
    });
  }
};

// Remove role from user
exports.removeRoleFromUser = async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
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

    const result = await UserRole.removeRoleFromUser(userId, roleId);
    
    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: "Role assignment not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Role removed from user successfully"
    });
  } catch (error) {
    console.error("Error removing role from user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing role"
    });
  }
};

// Bulk assign roles to user
exports.bulkAssignRolesToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleIds, expiresAt } = req.body;
    const assignedBy = req.user.id;

    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Validate role IDs if provided
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        const role = await Role.findRoleById(roleId);
        if (!role) {
          return res.status(404).json({
            success: false,
            message: `Role with ID ${roleId} not found`
          });
        }
      }
    }

    await UserRole.bulkAssignRolesToUser(userId, roleIds, assignedBy, expiresAt);
    
    res.status(200).json({
      success: true,
      message: "Roles assigned to user successfully"
    });
  } catch (error) {
    console.error("Error bulk assigning roles to user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while assigning roles"
    });
  }
};

// Get user comprehensive permissions
exports.getUserComprehensivePermissions = async (req, res) => {
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

    const permissions = await UserRole.getUserComprehensivePermissions(userId);
    res.status(200).json({
      success: true,
      message: "User permissions retrieved successfully",
      data: permissions
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching permissions"
    });
  }
};

// Check if user has specific role
exports.checkUserRole = async (req, res) => {
  try {
    const { userId, roleName } = req.params;
    
    // Check if user exists
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const hasRole = await UserRole.checkUserRole(userId, roleName);
    res.status(200).json({
      success: true,
      message: "Role check completed",
      data: { hasRole }
    });
  } catch (error) {
    console.error("Error checking user role:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking role"
    });
  }
};

// Get expired user roles
exports.getExpiredUserRoles = async (req, res) => {
  try {
    const expiredRoles = await UserRole.getExpiredUserRoles();
    res.status(200).json({
      success: true,
      message: "Expired user roles retrieved successfully",
      data: expiredRoles
    });
  } catch (error) {
    console.error("Error fetching expired user roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching expired roles"
    });
  }
};

// Clean up expired roles
exports.cleanupExpiredRoles = async (req, res) => {
  try {
    const affectedRows = await UserRole.cleanupExpiredRoles();
    res.status(200).json({
      success: true,
      message: `Cleaned up ${affectedRows} expired role assignments`,
      data: { affectedRows }
    });
  } catch (error) {
    console.error("Error cleaning up expired roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cleaning up expired roles"
    });
  }
};
