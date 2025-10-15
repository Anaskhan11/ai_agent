# Credit Expiration System

## Overview

The Credit Expiration System implements automatic expiration of purchased credits after 30 days. This ensures that credits have a limited validity period, encouraging regular usage and preventing indefinite accumulation.

## Key Features

- **30-Day Expiration**: All purchased credits expire 30 days after purchase
- **FIFO Deduction**: Credits are used in First-In-First-Out order (oldest credits used first)
- **Batch Tracking**: Individual credit purchases are tracked as separate batches with their own expiration dates
- **Automatic Expiration**: Daily automated process expires credits that have passed their validity period
- **Notifications**: Users receive alerts 7 days before credits expire and when they expire
- **Comprehensive Tracking**: Full audit trail of credit purchases, usage, and expiration

## Database Schema Changes

### New Tables

#### `credit_batches`
Tracks individual credit purchases with expiration dates:
- `batch_id`: Unique identifier for each credit batch
- `user_id`: User who purchased the credits
- `credits_purchased`: Original number of credits in the batch
- `credits_remaining`: Credits still available in the batch
- `credits_used`: Credits consumed from this batch
- `purchase_date`: When the credits were purchased
- `expiry_date`: When the credits expire (30 days from purchase)
- `is_expired`: Whether the batch has expired
- `expired_at`: When the batch was marked as expired

### Modified Tables

#### `user_credits`
Added expiration tracking:
- `expired_credits`: Total credits that have expired
- `last_expiry_at`: Last time credits expired
- `available_credits`: Now calculated as `total_credits - used_credits - expired_credits`

#### `credit_alerts`
Added new alert types:
- `credits_expiring`: Warning 7 days before expiration
- `credits_expired`: Notification when credits expire

## System Components

### Models

#### `CreditExpirationModel.js`
- `createCreditBatch()`: Create new credit batch with expiration
- `getUserCreditBatches()`: Get user's credit batches (active/expired/expiring)
- `deductCreditsFromBatches()`: FIFO credit deduction
- `expireCredits()`: Find and expire credits past their expiry date
- `getUsersWithExpiringCredits()`: Get users with credits expiring soon

### Services

#### `CreditExpirationService.js`
- `processCreditPurchase()`: Handle credit purchase with expiration
- `deductCredits()`: FIFO credit deduction with fallback
- `runDailyExpiration()`: Daily expiration process
- `getUserExpirationSummary()`: User's expiration overview
- `sendExpirationNotifications()`: Send expiration alerts

#### `CreditNotificationService.js`
- `sendExpirationWarnings()`: 7-day expiration warnings
- `sendExpirationNotifications()`: Expiration notifications
- `createCreditAlert()`: Create alert records
- `getUserAlerts()`: Get user's credit alerts

### Controllers

#### Updated `CreditController.js`
- `getCreditExpirationDetails()`: Get user's expiration details
- `getExpirationStatistics()`: Admin expiration statistics
- `getCreditAlerts()`: Get user's credit alerts

## API Endpoints

### User Endpoints

```
GET /api/credits/balance
- Now includes expiration information

GET /api/credits/expiration
- Detailed expiration information for user's credits

GET /api/credits/alerts
- User's credit alerts and notifications
```

### Admin Endpoints

```
GET /api/credits/admin/expiration-stats
- System-wide expiration statistics
```

## Automated Processes

### Daily Expiration Job

**Script**: `backend/scripts/expire_credits_daily.js`

**Schedule**: Daily at 2:00 AM (configurable)

**Process**:
1. Find credit batches past their expiry date
2. Mark batches as expired
3. Update user's `expired_credits` total
4. Send expiration notifications
5. Create audit log entries

**Setup**:
```bash
cd backend/scripts
chmod +x setup_credit_expiration_cron.sh
./setup_credit_expiration_cron.sh
```

## Migration and Setup

### 1. Run Database Migration

```bash
cd backend/scripts
node execute_credit_expiration_migration.js
```

### 2. Test the System

```bash
cd backend/scripts
node test_credit_expiration.js
```

### 3. Setup Cron Job

```bash
cd backend/scripts
./setup_credit_expiration_cron.sh
```

## Credit Flow

### Purchase Flow
1. User purchases credits via Stripe
2. `CreditExpirationService.processCreditPurchase()` creates credit batch
3. Batch has 30-day expiry from purchase date
4. Credits added to user's total balance

### Usage Flow
1. User performs credit-consuming operation
2. `CreditExpirationService.deductCredits()` uses FIFO approach
3. Oldest credits (closest to expiry) are used first
4. Batch `credits_remaining` is updated
5. User's `used_credits` is updated

### Expiration Flow
1. Daily job runs at 2:00 AM
2. `CreditExpirationModel.expireCredits()` finds expired batches
3. Batches marked as expired
4. User's `expired_credits` updated
5. Expiration notifications sent
6. Audit trail created

## Notifications

### Expiration Warnings
- Sent 7 days before credits expire
- Only sent once per batch to avoid spam
- Stored in `credit_alerts` table

### Expiration Notifications
- Sent when credits actually expire
- Inform user of expired credit amount
- Encourage new credit purchases

## Monitoring and Analytics

### User Analytics
- Active credit batches
- Credits expiring soon
- Recently expired credits
- Expiration timeline

### System Analytics
- Total expired credits
- Expiration rate
- Users with expiring credits
- System-wide expiration trends

## Backward Compatibility

The system maintains backward compatibility with existing credit queries:
- `user_credits.available_credits` automatically excludes expired credits
- Legacy credit deduction falls back to old method if batch system fails
- Existing API endpoints continue to work with enhanced data

## Configuration

### Expiration Period
Default: 30 days (configurable in `CreditExpirationModel.createCreditBatch()`)

### Notification Timing
Default: 7 days before expiry (configurable in notification service)

### Cleanup Retention
- Credit alerts: 90 days
- Expired batches: Permanent (for audit trail)

## Testing

Run comprehensive tests:
```bash
cd backend/scripts
node test_credit_expiration.js
```

Tests cover:
- Database schema validation
- Credit batch creation
- FIFO deduction logic
- Expiration process
- Notification system
- Statistics generation

## Troubleshooting

### Common Issues

1. **Migration Fails**
   - Check database permissions
   - Verify existing schema compatibility
   - Run migration script with verbose logging

2. **Cron Job Not Running**
   - Verify cron service is active
   - Check script permissions
   - Review log files in `/logs/credit_expiration/`

3. **Credits Not Expiring**
   - Check if daily job is running
   - Verify batch expiry dates
   - Review system logs

### Log Files

- Daily job logs: `/logs/credit_expiration/expiration_YYYYMMDD.log`
- Application logs: Check main application log for credit-related errors

## Security Considerations

- Credit expiration cannot be reversed (by design)
- Only automated system can expire credits
- Full audit trail maintained
- Admin-only access to expiration statistics

## Future Enhancements

- Email notifications for expiration warnings
- Configurable expiration periods per package
- Credit extension functionality (admin)
- Advanced expiration analytics dashboard
