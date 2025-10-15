const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const Role = require("../model/roleModel/roleModel");
const Permission = require("../model/rbacModel/permissionModel");
const PagePermission = require("../model/rbacModel/pagePermissionModel");
dotenv.config();

const secretKey = process.env.JWT_SECRET || "ASAJKLDSLKDJLASJDLA";

// Enhanced auth middleware that includes full permission context
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
          } else {
            // Demo login structure: { id, email, ... }
            user = decoded;
          }

          // Enhance user object with comprehensive role and permission information
          if (user.role_id) {
            try {
              // Get role information
              const role = await Role.findRoleById(user.role_id);
              if (role) {
                user.role = role;
                user.isSuperAdmin = await Role.isSuperAdminRole(user.role_id) || user.role_id === 1;
              }

              // Get all user permissions (role-based + direct)
              const permissions = await Permission.getPermissionsByUserId(user.id);
              user.permissions = permissions.map(p => p.name);
              user.permissionDetails = permissions;

              // Get accessible pages
              const accessiblePages = await PagePermission.getAccessiblePagesForUser(user.id);
              user.accessiblePages = accessiblePages;

              // Create permission checker function
              user.hasPermission = (permissionName) => {
                return user.isSuperAdmin || user.permissions.includes(permissionName);
              };

              // Create page access checker function
              user.canAccessPage = (pagePath) => {
                return user.isSuperAdmin || user.accessiblePages.some(page => page.page_path === pagePath);
              };

            } catch (enhancementError) {
              console.error("Error enhancing user context:", enhancementError);
              // Continue with basic user information
              user.permissions = [];
              user.permissionDetails = [];
              user.accessiblePages = [];
              user.isSuperAdmin = false;
              user.hasPermission = () => false;
              user.canAccessPage = () => false;
            }
          } else {
            // No role assigned
            user.permissions = [];
            user.permissionDetails = [];
            user.accessiblePages = [];
            user.isSuperAdmin = false;
            user.hasPermission = () => false;
            user.canAccessPage = () => false;
          }

          req.user = user;
          next();
        } catch (error) {
          console.error("Error in enhanced auth middleware:", error);
          // Fallback to basic user information
          if (decoded.user) {
            req.user = decoded.user;
          } else {
            req.user = decoded;
          }
          // Add empty permission context
          req.user.permissions = [];
          req.user.permissionDetails = [];
          req.user.accessiblePages = [];
          req.user.isSuperAdmin = false;
          req.user.hasPermission = () => false;
          req.user.canAccessPage = () => false;
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
