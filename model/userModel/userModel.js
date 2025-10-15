const pool = require("../../config/DBConnection");

// Create a new user
const createUser = async (user) => {
  const sql = `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, role_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await pool.execute(sql, [
    user.username,
    user.email,
    user.password_hash,
    user.first_name,
    user.last_name,
    user.phone_number,
    user.role_id,
  ]);
  return result.insertId;
};

// Find a user by email
const findUserByEmail = async (email) => {
  const sql = `SELECT * FROM users WHERE email = ?`;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0];
};

// Find a user by ID
const findUserById = async (id) => {
  const sql = `SELECT * FROM users WHERE id = ?`;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0];
};

// Update user details
const updateUser = async (id, user) => {
  const sql = `UPDATE users SET username = ?, email = ?, first_name = ?, last_name = ?, phone_number = ?, role_id = ?, is_active = ? 
               WHERE id = ?`;
  const [result] = await pool.execute(sql, [
    user.username,
    user.email,
    user.first_name,
    user.last_name,
    user.phone_number,
    user.role_id,
    user.is_active,
    id,
  ]);
  return result.affectedRows;
};

// Delete a user
const deleteUser = async (id) => {
  const sql = `DELETE FROM users WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows;
};

// Get all users
const getAllUsers = async () => {
  const sql = `SELECT * FROM users`;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Update the last login timestamp for a user
const updateLastLogin = async (id) => {
  const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
  await pool.execute(sql, [id]);
};

// Update email verification status by email
const updateEmailVerification = async (email) => {
  const sql = `UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE email = ?`;
  const [result] = await pool.execute(sql, [email]);
  return result.affectedRows;
};

// Update email verification status by user ID
const updateEmailVerificationById = async (userId, verified = true) => {
  const sql = `UPDATE users SET email_verified = ?, email_verified_at = NOW() WHERE id = ?`;
  const [result] = await pool.execute(sql, [verified, userId]);
  return result.affectedRows;
};

// Check if email is verified
const isEmailVerified = async (email) => {
  const sql = `SELECT email_verified FROM users WHERE email = ?`;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0]?.email_verified || false;
};

// Get user with roles
const getUserWithRoles = async (id) => {
  const sql = `
    SELECT
      u.id, u.username, u.email, u.first_name, u.last_name, u.phone_number,
      u.role_id, u.is_active, u.created_at, u.updated_at, u.last_login, u.is_super_admin,
      GROUP_CONCAT(DISTINCT r.id) as role_ids,
      GROUP_CONCAT(DISTINCT r.name) as role_names,
      GROUP_CONCAT(DISTINCT r.display_name) as role_display_names
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
    LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = 1
    WHERE u.id = ?
    GROUP BY u.id
  `;
  const [rows] = await pool.execute(sql, [id]);

  if (rows[0]) {
    const user = rows[0];
    // Parse the concatenated role data
    user.roles = [];
    if (user.role_ids) {
      const roleIds = user.role_ids.split(',');
      const roleNames = user.role_names.split(',');
      const roleDisplayNames = user.role_display_names.split(',');

      for (let i = 0; i < roleIds.length; i++) {
        user.roles.push({
          id: parseInt(roleIds[i]),
          name: roleNames[i],
          display_name: roleDisplayNames[i]
        });
      }
    }

    // Clean up the concatenated fields
    delete user.role_ids;
    delete user.role_names;
    delete user.role_display_names;
  }

  return rows[0];
};

// Get all users with their roles
const getAllUsersWithRoles = async () => {
  const sql = `
    SELECT
      u.id, u.username, u.email, u.first_name, u.last_name, u.phone_number,
      u.role_id, u.is_active, u.created_at, u.updated_at, u.last_login, u.is_super_admin,
      GROUP_CONCAT(DISTINCT COALESCE(ur_r.id, pr.id)) as role_ids,
      GROUP_CONCAT(DISTINCT COALESCE(ur_r.name, pr.name)) as role_names,
      GROUP_CONCAT(DISTINCT COALESCE(ur_r.display_name, pr.display_name)) as role_display_names,
      pr.name as primary_role_name,
      pr.display_name as primary_role_display_name
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
    LEFT JOIN roles ur_r ON ur.role_id = ur_r.id AND ur_r.is_active = 1
    LEFT JOIN roles pr ON u.role_id = pr.id AND pr.is_active = 1
    GROUP BY u.id
    ORDER BY u.is_active DESC, u.username
  `;
  const [rows] = await pool.execute(sql);

  // Parse roles for each user
  return rows.map(user => {
    user.roles = [];

    // Handle roles from user_roles table and primary role from users.role_id
    if (user.role_ids) {
      const roleIds = user.role_ids.split(',').filter(id => id && id !== 'null');
      const roleNames = user.role_names.split(',').filter(name => name && name !== 'null');
      const roleDisplayNames = user.role_display_names.split(',').filter(name => name && name !== 'null');

      for (let i = 0; i < roleIds.length; i++) {
        if (roleIds[i] && roleNames[i] && roleDisplayNames[i]) {
          user.roles.push({
            id: parseInt(roleIds[i]),
            name: roleNames[i],
            display_name: roleDisplayNames[i]
          });
        }
      }
    }

    // If no roles found but user has primary role, add it
    if (user.roles.length === 0 && user.primary_role_name) {
      user.roles.push({
        id: parseInt(user.role_id),
        name: user.primary_role_name,
        display_name: user.primary_role_display_name
      });
    }

    // Clean up the concatenated fields
    delete user.role_ids;
    delete user.role_names;
    delete user.role_display_names;
    delete user.primary_role_name;
    delete user.primary_role_display_name;

    return user;
  });
};

// Check if user is super admin (either by is_super_admin flag or by having super_admin role)
const isUserSuperAdmin = async (id) => {
  const sql = `
    SELECT
      u.is_super_admin,
      COUNT(CASE WHEN r.name = 'super_admin' THEN 1 END) as has_super_admin_role
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
    LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = 1
    WHERE u.id = ?
    GROUP BY u.id, u.is_super_admin
  `;
  const [rows] = await pool.execute(sql, [id]);

  if (rows[0]) {
    return rows[0].is_super_admin === 1 || rows[0].has_super_admin_role > 0;
  }

  return false;
};

// Update user password
const updateUserPassword = async (id, hashedPassword) => {
  const sql = `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`;
  const [result] = await pool.execute(sql, [hashedPassword, id]);
  return result.affectedRows;
};

// Export all functions
module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUser,
  getAllUsers,
  updateLastLogin,
  getUserWithRoles,
  getAllUsersWithRoles,
  isUserSuperAdmin,
  updateEmailVerification,
  updateEmailVerificationById,
  isEmailVerified,
  updateUserPassword,
};
