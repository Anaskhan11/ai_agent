const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const Role = require("../model/roleModel/roleModel");
const Permission = require("../model/rbacModel/permissionModel");
const UserRole = require("../model/rbacModel/userRoleModel");
const RolePagePermission = require("../model/rbacModel/rolePagePermissionModel");
const User = require("../model/userModel/userModel");
dotenv.config();

const secretKey = process.env.JWT_SECRET || "ASAJKLDSLKDJLASJDLA";

module.exports = function (req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!authHeader) {
    console.error("Authorization header missing.");
  } else if (!token) {
    console.error("Bearer token missing.");
  }

  if (token) {
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        console.error("Token verification failed:", err.message);
        return res
          .status(401)
          .json({ status: false, message: "Invalid token" });
      } else {
        try {
          // Normalize token structure - handle both regular login and demo login
          let user;
          if (decoded.user) {
            // Regular login structure: { user: { id, email, ... } }
            user = decoded.user;
          } else if (decoded.userId) {
            // Demo login structure: { userId, email, ... }
            user = {
              id: decoded.userId,
              email: decoded.email,
              ...decoded
            };
          } else {
            // Fallback structure: { id, email, ... }
            user = decoded;
          }

          // Enhance user object with comprehensive role and permission information
          try {
            // Get user with all roles
            const userWithRoles = await User.getUserWithRoles(user.id);
            if (userWithRoles) {
              user.roles = userWithRoles.roles || [];

              // Check if user is super admin (either by flag or by having super_admin role)
              user.isSuperAdmin = await User.isUserSuperAdmin(user.id);

              // Get primary role (from role_id field for backward compatibility)
              if (user.role_id) {
                const primaryRole = await Role.findRoleById(user.role_id);
                if (primaryRole) {
                  user.role = primaryRole;
                }
              }

              // Get comprehensive permissions from all roles
              const comprehensivePermissions = await UserRole.getUserComprehensivePermissions(user.id);
              user.permissions = comprehensivePermissions || [];

              // Get page permissions
              const pagePermissions = await RolePagePermission.getUserPagePermissions(user.id);
              user.pagePermissions = pagePermissions || [];

              // Create permission lookup for quick access
              user.permissionNames = user.permissions.map(p => p.permission_name);
              user.roleNames = user.roles.map(r => r.name);
            }
          } catch (enhancementError) {
            console.error("Error enhancing user context:", enhancementError);
            // Fallback to basic role information
            if (user.role_id) {
              try {
                const role = await Role.findRoleById(user.role_id);
                if (role) {
                  user.role = role;
                  user.isSuperAdmin = await Role.isSuperAdminRole(user.role_id) || user.role_id === 1;
                }
              } catch (roleError) {
                console.error("Error fetching fallback role:", roleError);
              }
            }
          }

          req.user = user;
          next();
        } catch (error) {
          console.error("Error enhancing user context:", error);
          // Continue with basic user information
          if (decoded.user) {
            req.user = decoded.user;
          } else {
            req.user = decoded;
          }
          next();
        }
      }
    });
  } else {
    return res
      .status(403)
      .json({ status: false, message: "No token provided" });
  }
};
