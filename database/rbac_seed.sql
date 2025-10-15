-- RBAC System Seed Data
-- This script populates the database with initial roles, permissions, and page permissions

-- Insert default roles (ensure super_admin gets ID 1)
INSERT INTO roles (id, name, display_name, description, is_system_role) VALUES
(1, 'super_admin', 'Super Administrator', 'Full system access with all permissions', 1),
(2, 'admin', 'Administrator', 'Administrative access to most system features', 1),
(3, 'manager', 'Manager', 'Management level access to user and content management', 1),
(4, 'user', 'User', 'Basic user access to standard features', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  display_name = VALUES(display_name),
  description = VALUES(description),
  is_system_role = VALUES(is_system_role);

-- Insert system permissions
INSERT INTO permissions (name, display_name, description, category, resource, action, is_system_permission) VALUES
-- Dashboard permissions
('dashboard.view', 'View Dashboard', 'Access to main dashboard', 'dashboard', 'dashboard', 'view', 1),

-- User management permissions
('users.view', 'View Users', 'View user list and details', 'users', 'users', 'view', 1),
('users.create', 'Create Users', 'Create new users', 'users', 'users', 'create', 1),
('users.edit', 'Edit Users', 'Edit existing users', 'users', 'users', 'edit', 1),
('users.delete', 'Delete Users', 'Delete users', 'users', 'users', 'delete', 1),

-- Role management permissions
('roles.view', 'View Roles', 'View role list and details', 'roles', 'roles', 'view', 1),
('roles.create', 'Create Roles', 'Create new roles', 'roles', 'roles', 'create', 1),
('roles.edit', 'Edit Roles', 'Edit existing roles', 'roles', 'roles', 'edit', 1),
('roles.delete', 'Delete Roles', 'Delete roles', 'roles', 'roles', 'delete', 1),

-- Permission management permissions
('permissions.view', 'View Permissions', 'View permission list and details', 'permissions', 'permissions', 'view', 1),
('permissions.create', 'Create Permissions', 'Create new permissions', 'permissions', 'permissions', 'create', 1),
('permissions.edit', 'Edit Permissions', 'Edit existing permissions', 'permissions', 'permissions', 'edit', 1),
('permissions.delete', 'Delete Permissions', 'Delete permissions', 'permissions', 'permissions', 'delete', 1),

-- Role permission management
('role_permissions.view', 'View Role Permissions', 'View role permission assignments', 'role_permissions', 'role_permissions', 'view', 1),
('role_permissions.manage', 'Manage Role Permissions', 'Assign/revoke permissions to/from roles', 'role_permissions', 'role_permissions', 'manage', 1),

-- User permission management
('user_permissions.view', 'View User Permissions', 'View user permission assignments', 'user_permissions', 'user_permissions', 'view', 1),
('user_permissions.manage', 'Manage User Permissions', 'Assign/revoke permissions to/from users', 'user_permissions', 'user_permissions', 'manage', 1),

-- Page permission management
('page_permissions.view', 'View Page Permissions', 'View page permission settings', 'page_permissions', 'page_permissions', 'view', 1),
('page_permissions.manage', 'Manage Page Permissions', 'Manage page access permissions', 'page_permissions', 'page_permissions', 'manage', 1),

-- Agent management permissions
('agents.view', 'View Agents', 'View agent list and details', 'agents', 'agents', 'view', 1),
('agents.create', 'Create Agents', 'Create new agents', 'agents', 'agents', 'create', 1),
('agents.edit', 'Edit Agents', 'Edit existing agents', 'agents', 'agents', 'edit', 1),
('agents.delete', 'Delete Agents', 'Delete agents', 'agents', 'agents', 'delete', 1),

-- Default Assistant Template permissions
('default_assistants.view', 'View Default Assistants', 'View default assistant templates', 'default_assistants', 'default_assistants', 'view', 1),
('default_assistants.create', 'Create Default Assistants', 'Create new default assistant templates', 'default_assistants', 'default_assistants', 'create', 1),
('default_assistants.edit', 'Edit Default Assistants', 'Edit existing default assistant templates', 'default_assistants', 'default_assistants', 'edit', 1),
('default_assistants.delete', 'Delete Default Assistants', 'Delete default assistant templates', 'default_assistants', 'default_assistants', 'delete', 1),
('default_assistants.manage', 'Manage Default Assistants', 'Full management of default assistant templates', 'default_assistants', 'default_assistants', 'manage', 1),

-- Contact management permissions
('contacts.view', 'View Contacts', 'View contact list and details', 'contacts', 'contacts', 'view', 1),
('contacts.create', 'Create Contacts', 'Create new contacts', 'contacts', 'contacts', 'create', 1),
('contacts.edit', 'Edit Contacts', 'Edit existing contacts', 'contacts', 'contacts', 'edit', 1),
('contacts.delete', 'Delete Contacts', 'Delete contacts', 'contacts', 'contacts', 'delete', 1),

-- Campaign management permissions
('campaigns.view', 'View Campaigns', 'View campaign list and details', 'campaigns', 'campaigns', 'view', 1),
('campaigns.create', 'Create Campaigns', 'Create new campaigns', 'campaigns', 'campaigns', 'create', 1),
('campaigns.edit', 'Edit Campaigns', 'Edit existing campaigns', 'campaigns', 'campaigns', 'edit', 1),
('campaigns.delete', 'Delete Campaigns', 'Delete campaigns', 'campaigns', 'campaigns', 'delete', 1),

-- Workflow management permissions
('workflows.view', 'View Workflows', 'View workflow list and details', 'workflows', 'workflows', 'view', 1),
('workflows.create', 'Create Workflows', 'Create new workflows', 'workflows', 'workflows', 'create', 1),
('workflows.edit', 'Edit Workflows', 'Edit existing workflows', 'workflows', 'workflows', 'edit', 1),
('workflows.delete', 'Delete Workflows', 'Delete workflows', 'workflows', 'workflows', 'delete', 1),

-- Audit Log permissions
('audit_logs.view', 'View Audit Logs', 'View audit log entries', 'system', 'audit_logs', 'view', 1),
('audit_logs.export', 'Export Audit Logs', 'Export audit logs to Excel', 'system', 'audit_logs', 'export', 1),
('audit_logs.delete', 'Delete Audit Logs', 'Delete old audit log entries', 'system', 'audit_logs', 'delete', 1),

-- Support permissions
('support.view', 'View Support', 'View support tickets', 'support', 'support', 'view', 1),
('support.create', 'Create Support', 'Create new support tickets', 'support', 'support', 'create', 1),
('support.edit', 'Edit Support', 'Edit existing support tickets', 'support', 'support', 'edit', 1),
('support.delete', 'Delete Support', 'Delete support tickets', 'support', 'support', 'delete', 1),

-- Settings permissions
('settings.view', 'View Settings', 'View system settings', 'settings', 'settings', 'view', 1),
('settings.edit', 'Edit Settings', 'Edit system settings', 'settings', 'settings', 'edit', 1)

ON DUPLICATE KEY UPDATE 
  display_name = VALUES(display_name),
  description = VALUES(description),
  category = VALUES(category),
  resource = VALUES(resource),
  action = VALUES(action);

-- Insert page permissions
INSERT INTO page_permissions (page_path, page_name, page_category, required_permission, is_public, sort_order, icon) VALUES
-- Public pages
('/login', 'Login', 'auth', NULL, 1, 0, 'LogIn'),
('/register', 'Register', 'auth', NULL, 1, 1, 'UserPlus'),

-- Dashboard
('/dashboard', 'Dashboard', 'main', 'dashboard.view', 0, 10, 'Home'),

-- Agent management
('/agents', 'Agents', 'management', 'agents.view', 0, 20, 'UserCog'),
('/models', 'Models', 'management', 'agents.view', 0, 21, 'Zap'),
('/voices', 'Voices', 'management', 'agents.view', 0, 22, 'Volume2'),
('/phone-numbers', 'Phone Numbers', 'management', 'agents.view', 0, 23, 'Phone'),

-- Default Assistant Templates (Super Admin only)
('/default-assistants', 'Default Assistants', 'admin', 'default_assistants.manage', 0, 24, 'Bot'),

-- Campaign management
('/outbound', 'Campaigns', 'campaigns', 'campaigns.view', 0, 30, 'Megaphone'),
('/workflows', 'Workflows', 'campaigns', 'workflows.view', 0, 31, 'Workflow'),
('/webhooks', 'Webhooks', 'campaigns', 'workflows.view', 0, 32, 'Webhook'),

-- Contact management
('/lists', 'Contacts', 'contacts', 'contacts.view', 0, 40, 'List'),

-- User management (Super Admin only)
('/users', 'User Management', 'admin', 'users.view', 0, 85, 'Users'),

-- Role management (Super Admin only)
('/roles', 'Roles', 'admin', 'roles.view', 0, 90, 'Shield'),
('/permissions', 'Permissions', 'admin', 'permissions.view', 0, 91, 'Key'),
('/role-permissions', 'Role Permissions', 'admin', 'role_permissions.view', 0, 92, 'Users'),

-- System monitoring
('/audit-logs', 'Audit Logs', 'system', 'audit_logs.view', 0, 95, 'FileText'),

-- Support
('/support', 'Support', 'help', 'support.view', 0, 98, 'MessageCircleQuestion'),

-- Settings
('/settings', 'Settings', 'system', 'settings.view', 0, 100, 'Settings')

ON DUPLICATE KEY UPDATE 
  page_name = VALUES(page_name),
  page_category = VALUES(page_category),
  required_permission = VALUES(required_permission),
  is_public = VALUES(is_public),
  sort_order = VALUES(sort_order),
  icon = VALUES(icon);

-- Assign all permissions to super_admin role
INSERT INTO role_permissions (role_id, permission_id, granted_by)
SELECT 
  r.id as role_id,
  p.id as permission_id,
  1 as granted_by
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = CURRENT_TIMESTAMP;

-- Assign basic permissions to admin role
INSERT INTO role_permissions (role_id, permission_id, granted_by)
SELECT 
  r.id as role_id,
  p.id as permission_id,
  1 as granted_by
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' 
AND p.name IN (
  'dashboard.view',
  'users.view', 'users.create', 'users.edit',
  'agents.view', 'agents.create', 'agents.edit',
  'contacts.view', 'contacts.create', 'contacts.edit',
  'campaigns.view', 'campaigns.create', 'campaigns.edit',
  'workflows.view', 'workflows.create', 'workflows.edit',
  'settings.view'
)
ON DUPLICATE KEY UPDATE granted_at = CURRENT_TIMESTAMP;

-- Assign basic permissions to manager role
INSERT INTO role_permissions (role_id, permission_id, granted_by)
SELECT 
  r.id as role_id,
  p.id as permission_id,
  1 as granted_by
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager' 
AND p.name IN (
  'dashboard.view',
  'users.view',
  'agents.view', 'agents.create', 'agents.edit',
  'contacts.view', 'contacts.create', 'contacts.edit',
  'campaigns.view', 'campaigns.create', 'campaigns.edit',
  'workflows.view', 'workflows.create', 'workflows.edit'
)
ON DUPLICATE KEY UPDATE granted_at = CURRENT_TIMESTAMP;

-- Assign basic permissions to user role
INSERT INTO role_permissions (role_id, permission_id, granted_by)
SELECT 
  r.id as role_id,
  p.id as permission_id,
  1 as granted_by
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user' 
AND p.name IN (
  'dashboard.view',
  'agents.view',
  'contacts.view',
  'campaigns.view',
  'workflows.view'
)
ON DUPLICATE KEY UPDATE granted_at = CURRENT_TIMESTAMP;
