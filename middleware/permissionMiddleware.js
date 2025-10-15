const Permission = require("../model/rbacModel/permissionModel");
const RolePermission = require("../model/rbacModel/rolePermissionModel");
const UserPermission = require("../model/rbacModel/userPermissionModel");
const PagePermission = require("../model/rbacModel/pagePermissionModel");
const Role = require("../model/roleModel/roleModel");
const UserRole = require("../model/rbacModel/userRoleModel");
const RolePagePermission = require("../model/rbacModel/rolePagePermissionModel");
const User = require("../model/userModel/userModel");

// Check if user has specific permission (either through role or direct assignment)
const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoleId = req.user.role_id;

      // Check if user is super admin (bypass all permission checks)
      if (userRoleId) {
        const isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
        if (isSuperAdmin) {
          return next();
        }
      }

      // Additional check for role ID 1 (fallback for super admin)
      if (userRoleId === 1) {
        return next();
      }

      // Check role-based permission
      let hasRolePermission = false;
      if (userRoleId) {
        hasRolePermission = await RolePermission.checkRolePermission(userRoleId, permissionName);
      }

      // Check direct user permission
      const hasUserPermission = await UserPermission.checkUserPermission(userId, permissionName);

      if (hasRolePermission || hasUserPermission) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        required_permission: permissionName
      });
    } catch (error) {
      console.error("Error checking permission:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions"
      });
    }
  };
};

// Check if user has any of the specified permissions
const checkAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoleId = req.user.role_id;

      // Check if user is super admin (bypass all permission checks)
      if (userRoleId) {
        const isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
        if (isSuperAdmin || userRoleId === 1) {
          return next();
        }
      }

      // Check each permission
      for (const permissionName of permissionNames) {
        // Check role-based permission
        let hasRolePermission = false;
        if (userRoleId) {
          hasRolePermission = await RolePermission.checkRolePermission(userRoleId, permissionName);
        }

        // Check direct user permission
        const hasUserPermission = await UserPermission.checkUserPermission(userId, permissionName);

        if (hasRolePermission || hasUserPermission) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        required_permissions: permissionNames
      });
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions"
      });
    }
  };
};

// Check if user has all specified permissions
const checkAllPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoleId = req.user.role_id;

      // Check if user is super admin (bypass all permission checks)
      if (userRoleId) {
        const isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
        if (isSuperAdmin || userRoleId === 1) {
          return next();
        }
      }

      // Check all permissions
      for (const permissionName of permissionNames) {
        // Check role-based permission
        let hasRolePermission = false;
        if (userRoleId) {
          hasRolePermission = await RolePermission.checkRolePermission(userRoleId, permissionName);
        }

        // Check direct user permission
        const hasUserPermission = await UserPermission.checkUserPermission(userId, permissionName);

        if (!hasRolePermission && !hasUserPermission) {
          return res.status(403).json({
            success: false,
            message: "Access denied. Insufficient permissions.",
            missing_permission: permissionName
          });
        }
      }

      return next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions"
      });
    }
  };
};

// Check if user can access specific page
const checkPageAccess = (pagePath) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRoleId = req.user.role_id;

      // Check if user is super admin (bypass all permission checks)
      if (userRoleId) {
        const isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
        if (isSuperAdmin || userRoleId === 1) {
          return next();
        }
      }

      const canAccess = await PagePermission.canUserAccessPage(userId, pagePath);

      if (canAccess) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to access this page.",
        page_path: pagePath
      });
    } catch (error) {
      console.error("Error checking page access:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking page access"
      });
    }
  };
};

// Check if user has minimum role hierarchy level
const checkMinRoleLevel = (minLevel) => {
  return async (req, res, next) => {
    try {
      const userRoleId = req.user.role_id;

      if (!userRoleId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. No role assigned."
        });
      }

      const role = await Role.findRoleById(userRoleId);
      if (!role) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Invalid role."
        });
      }

      if (role.hierarchy_level >= minLevel) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient role level.",
        required_level: minLevel,
        current_level: role.hierarchy_level
      });
    } catch (error) {
      console.error("Error checking role level:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking role level"
      });
    }
  };
};

