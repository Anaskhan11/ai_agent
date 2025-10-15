const AuditLogModel = require('../../model/AuditLogModel/AuditLogModel');
const AuditLogService = require('../../services/AuditLogService');
const systemAuditLogger = require('../../utils/systemAuditLogger');
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

/**
 * Audit Log Controller
 * Handles all audit log related operations
 */

// Get audit logs with filtering and pagination
const getAuditLogs = async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      operation_type,
      table_name,
      record_id,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const filters = {
      user_id,
      user_email,
      operation_type,
      table_name,
      record_id,
      start_date,
      end_date,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort_by,
      sort_order
    };

    const result = await AuditLogModel.getAuditLogs(filters);

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result.data,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
        currentPage: Math.floor(result.offset / result.limit) + 1,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: error.message
    });
  }
};

// Get audit log by ID
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const auditLog = await AuditLogModel.getAuditLogById(id);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Audit log retrieved successfully',
      data: auditLog
    });
  } catch (error) {
    console.error('Error getting audit log by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log',
      error: error.message
    });
  }
};

// Get audit log statistics
const getAuditLogStats = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      user_id,
      table_name
    } = req.query;

    const filters = {
      start_date,
      end_date,
      user_id,
      table_name
    };

    const stats = await AuditLogModel.getAuditLogStats(filters);

    res.status(200).json({
      success: true,
      message: 'Audit log statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log statistics',
      error: error.message
    });
  }
};

