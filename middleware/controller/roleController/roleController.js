// controllers/roleController.js
const Role = require("../../model/roleModel/roleModel");

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if role already exists
    const existingRole = await Role.findRoleByName(name);
    if (existingRole) {
      return res
        .status(400)
        .json({ message: "Role already exists with this name." });
    }

    // Create role
    const roleId = await Role.createRole({ name, description });

    res.status(201).json({ message: "Role created successfully.", roleId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.getAllRoles();
    res.status(200).json({
      success: true,
      message: "Roles retrieved successfully",
      data: roles
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching roles"
    });
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findRoleById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }
    res.json(role);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { name, description } = req.body;
    const roleId = req.params.id;

    // Optionally, add checks to prevent duplicate role names
    const existingRole = await Role.findRoleByName(name);
    if (existingRole && existingRole.id !== parseInt(roleId)) {
      return res
        .status(400)
        .json({ message: "Role name is already in use by another role." });
    }

    const affectedRows = await Role.updateRole(roleId, { name, description });

    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Role not found or no changes made." });
    }

    res.json({ message: "Role updated successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const roleId = req.params.id;
    const affectedRows = await Role.deleteRole(roleId);

    if (affectedRows === 0) {
      return res.status(404).json({ message: "Role not found." });
    }

    res.json({ message: "Role deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};