// Check if user is super admin
const checkSuperAdmin = async (req, res, next) => {
  try {
    const userRoleId = req.user.role_id;

    if (!userRoleId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No role assigned."
      });
    }

    const isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
    if (isSuperAdmin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied. Super admin privileges required."
    });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while checking super admin status"
    });
  }
};

// Middleware to attach user permissions to request object
const attachUserPermissions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRoleId = req.user.role_id;

    // Get all user permissions (role-based + direct)
    const permissions = await Permission.getPermissionsByUserId(userId);
    
    // Get accessible pages
    const accessiblePages = await PagePermission.getAccessiblePagesForUser(userId);

    // Check if super admin
    let isSuperAdmin = false;
    if (userRoleId) {
      isSuperAdmin = await Role.isSuperAdminRole(userRoleId);
    }

    // Attach to request object
    req.userPermissions = {
      permissions: permissions.map(p => p.name),
      permissionDetails: permissions,
      accessiblePages,
      isSuperAdmin
    };

    next();
  } catch (error) {
    console.error("Error attaching user permissions:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading user permissions"
    });
  }
};

// Enhanced permission check that supports multiple roles
const checkPermissionEnhanced = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check if user is super admin (bypass all permission checks)
      const isSuperAdmin = await User.isUserSuperAdmin(userId);
      if (isSuperAdmin) {
        return next();
      }

      // Get comprehensive permissions from all user roles
      const comprehensivePermissions = await UserRole.getUserComprehensivePermissions(userId);
      const hasPermission = comprehensivePermissions.some(p => p.permission_name === permissionName);

      if (hasPermission) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        required_permission: permissionName
      });
    } catch (error) {
      console.error("Error checking permission:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions"
      });
    }
  };
};

// Enhanced role check that supports multiple roles
const checkRoleEnhanced = (roleNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check if user is super admin (bypass all role checks)
      const isSuperAdmin = await User.isUserSuperAdmin(userId);
      if (isSuperAdmin) {
        return next();
      }

      // Get user roles
      const userRoles = await UserRole.getUserRolesByUserId(userId);
      const userRoleNames = userRoles.map(r => r.role_name);

      // Check if user has any of the required roles
      const hasRequiredRole = Array.isArray(roleNames)
        ? roleNames.some(role => userRoleNames.includes(role))
        : userRoleNames.includes(roleNames);

      if (hasRequiredRole) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient role privileges.",
        required_roles: Array.isArray(roleNames) ? roleNames : [roleNames]
      });
    } catch (error) {
      console.error("Error checking role:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking role"
      });
    }
  };
};

// Enhanced page permission check
const checkPagePermissionEnhanced = (pagePath, permissionType = 'can_view') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check if user is super admin (bypass all permission checks)
      const isSuperAdmin = await User.isUserSuperAdmin(userId);
      if (isSuperAdmin) {
        return next();
      }

      // Get page permissions
      const pagePermissions = await RolePagePermission.getUserPagePermissions(userId);
      const pagePermission = pagePermissions.find(p => p.page_path === pagePath);

      if (pagePermission && pagePermission[permissionType]) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Access denied. Required page permission: ${permissionType} on ${pagePath}`
      });
    } catch (error) {
      console.error("Error checking page permission:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking page permission"
      });
    }
  };
};

// Enhanced super admin check
const checkSuperAdminEnhanced = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isSuperAdmin = await User.isUserSuperAdmin(userId);

    if (isSuperAdmin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied. Super admin privileges required."
    });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while checking super admin status"
    });
  }
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  checkPageAccess,
  checkMinRoleLevel,
  checkSuperAdmin,
  attachUserPermissions,
  // Enhanced versions
  checkPermissionEnhanced,
  checkRoleEnhanced,
  checkPagePermissionEnhanced,
  checkSuperAdminEnhanced
};