// Export audit logs to Excel
const exportAuditLogsToExcel = async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      operation_type,
      table_name,
      record_id,
      start_date,
      end_date,
      format = 'xlsx'
    } = req.query;

    const filters = {
      user_id,
      user_email,
      operation_type,
      table_name,
      record_id,
      start_date,
      end_date,
      limit: 10000, // Large limit for export
      offset: 0
    };

    const result = await AuditLogModel.getAuditLogs(filters);
    
    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No audit logs found for the specified criteria'
      });
    }

    // Prepare data for Excel
    const excelData = result.data.map(log => ({
      'ID': log.id,
      'User ID': log.user_id || 'N/A',
      'User Email': log.user_email || 'N/A',
      'User Name': log.user_name || 'N/A',
      'Operation': log.operation_type,
      'Table': log.table_name,
      'Record ID': log.record_id || 'N/A',
      'Old Values': log.old_values ? JSON.stringify(log.old_values) : 'N/A',
      'New Values': log.new_values ? JSON.stringify(log.new_values) : 'N/A',
      'Changed Fields': log.changed_fields ? JSON.stringify(log.changed_fields) : 'N/A',
      'IP Address': log.ip_address || 'N/A',
      'User Agent': log.user_agent || 'N/A',
      'Request Method': log.request_method || 'N/A',
      'Request URL': log.request_url || 'N/A',
      'Response Status': log.response_status || 'N/A',
      'Execution Time (ms)': log.execution_time_ms || 'N/A',
      'Error Message': log.error_message || 'N/A',
      'Session ID': log.session_id || 'N/A',
      'Transaction ID': log.transaction_id || 'N/A',
      'Created At': log.created_at
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const colWidths = [];
    const headers = Object.keys(excelData[0] || {});
    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...excelData.map(row => String(row[header] || '').length)
      );
      colWidths[index] = { width: Math.min(maxLength + 2, 50) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

    // Create logs directory structure
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logsDir = path.join(process.cwd(), 'Logs');
    const dateDir = path.join(logsDir, currentDate);

    await fs.ensureDir(dateDir);

    // Generate filename with current date
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audit_logs_${currentDate}_${timestamp.split('T')[1]}.xlsx`;
    const filepath = path.join(dateDir, filename);

    // Write Excel file
    XLSX.writeFile(workbook, filepath);

    // Also update combined.txt
    await updateCombinedTextFile(result.data);

    // Log successful export
    await systemAuditLogger.logExportOperation(req, 'AUDIT_LOGS_EXCEL', filename, result.data.length, true);

    res.status(200).json({
      success: true,
      message: 'Audit logs exported successfully',
      data: {
        filename,
        filepath: filepath,
        recordCount: result.data.length,
        exportDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error exporting audit logs to Excel:', error);

    // Log failed export
    await systemAuditLogger.logExportOperation(req, 'AUDIT_LOGS_EXCEL', 'failed_export', 0, false, error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
      error: error.message
    });
  }
};

// Download exported Excel file
const downloadExportedFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { date } = req.query;
    
    const currentDate = date || new Date().toISOString().split('T')[0];
    const filepath = path.join(process.cwd(), 'Logs', currentDate, filename);

    // Check if file exists
    if (!await fs.pathExists(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

// Helper function to update combined.txt file
const updateCombinedTextFile = async (auditLogs) => {
  try {
    const logsDir = path.join(process.cwd(), 'Logs');
    const combinedFilePath = path.join(logsDir, 'combined.txt');
    
    await fs.ensureDir(logsDir);

    // Prepare text content
    const textContent = auditLogs.map(log => {
      return `[${log.created_at}] ${log.operation_type} on ${log.table_name} by ${log.user_email || 'Unknown'} (ID: ${log.record_id || 'N/A'}) - Status: ${log.response_status || 'N/A'}`;
    }).join('\n') + '\n';

    // Append to combined.txt
    await fs.appendFile(combinedFilePath, textContent);
  } catch (error) {
    console.error('Error updating combined.txt:', error);
  }
};

// Helper function to get real client IP address
const getRealClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const clientIP = req.headers['x-client-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];

  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    const firstIP = ips[0];
    if (firstIP && firstIP !== '127.0.0.1' && firstIP !== '::1' && firstIP !== 'localhost') {
      return firstIP;
    }
  }

  if (cfConnectingIP && cfConnectingIP !== '127.0.0.1' && cfConnectingIP !== '::1') return cfConnectingIP;
  if (realIP && realIP !== '127.0.0.1' && realIP !== '::1') return realIP;
  if (clientIP && clientIP !== '127.0.0.1' && clientIP !== '::1') return clientIP;

  const connectionIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

  if (connectionIP === '::1' || connectionIP === '127.0.0.1' || connectionIP === 'localhost') {
    return '127.0.0.1 (localhost)';
  }

  return connectionIP || '127.0.0.1 (unknown)';
};

// Create audit log entry (for frontend-initiated logs like auth events)
const createAuditLog = async (req, res) => {
  try {
    const auditData = {
      ...req.body,
      user_id: req.user?.id || null,
      user_email: req.user?.email || req.body.user_email || null,
      user_name: req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : req.body.user_name || null,
      ip_address: getRealClientIP(req),
      user_agent: req.headers['user-agent'],
      request_method: req.method,
      request_url: req.url,
      response_status: 201,
      execution_time_ms: 0,
      session_id: req.sessionID || req.body.session_id,
      transaction_id: req.body.transaction_id || `frontend-${Date.now()}`
    };

    const auditLogId = await AuditLogModel.createAuditLog(auditData);

    res.status(201).json({
      success: true,
      message: 'Audit log created successfully',
      data: {
        id: auditLogId
      }
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: error.message
    });
  }
};

// Clean up old audit logs
const cleanupOldAuditLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const deletedCount = await AuditLogModel.deleteOldAuditLogs(parseInt(days));

    res.status(200).json({
      success: true,
      message: `Cleaned up audit logs older than ${days} days`,
      data: {
        deletedCount,
        daysKept: parseInt(days)
      }
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup audit logs',
      error: error.message
    });
  }
};

// Get combined.txt file content
const getCombinedFileContent = async (req, res) => {
  try {
    const { lines } = req.query;
    const content = await AuditLogService.getCombinedFileContent(lines ? parseInt(lines) : null);

    res.status(200).json({
      success: true,
      message: 'Combined file content retrieved successfully',
      data: {
        content,
        lines: lines ? parseInt(lines) : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting combined file content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve combined file content',
      error: error.message
    });
  }
};

// Create daily Excel export
const createDailyExcelExport = async (req, res) => {
  try {
    const exportResult = await AuditLogService.createDailyExcelExport();

    if (!exportResult) {
      return res.status(404).json({
        success: false,
        message: 'No audit logs found for today to export'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Daily Excel export created successfully',
      data: {
        filename: exportResult.filename,
        filepath: exportResult.filepath,
        recordCount: exportResult.recordCount,
        exportDate: exportResult.exportDate,
        combinedFileUpdated: true
      }
    });
  } catch (error) {
    console.error('Error creating daily Excel export:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create daily Excel export',
      error: error.message
    });
  }
};



module.exports = {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  exportAuditLogsToExcel,
  downloadExportedFile,
  createAuditLog,
  cleanupOldAuditLogs,
  getCombinedFileContent,
  createDailyExcelExport
};
