# Credit System Architecture

## Overview
This document outlines the comprehensive credit-based billing system implementation, inspired by VAPI's approach. The system provides a flexible, scalable solution for managing user credits, tracking usage, and processing payments through Stripe.

## System Components

### 1. Credit Management Core
- **Credit Packages**: Predefined credit bundles users can purchase
- **User Credits**: Individual user credit balances and tracking
- **Credit Transactions**: Complete audit trail of all credit movements
- **Usage Tracking**: Detailed consumption tracking for all operations

### 2. Payment Integration
- **Stripe Integration**: Secure payment processing for credit purchases
- **Webhook Handling**: Real-time payment status updates
- **Automatic Credit Allocation**: Credits added upon successful payment

### 3. Usage Control System
- **Credit Middleware**: Pre-operation credit checks
- **Real-time Deduction**: Immediate credit consumption on usage
- **Role-based Exemptions**: Super admin unlimited access

### 4. Monitoring & Alerts
- **Low Credit Warnings**: Proactive user notifications
- **Usage Analytics**: Comprehensive consumption insights
- **Admin Dashboard**: System-wide credit management

## Credit Pricing Structure

### Operation Types and Costs
```
VAPI Calls:
- Per call initiation: 1.00 credit
- Per minute: 0.50 credits

Messaging:
- Per message: 0.10 credits

File Operations:
- Per MB upload: 0.25 credits

AI Operations:
- Workflow execution: 0.75 credits
- Assistant query: 0.05 credits
- Transcription per minute: 0.30 credits
- TTS per character: 0.001 credits
```

### Credit Packages
```
Starter Pack: 100 credits - $10.00
Professional Pack: 500 credits + 50 bonus - $45.00 (Popular)
Business Pack: 1000 credits + 150 bonus - $80.00
Enterprise Pack: 2500 credits + 500 bonus - $180.00
Premium Pack: 5000 credits + 1000 bonus - $320.00
```

## Database Schema

### Core Tables
1. **credit_packages** - Available credit packages for purchase
2. **user_credits** - Current credit balance per user
3. **credit_transactions** - Complete transaction history
4. **usage_tracking** - Detailed usage consumption records
5. **credit_pricing** - Operation cost definitions
6. **stripe_payments** - Payment processing records
7. **credit_alerts** - Notification management

### Key Relationships
- Users → User Credits (1:1)
- Users → Credit Transactions (1:N)
- Users → Usage Tracking (1:N)
- Credit Packages → Stripe Payments (1:N)

## Role-Based Access Control

### Super Admin
- Unlimited credits (bypass all checks)
- Full credit system management
- User credit adjustments
- System analytics access

### Regular Users
- Credit-based access to all features
- Purchase credits through Stripe
- View usage analytics
- Receive low credit alerts

## API Endpoints

### Credit Management
```
GET /api/credits/balance - Get user credit balance
GET /api/credits/transactions - Get transaction history
GET /api/credits/usage - Get usage analytics
POST /api/credits/purchase - Initiate credit purchase
GET /api/credits/packages - Get available packages
```

### Admin Endpoints
```
GET /api/admin/credits/users - Get all user credits
POST /api/admin/credits/adjust - Adjust user credits
GET /api/admin/credits/analytics - System credit analytics
POST /api/admin/credits/packages - Manage credit packages
```

### Stripe Integration
```
POST /api/stripe/create-payment-intent - Create payment
POST /api/stripe/webhook - Handle Stripe webhooks
GET /api/stripe/payment-status - Check payment status
```

## Credit Flow Process

### Purchase Flow
1. User selects credit package
2. Stripe Payment Intent created
3. User completes payment
4. Stripe webhook confirms payment
5. Credits automatically added to user account
6. Transaction recorded in system

### Usage Flow
1. User initiates operation (e.g., VAPI call)
2. Credit middleware checks available balance
3. If sufficient credits: operation proceeds
4. Credits deducted in real-time
5. Usage tracked with detailed metadata
6. Transaction recorded

### Alert Flow
1. System monitors credit levels
2. Triggers alerts at defined thresholds
3. Notifications sent via email/push
4. Admin alerts for system-wide issues

## Security Considerations

### Payment Security
- Stripe handles all sensitive payment data
- No credit card information stored locally
- Webhook signature verification
- Idempotent payment processing

### Credit Security
- Atomic credit transactions
- Balance validation on every operation
- Audit trail for all credit movements
- Rate limiting on credit operations

## Monitoring & Analytics

### User Analytics
- Credit usage patterns
- Operation cost breakdown
- Historical consumption trends
- Predictive usage alerts

### System Analytics
- Total credits in circulation
- Revenue tracking
- Popular package analysis
- System-wide usage metrics

## Implementation Phases

### Phase 1: Core Infrastructure
- Database schema implementation
- Basic credit models
- Stripe integration setup

### Phase 2: Usage Integration
- Credit middleware implementation
- VAPI call integration
- Basic frontend components

### Phase 3: Advanced Features
- Usage analytics
- Alert system
- Admin dashboard

### Phase 4: Optimization
- Performance tuning
- Advanced analytics
- Mobile app integration

## Error Handling

### Insufficient Credits
- Graceful operation blocking
- Clear user messaging
- Purchase flow suggestions

### Payment Failures
- Retry mechanisms
- User notifications
- Support ticket integration

### System Failures
- Transaction rollback
- Credit restoration
- Audit logging

## Performance Considerations

### Database Optimization
- Proper indexing strategy
- Partitioning for large tables
- Query optimization

### Caching Strategy
- Credit balance caching
- Package information caching
- Usage analytics caching

### Scalability
- Horizontal scaling support
- Microservice architecture ready
- Load balancing considerations
