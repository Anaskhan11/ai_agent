const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

/**
 * Audit Log Service
 * Handles Excel export, text file writing, and daily folder management
 */

class AuditLogService {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'Logs');
    this.combinedFilePath = path.join(this.logsDir, 'combined.txt');
  }

  /**
   * Ensure logs directory structure exists
   */
  async ensureLogsDirectory() {
    try {
      await fs.ensureDir(this.logsDir);
      
      // Ensure combined.txt exists
      if (!await fs.pathExists(this.combinedFilePath)) {
        const initialContent = `# Audit Logs Combined File
# This file contains a summary of all audit log activities
# Generated on: ${new Date().toISOString()}
# Format: [Timestamp] Operation on Table by User (Record ID) - Status: Response Status

`;
        await fs.writeFile(this.combinedFilePath, initialContent);
      }
      
      return this.logsDir;
    } catch (error) {
      console.error('Error ensuring logs directory:', error);
      throw error;
    }
  }

  /**
   * Create or ensure date-based directory exists
   */
  async createDateDirectory(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dateDir = path.join(this.logsDir, targetDate);
      
      await fs.ensureDir(dateDir);
      return dateDir;
    } catch (error) {
      console.error('Error creating date directory:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to Excel file
   */
  async exportToExcel(auditLogs, filters = {}) {
    try {
      await this.ensureLogsDirectory();
      
      if (!auditLogs || auditLogs.length === 0) {
        throw new Error('No audit logs provided for export');
      }

      // Prepare data for Excel
      const excelData = auditLogs.map(log => ({
        'ID': log.id,
        'User ID': log.user_id || 'N/A',
        'User Email': log.user_email || 'N/A',
        'User Name': log.user_name || 'N/A',
        'Operation': log.operation_type,
        'Table': log.table_name,
        'Record ID': log.record_id || 'N/A',
        'Old Values': log.old_values ? this.formatJsonForExcel(log.old_values) : 'N/A',
        'New Values': log.new_values ? this.formatJsonForExcel(log.new_values) : 'N/A',
        'Changed Fields': log.changed_fields ? this.formatJsonForExcel(log.changed_fields) : 'N/A',
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
      const colWidths = this.calculateColumnWidths(excelData);
      worksheet['!cols'] = colWidths;

      // Add filters to the worksheet
      if (excelData.length > 0) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        worksheet['!autofilter'] = { ref: worksheet['!ref'] };
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

      // Add summary sheet
      const summaryData = this.createSummaryData(auditLogs, filters);
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Create date directory and generate filename
      const currentDate = new Date().toISOString().split('T')[0];
      const dateDir = await this.createDateDirectory(currentDate);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audit_logs_${timestamp}.xlsx`;
      const filepath = path.join(dateDir, filename);

      // Write Excel file
      XLSX.writeFile(workbook, filepath);

      // Update combined.txt
      await this.updateCombinedTextFile(auditLogs);

      return {
        filename,
        filepath,
        dateDir,
        recordCount: auditLogs.length,
        exportDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  /**
   * Format JSON data for Excel display
   */
  formatJsonForExcel(jsonData) {
    if (!jsonData) return 'N/A';
    
    try {
      if (typeof jsonData === 'string') {
        return jsonData;
      }
      return JSON.stringify(jsonData, null, 2);
    } catch (error) {
      return String(jsonData);
    }
  }

  /**
   * Calculate optimal column widths for Excel
   */
  calculateColumnWidths(data) {
    if (!data || data.length === 0) return [];

    const headers = Object.keys(data[0]);
    const colWidths = [];

    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String(row[header] || '').length)
      );
      colWidths[index] = { width: Math.min(maxLength + 2, 50) };
    });

    return colWidths;
  }

  /**
   * Create summary data for Excel export
   */
  createSummaryData(auditLogs, filters) {
    const summary = [];
    
    // Export information
    summary.push({
      'Metric': 'Export Date',
      'Value': new Date().toISOString()
    });
    
    summary.push({
      'Metric': 'Total Records',
      'Value': auditLogs.length
    });

    // Operation type breakdown
    const operationCounts = {};
    auditLogs.forEach(log => {
      operationCounts[log.operation_type] = (operationCounts[log.operation_type] || 0) + 1;
    });

    Object.entries(operationCounts).forEach(([operation, count]) => {
      summary.push({
        'Metric': `${operation} Operations`,
        'Value': count
      });
    });

    // Table breakdown
    const tableCounts = {};
    auditLogs.forEach(log => {
      tableCounts[log.table_name] = (tableCounts[log.table_name] || 0) + 1;
    });

    const topTables = Object.entries(tableCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    topTables.forEach(([table, count]) => {
      summary.push({
        'Metric': `Table: ${table}`,
        'Value': count
      });
    });

    // Filters applied
    if (filters && Object.keys(filters).length > 0) {
      summary.push({
        'Metric': 'Filters Applied',
        'Value': JSON.stringify(filters, null, 2)
      });
    }

    return summary;
  }

  /**
   * Update combined.txt file with new audit logs
   */
  async updateCombinedTextFile(auditLogs) {
    try {
      await this.ensureLogsDirectory();

      // Prepare text content
      const textContent = auditLogs.map(log => {
        const timestamp = log.created_at;
        const operation = log.operation_type;
        const table = log.table_name;
        const user = log.user_email || 'Unknown';
        const recordId = log.record_id || 'N/A';
        const status = log.response_status || 'N/A';

        return `[${timestamp}] ${operation} on ${table} by ${user} (ID: ${recordId}) - Status: ${status}`;
      }).join('\n') + '\n';

      // Append to global combined.txt (single file for all days)
      await fs.appendFile(this.combinedFilePath, textContent);

      console.log(`✅ Updated global combined.txt with ${auditLogs.length} audit log(s)`);

      return this.combinedFilePath;
    } catch (error) {
      console.error('Error updating combined.txt:', error);
      throw error;
    }
  }

  /**
   * Get list of exported files for a specific date
   */
  async getExportedFiles(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dateDir = path.join(this.logsDir, targetDate);
      
      if (!await fs.pathExists(dateDir)) {
        return [];
      }

      const files = await fs.readdir(dateDir);
      const excelFiles = files.filter(file => 
        file.endsWith('.xlsx') && file.startsWith('audit_logs_')
      );

      const fileDetails = await Promise.all(
        excelFiles.map(async (filename) => {
          const filepath = path.join(dateDir, filename);
          const stats = await fs.stat(filepath);
          
          return {
            filename,
            filepath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      );

      return fileDetails.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error getting exported files:', error);
      throw error;
    }
  }

  /**
   * Clean up old export files
   */
  async cleanupOldFiles(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const directories = await fs.readdir(this.logsDir);
      let deletedCount = 0;

      for (const dir of directories) {
        // Skip non-date directories
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) {
          continue;
        }

        const dirDate = new Date(dir);
        if (dirDate < cutoffDate) {
          const dirPath = path.join(this.logsDir, dir);
          await fs.remove(dirPath);
          deletedCount++;
          console.log(`Deleted old export directory: ${dir}`);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old files:', error);
      throw error;
    }
  }

  /**
   * Get combined.txt file content
   */
  async getCombinedFileContent(lines = null) {
    try {
      await this.ensureLogsDirectory();

      if (!await fs.pathExists(this.combinedFilePath)) {
        return '';
      }

      const content = await fs.readFile(this.combinedFilePath, 'utf8');

      if (lines) {
        const allLines = content.split('\n');
        return allLines.slice(-lines).join('\n');
      }

      return content;
    } catch (error) {
      console.error('Error reading combined file:', error);
      throw error;
    }
  }

  /**
   * Create daily Excel export automatically
   */
  async createDailyExcelExport() {
    try {
      const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

      // Get today's audit logs
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today} 00:00:00`;
      const endOfDay = `${today} 23:59:59`;

      const filters = {
        start_date: startOfDay,
        end_date: endOfDay,
        limit: 10000,
        offset: 0
      };

      const result = await AuditLogModel.getAuditLogs(filters);

      if (result.data.length === 0) {
        console.log(`📊 No audit logs found for ${today} - skipping Excel export`);
        return null;
      }

      // Create Excel export with current date name
      const exportResult = await this.exportToExcel(result.data, filters);

      console.log(`📊 Daily Excel export created: ${exportResult.filename} (${result.data.length} logs)`);

      return exportResult;
    } catch (error) {
      console.error('Error creating daily Excel export:', error);
      throw error;
    }
  }

  /**
   * Enhanced export to Excel with better filename format
   */
  async exportToExcelWithDateName(auditLogs, filters = {}) {
    try {
      await this.ensureLogsDirectory();

      if (!auditLogs || auditLogs.length === 0) {
        throw new Error('No audit logs provided for export');
      }

      // Prepare data for Excel
      const excelData = auditLogs.map(log => ({
        'ID': log.id,
        'User ID': log.user_id || 'N/A',
        'User Email': log.user_email || 'N/A',
        'User Name': log.user_name || 'N/A',
        'Operation': log.operation_type,
        'Table': log.table_name,
        'Record ID': log.record_id || 'N/A',
        'Old Values': log.old_values ? this.formatJsonForExcel(log.old_values) : 'N/A',
        'New Values': log.new_values ? this.formatJsonForExcel(log.new_values) : 'N/A',
        'Changed Fields': log.changed_fields ? this.formatJsonForExcel(log.changed_fields) : 'N/A',
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
      const colWidths = this.calculateColumnWidths(excelData);
      worksheet['!cols'] = colWidths;

      // Add filters to the worksheet
      if (excelData.length > 0) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        worksheet['!autofilter'] = { ref: worksheet['!ref'] };
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');

      // Add summary sheet
      const summaryData = this.createSummaryData(auditLogs, filters);
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Create date directory and generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const dateDir = await this.createDateDirectory(currentDate);

      // Use current date in filename format: audit_logs_2025-08-07.xlsx
      const filename = `audit_logs_${currentDate}.xlsx`;
      const filepath = path.join(dateDir, filename);

      // Write Excel file
      XLSX.writeFile(workbook, filepath);

      // Update combined.txt
      await this.updateCombinedTextFile(auditLogs);

      console.log(`📊 Excel export created: ${filename} with ${auditLogs.length} audit logs`);

      return {
        filename,
        filepath,
        dateDir,
        combinedFilePath: this.combinedFilePath,
        recordCount: auditLogs.length,
        exportDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting to Excel with date name:', error);
      throw error;
    }
  }


}

module.exports = new AuditLogService();
