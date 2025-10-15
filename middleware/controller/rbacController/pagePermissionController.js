const PagePermission = require("../../model/rbacModel/pagePermissionModel");
const Permission = require("../../model/rbacModel/permissionModel");

// Get all page permissions
exports.getAllPagePermissions = async (req, res) => {
  try {
    const pagePermissions = await PagePermission.getAllPagePermissions();
    res.status(200).json({
      success: true,
      message: "Page permissions retrieved successfully",
      data: pagePermissions
    });
  } catch (error) {
    console.error("Error fetching page permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching page permissions"
    });
  }
};

// Get page permissions by category
exports.getPagePermissionsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const pagePermissions = await PagePermission.getPagePermissionsByCategory(category);
    res.status(200).json({
      success: true,
      message: "Page permissions retrieved successfully",
      data: pagePermissions
    });
  } catch (error) {
    console.error("Error fetching page permissions by category:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching page permissions"
    });
  }
};

// Get page permission by ID
exports.getPagePermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const pagePermission = await PagePermission.getPagePermissionById(id);
    
    if (!pagePermission) {
      return res.status(404).json({
        success: false,
        message: "Page permission not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Page permission retrieved successfully",
      data: pagePermission
    });
  } catch (error) {
    console.error("Error fetching page permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching page permission"
    });
  }
};

// Create new page permission
exports.createPagePermission = async (req, res) => {
  try {
    const {
      page_path,
      page_name,
      page_category,
      required_permission,
      is_public,
      sort_order,
      icon,
      parent_page_id
    } = req.body;

    // Validate required fields
    if (!page_path || !page_name || !page_category) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: page_path, page_name, page_category"
      });
    }

    // Check if page path already exists
    const existingPage = await PagePermission.getPagePermissionByPath(page_path);
    if (existingPage) {
      return res.status(400).json({
        success: false,
        message: "Page with this path already exists"
      });
    }

    // If required_permission is specified, check if it exists
    if (required_permission) {
      const permission = await Permission.getPermissionByName(required_permission);
      if (!permission) {
        return res.status(400).json({
          success: false,
          message: "Required permission does not exist"
        });
      }
    }

    const pageId = await PagePermission.createPagePermission({
      page_path,
      page_name,
      page_category,
      required_permission,
      is_public,
      sort_order,
      icon,
      parent_page_id
    });

    res.status(201).json({
      success: true,
      message: "Page permission created successfully",
      data: { id: pageId }
    });
  } catch (error) {
    console.error("Error creating page permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating page permission"
    });
  }
};

// Update page permission
exports.updatePagePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page_path,
      page_name,
      page_category,
      required_permission,
      is_public,
      is_active,
      sort_order,
      icon,
      parent_page_id
    } = req.body;

    // Check if page permission exists
    const existingPage = await PagePermission.getPagePermissionById(id);
    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: "Page permission not found"
      });
    }

    // Check if path is being changed and if new path already exists
    if (page_path && page_path !== existingPage.page_path) {
      const duplicatePage = await PagePermission.getPagePermissionByPath(page_path);
      if (duplicatePage) {
        return res.status(400).json({
          success: false,
          message: "Page with this path already exists"
        });
      }
    }

    // If required_permission is specified, check if it exists
    if (required_permission) {
      const permission = await Permission.getPermissionByName(required_permission);
      if (!permission) {
        return res.status(400).json({
          success: false,
          message: "Required permission does not exist"
        });
      }
    }

    const affectedRows = await PagePermission.updatePagePermission(id, {
      page_path,
      page_name,
      page_category,
      required_permission,
      is_public,
      is_active,
      sort_order,
      icon,
      parent_page_id
    });

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Page permission not found or no changes made"
      });
    }

    res.status(200).json({
      success: true,
      message: "Page permission updated successfully"
    });
  } catch (error) {
    console.error("Error updating page permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating page permission"
    });
  }
};

// Delete page permission
exports.deletePagePermission = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if page permission exists
    const existingPage = await PagePermission.getPagePermissionById(id);
    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: "Page permission not found"
      });
    }

    const affectedRows = await PagePermission.deletePagePermission(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Page permission not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Page permission deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting page permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting page permission"
    });
  }
};

// Get accessible pages for current user
exports.getAccessiblePagesForCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const pages = await PagePermission.getAccessiblePagesForUser(userId);
    
    res.status(200).json({
      success: true,
      message: "Accessible pages retrieved successfully",
      data: pages
    });
  } catch (error) {
    console.error("Error fetching accessible pages:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accessible pages"
    });
  }
};

// Get accessible pages for specific user
exports.getAccessiblePagesForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const pages = await PagePermission.getAccessiblePagesForUser(userId);
    
    res.status(200).json({
      success: true,
      message: "Accessible pages retrieved successfully",
      data: pages
    });
  } catch (error) {
    console.error("Error fetching accessible pages:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accessible pages"
    });
  }
};

// Check if current user can access specific page
exports.canCurrentUserAccessPage = async (req, res) => {
  try {
    const { pagePath } = req.params;
    const userId = req.user.id;
    
    const canAccess = await PagePermission.canUserAccessPage(userId, pagePath);
    
    res.status(200).json({
      success: true,
      message: "Page access check completed",
      data: { canAccess }
    });
  } catch (error) {
    console.error("Error checking page access:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking page access"
    });
  }
};


