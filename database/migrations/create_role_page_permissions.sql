-- Create role_page_permissions table for managing page-level permissions per role
-- This table allows granular control over what pages each role can access and what actions they can perform

CREATE TABLE IF NOT EXISTS `role_page_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int UNSIGNED NOT NULL,
  `page_id` int NOT NULL,
  `can_view` tinyint(1) DEFAULT '0',
  `can_add` tinyint(1) DEFAULT '0',
  `can_update` tinyint(1) DEFAULT '0',
  `can_delete` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int UNSIGNED DEFAULT NULL,
  `updated_by` int UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_page` (`role_id`, `page_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_role_page_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_page_permissions_page` FOREIGN KEY (`page_id`) REFERENCES `page_permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_page_permissions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_role_page_permissions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default permissions for super_admin role (full access to all pages)
INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
SELECT 
  r.id as role_id,
  pp.id as page_id,
  1 as can_view,
  1 as can_add,
  1 as can_update,
  1 as can_delete,
  1 as created_by
FROM roles r
CROSS JOIN page_permissions pp
WHERE r.name = 'super_admin' AND pp.is_active = 1
ON DUPLICATE KEY UPDATE
  can_view = 1,
  can_add = 1,
  can_update = 1,
  can_delete = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Insert default permissions for admin role (most pages with full access, except super admin specific pages)
INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
SELECT 
  r.id as role_id,
  pp.id as page_id,
  1 as can_view,
  1 as can_add,
  1 as can_update,
  1 as can_delete,
  1 as created_by
FROM roles r
CROSS JOIN page_permissions pp
WHERE r.name = 'admin' 
  AND pp.is_active = 1 
  AND pp.page_path NOT IN ('/roles', '/super-admin')
ON DUPLICATE KEY UPDATE
  can_view = 1,
  can_add = 1,
  can_update = 1,
  can_delete = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Insert default permissions for manager role (limited access)
INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
SELECT 
  r.id as role_id,
  pp.id as page_id,
  1 as can_view,
  CASE 
    WHEN pp.page_path IN ('/agents', '/contacts', '/lists', '/campaigns', '/workflows') THEN 1 
    ELSE 0 
  END as can_add,
  CASE 
    WHEN pp.page_path IN ('/agents', '/contacts', '/lists', '/campaigns', '/workflows') THEN 1 
    ELSE 0 
  END as can_update,
  0 as can_delete,
  1 as created_by
FROM roles r
CROSS JOIN page_permissions pp
WHERE r.name = 'manager' 
  AND pp.is_active = 1 
  AND pp.page_path IN ('/dashboard', '/agents', '/models', '/voices', '/phone-numbers', '/contacts', '/lists', '/campaigns', '/workflows', '/settings')
ON DUPLICATE KEY UPDATE
  can_view = 1,
  can_add = VALUES(can_add),
  can_update = VALUES(can_update),
  can_delete = 0,
  updated_at = CURRENT_TIMESTAMP;

-- Insert default permissions for user role (read-only access to basic pages)
INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
SELECT 
  r.id as role_id,
  pp.id as page_id,
  1 as can_view,
  0 as can_add,
  0 as can_update,
  0 as can_delete,
  1 as created_by
FROM roles r
CROSS JOIN page_permissions pp
WHERE r.name = 'user' 
  AND pp.is_active = 1 
  AND pp.page_path IN ('/dashboard', '/agents', '/contacts', '/lists', '/settings')
ON DUPLICATE KEY UPDATE
  can_view = 1,
  can_add = 0,
  can_update = 0,
  can_delete = 0,
  updated_at = CURRENT_TIMESTAMP;
