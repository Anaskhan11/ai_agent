#!/bin/bash

# Setup Credit Expiration Cron Job
# This script sets up a daily cron job to expire credits

echo "🔧 Setting up credit expiration cron job..."

# Get the current directory (should be backend/scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"

echo "📁 Project directory: $PROJECT_DIR"
echo "📁 Backend directory: $BACKEND_DIR"
echo "📁 Script directory: $SCRIPT_DIR"

# Create log directory if it doesn't exist
LOG_DIR="$PROJECT_DIR/logs/credit_expiration"
mkdir -p "$LOG_DIR"
echo "📁 Log directory created: $LOG_DIR"

# Create the cron job script
CRON_SCRIPT="$SCRIPT_DIR/run_credit_expiration.sh"

cat > "$CRON_SCRIPT" << EOF
#!/bin/bash

# Credit Expiration Cron Job Runner
# This script is called by cron to run the daily credit expiration

# Set environment
export NODE_ENV=production
export PATH=/usr/local/bin:/usr/bin:/bin

# Change to backend directory
cd "$BACKEND_DIR"

# Log file with date
LOG_FILE="$LOG_DIR/expiration_\$(date +%Y%m%d).log"

# Run the expiration script
echo "\$(date): Starting credit expiration job" >> "\$LOG_FILE"
node scripts/expire_credits_daily.js >> "\$LOG_FILE" 2>&1
EXIT_CODE=\$?

if [ \$EXIT_CODE -eq 0 ]; then
    echo "\$(date): Credit expiration job completed successfully" >> "\$LOG_FILE"
else
    echo "\$(date): Credit expiration job failed with exit code \$EXIT_CODE" >> "\$LOG_FILE"
fi

# Keep only last 30 days of logs
find "$LOG_DIR" -name "expiration_*.log" -mtime +30 -delete

exit \$EXIT_CODE
EOF

# Make the cron script executable
chmod +x "$CRON_SCRIPT"
echo "✅ Cron script created: $CRON_SCRIPT"

# Create the cron job entry
CRON_ENTRY="0 2 * * * $CRON_SCRIPT"

echo ""
echo "📋 Cron job entry to add:"
echo "$CRON_ENTRY"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "run_credit_expiration.sh"; then
    echo "⚠️  Credit expiration cron job already exists"
    echo "Current cron jobs:"
    crontab -l | grep "run_credit_expiration.sh"
else
    echo "➕ Adding cron job..."
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    
    if [ $? -eq 0 ]; then
        echo "✅ Cron job added successfully!"
        echo "   The job will run daily at 2:00 AM"
    else
        echo "❌ Failed to add cron job"
        exit 1
    fi
fi

echo ""
echo "📊 Current cron jobs:"
crontab -l

echo ""
echo "🎉 Credit expiration cron job setup completed!"
echo ""
echo "📝 Manual commands:"
echo "   • Test the job: $CRON_SCRIPT"
echo "   • View logs: tail -f $LOG_DIR/expiration_\$(date +%Y%m%d).log"
echo "   • Remove cron job: crontab -e (then delete the line)"
echo ""
echo "⏰ The job will run daily at 2:00 AM server time"
echo "📁 Logs will be stored in: $LOG_DIR"
