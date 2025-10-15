-- Database Triggers for Comprehensive Audit Logging
-- These triggers capture database operations that bypass the middleware

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS users_insert_audit;
DROP TRIGGER IF EXISTS users_update_audit;
DROP TRIGGER IF EXISTS users_delete_audit;

DROP TRIGGER IF EXISTS contacts_insert_audit;
DROP TRIGGER IF EXISTS contacts_update_audit;
DROP TRIGGER IF EXISTS contacts_delete_audit;

DROP TRIGGER IF EXISTS roles_insert_audit;
DROP TRIGGER IF EXISTS roles_update_audit;
DROP TRIGGER IF EXISTS roles_delete_audit;

DROP TRIGGER IF EXISTS assistants_insert_audit;
DROP TRIGGER IF EXISTS assistants_update_audit;
DROP TRIGGER IF EXISTS assistants_delete_audit;

DROP TRIGGER IF EXISTS phone_numbers_insert_audit;
DROP TRIGGER IF EXISTS phone_numbers_update_audit;
DROP TRIGGER IF EXISTS phone_numbers_delete_audit;

DROP TRIGGER IF EXISTS outbound_calls_insert_audit;
DROP TRIGGER IF EXISTS outbound_calls_update_audit;
DROP TRIGGER IF EXISTS outbound_calls_delete_audit;

-- Users table triggers
DELIMITER $$

CREATE TRIGGER users_insert_audit
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        NEW.id, NEW.email, CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')),
        'CREATE', 'users', NEW.id,
        NULL, JSON_OBJECT(
            'id', NEW.id,
            'username', NEW.username,
            'email', NEW.email,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'phone_number', NEW.phone_number,
            'role_id', NEW.role_id,
            'is_active', NEW.is_active,
            'email_verified', NEW.email_verified
        ), NULL, 'Database Server', 'Database Trigger',
        'DATABASE', '/database/users', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'users_insert_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

CREATE TRIGGER users_update_audit
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        NEW.id, NEW.email, CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')),
        'UPDATE', 'users', NEW.id,
        JSON_OBJECT(
            'id', OLD.id,
            'username', OLD.username,
            'email', OLD.email,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'phone_number', OLD.phone_number,
            'role_id', OLD.role_id,
            'is_active', OLD.is_active,
            'email_verified', OLD.email_verified
        ),
        JSON_OBJECT(
            'id', NEW.id,
            'username', NEW.username,
            'email', NEW.email,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'phone_number', NEW.phone_number,
            'role_id', NEW.role_id,
            'is_active', NEW.is_active,
            'email_verified', NEW.email_verified
        ), 
        JSON_ARRAY(
            CASE WHEN OLD.username != NEW.username THEN 'username' END,
            CASE WHEN OLD.email != NEW.email THEN 'email' END,
            CASE WHEN OLD.first_name != NEW.first_name THEN 'first_name' END,
            CASE WHEN OLD.last_name != NEW.last_name THEN 'last_name' END,
            CASE WHEN OLD.phone_number != NEW.phone_number THEN 'phone_number' END,
            CASE WHEN OLD.role_id != NEW.role_id THEN 'role_id' END,
            CASE WHEN OLD.is_active != NEW.is_active THEN 'is_active' END,
            CASE WHEN OLD.email_verified != NEW.email_verified THEN 'email_verified' END
        ),
        'Database Server', 'Database Trigger',
        'DATABASE', '/database/users', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'users_update_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

CREATE TRIGGER users_delete_audit
AFTER DELETE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        OLD.id, OLD.email, CONCAT(COALESCE(OLD.first_name, ''), ' ', COALESCE(OLD.last_name, '')),
        'DELETE', 'users', OLD.id,
        JSON_OBJECT(
            'id', OLD.id,
            'username', OLD.username,
            'email', OLD.email,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'phone_number', OLD.phone_number,
            'role_id', OLD.role_id,
            'is_active', OLD.is_active,
            'email_verified', OLD.email_verified
        ), NULL, NULL, 'Database Server', 'Database Trigger',
        'DATABASE', '/database/users', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'users_delete_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

-- Contacts table triggers
CREATE TRIGGER contacts_insert_audit
AFTER INSERT ON contacts
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        NEW.user_id, 'System', 'Database Trigger',
        'CREATE', 'contacts', NEW.id,
        NULL, JSON_OBJECT(
            'id', NEW.id,
            'fullName', NEW.fullName,
            'email', NEW.email,
            'phoneNumber', NEW.phoneNumber,
            'list_name', NEW.list_name,
            'user_id', NEW.user_id
        ), NULL, 'Database Server', 'Database Trigger',
        'DATABASE', '/database/contacts', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'contacts_insert_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

CREATE TRIGGER contacts_update_audit
AFTER UPDATE ON contacts
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        NEW.user_id, 'System', 'Database Trigger',
        'UPDATE', 'contacts', NEW.id,
        JSON_OBJECT(
            'id', OLD.id,
            'fullName', OLD.fullName,
            'email', OLD.email,
            'phoneNumber', OLD.phoneNumber,
            'list_name', OLD.list_name,
            'user_id', OLD.user_id
        ),
        JSON_OBJECT(
            'id', NEW.id,
            'fullName', NEW.fullName,
            'email', NEW.email,
            'phoneNumber', NEW.phoneNumber,
            'list_name', NEW.list_name,
            'user_id', NEW.user_id
        ), 
        JSON_ARRAY(
            CASE WHEN OLD.fullName != NEW.fullName THEN 'fullName' END,
            CASE WHEN OLD.email != NEW.email THEN 'email' END,
            CASE WHEN OLD.phoneNumber != NEW.phoneNumber THEN 'phoneNumber' END,
            CASE WHEN OLD.list_name != NEW.list_name THEN 'list_name' END,
            CASE WHEN OLD.user_id != NEW.user_id THEN 'user_id' END
        ),
        'Database Server', 'Database Trigger',
        'DATABASE', '/database/contacts', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'contacts_update_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

CREATE TRIGGER contacts_delete_audit
AFTER DELETE ON contacts
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
    ) VALUES (
        OLD.user_id, 'System', 'Database Trigger',
        'DELETE', 'contacts', OLD.id,
        JSON_OBJECT(
            'id', OLD.id,
            'fullName', OLD.fullName,
            'email', OLD.email,
            'phoneNumber', OLD.phoneNumber,
            'list_name', OLD.list_name,
            'user_id', OLD.user_id
        ), NULL, NULL, 'Database Server', 'Database Trigger',
        'DATABASE', '/database/contacts', NULL, 200,
        0, NULL, JSON_OBJECT('trigger', 'contacts_delete_audit', 'direct_database', true),
        UUID(), UUID(), NOW()
    );
END$$

DELIMITER ;

-- Note: Additional triggers for other tables can be added following the same pattern
-- This includes: roles, assistants, phone_numbers, outbound_calls, lists, etc.
-- Each trigger should capture INSERT, UPDATE, and DELETE operations
-- and log them to the audit_logs table with comprehensive information
