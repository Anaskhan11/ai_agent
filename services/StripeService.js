const { v4: uuidv4 } = require('uuid');
const CreditModel = require('../model/CreditModel/CreditModel');
const CreditPackageModel = require('../model/CreditModel/CreditPackageModel');
const StripePaymentModel = require('../model/CreditModel/StripePaymentModel');
const CreditExpirationService = require('./CreditExpirationService');
const AutoSubscriptionModel = require('../model/AutoSubscriptionModel/AutoSubscriptionModel');

// Initialize Stripe with proper error handling
let stripe = null;
try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey && stripeSecretKey !== 'sk_test_your_stripe_secret_key_here') {
    stripe = require('stripe')(stripeSecretKey);
    console.log('✅ Stripe initialized successfully');
  } else {
    console.warn('⚠️ Stripe not initialized - STRIPE_SECRET_KEY not configured or using placeholder');
  }
} catch (error) {
  console.error('❌ Error initializing Stripe:', error.message);
}

class StripeService {
  constructor() {
    // Stripe initialization is handled globally above
    console.log('StripeService initialized');
  }

  // Check if Stripe is available
  static isStripeAvailable() {
    return stripe !== null;
  }

  // Throw error if Stripe is not available
  static requireStripe() {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
    return stripe;
  }

  // Create or get Stripe customer
  async createOrGetCustomer(user) {
    try {
      const stripeInstance = StripeService.requireStripe();

      // Check if user already has a Stripe customer ID
      if (user.stripe_customer_id) {
        try {
          const customer = await stripeInstance.customers.retrieve(user.stripe_customer_id);
          return customer;
        } catch (error) {
          console.log('Existing Stripe customer not found, creating new one');
        }
      }

      // Create new Stripe customer
      const customer = await stripeInstance.customers.create({
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        metadata: {
          user_id: user.id.toString(),
          username: user.username || ''
        }
      });

      // Update user with Stripe customer ID
      const pool = require('../config/DBConnection');
      await pool.execute(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        [customer.id, user.id]
      );

      return customer;
    } catch (error) {
      console.error('Error creating/getting Stripe customer:', error);
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  }

  // Create payment intent for credit purchase
  static async createPaymentIntent(userId, packageId, user, options = {}) {
    try {
      // Get credit package details
      const creditPackage = await CreditPackageModel.getCreditPackageById(packageId);
      if (!creditPackage) {
        throw new Error('Credit package not found');
      }

      if (!creditPackage.is_active) {
        throw new Error('Credit package is not available');
      }

      // Check if this is a free trial request for Starter Pack
      const isFreeTrial = packageId === 'starter' && options.isFreeTrial;
      if (isFreeTrial) {
        return await StripeService.handleFreeTrialPackage(userId, user, creditPackage, options);
      }

      // Create or get Stripe customer
      const stripeService = new StripeService();
      const customer = await stripeService.createOrGetCustomer(user);

      // Create payment intent
      const stripeInstance = StripeService.requireStripe();
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: creditPackage.price_cents,
        currency: creditPackage.currency.toLowerCase(),
        customer: customer.id,
        metadata: {
          user_id: userId.toString(),
          package_id: packageId,
          credits_amount: creditPackage.credits_amount.toString(),
          bonus_credits: (creditPackage.bonus_credits || 0).toString(),
          total_credits: (creditPackage.credits_amount + (creditPackage.bonus_credits || 0)).toString()
        },
        description: `Credit purchase: ${creditPackage.name}`,
        receipt_email: user.email
      });

      // Store payment record in database
      await StripePaymentModel.createStripePayment({
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customer.id,
        package_id: packageId,
        amount_cents: creditPackage.price_cents,
        currency: creditPackage.currency,
        status: 'pending',
        credits_purchased: creditPackage.credits_amount + (creditPackage.bonus_credits || 0),
        metadata: {
          package_name: creditPackage.name,
          package_description: creditPackage.description
        }
      });

      return {
        paymentIntent,
        creditPackage,
        customer
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  // Handle free trial package (Starter Pack as free trial)
  static async handleFreeTrialPackage(userId, user, creditPackage, options = {}) {
    try {
      // Check if user has already claimed free trial
      const pool = require('../config/DBConnection');
      const [userCheck] = await pool.execute(
        `SELECT free_trial_claimed FROM users WHERE id = ?`,
        [userId]
      );

      if (userCheck.length === 0 || userCheck[0].free_trial_claimed) {
        throw new Error('Free trial already claimed. Each user can only claim the free trial once.');
      }

      // Create or get Stripe customer
      const stripeService = new StripeService();
      const customer = await stripeService.createOrGetCustomer(user);

      // Create setup intent for card verification (instead of payment intent)
      const stripeInstance = StripeService.requireStripe();
      const setupIntent = await stripeInstance.setupIntents.create({
        customer: customer.id,
        usage: 'off_session',
        metadata: {
          user_id: userId.toString(),
          package_id: creditPackage.package_id,
          credits_amount: creditPackage.credits_amount.toString(),
          bonus_credits: (creditPackage.bonus_credits || 0).toString(),
          total_credits: (creditPackage.credits_amount + (creditPackage.bonus_credits || 0)).toString(),
          is_free_trial: 'true',
          auto_subscription_enabled: options.autoSubscriptionEnabled ? 'true' : 'false',
          auto_subscription_package: options.autoSubscriptionPackage || 'professional'
        },
        description: `Free trial: ${creditPackage.name}`
      });

      // Create a special payment record for free trial
      await StripePaymentModel.createStripePayment({
        user_id: userId,
        stripe_payment_intent_id: setupIntent.id, // Using setup intent ID
        stripe_customer_id: customer.id,
        package_id: creditPackage.package_id,
        amount_cents: 0, // $0 for free trial
        currency: creditPackage.currency,
        status: 'pending',
        credits_purchased: creditPackage.credits_amount + (creditPackage.bonus_credits || 0),
        metadata: {
          package_name: `${creditPackage.name} - FREE Trial`,
          package_description: creditPackage.description,
          is_free_trial: true,
          setup_intent_id: setupIntent.id,
          auto_subscription_enabled: options.autoSubscriptionEnabled || false,
          auto_subscription_package: options.autoSubscriptionPackage || null
        }
      });



      return {
        setupIntent: {
          id: setupIntent.id,
          client_secret: setupIntent.client_secret,
          amount: 0,
          currency: 'usd',
          status: 'requires_payment_method'
        },
        creditPackage: {
          ...creditPackage,
          name: `${creditPackage.name} - FREE Trial`,
          description: creditPackage.description + ' Card required for verification.',
          price_cents: 0,
          price_dollars: 0,
          is_free_trial: true,
          original_price_dollars: creditPackage.price_cents / 100
        },
        customer,
        isFreeTrial: true
      };
    } catch (error) {
      console.error('Error handling free trial package:', error);
      throw new Error(`Failed to process free trial: ${error.message}`);
    }
  }

  // Handle successful payment
  static async handleSuccessfulPayment(paymentIntentId) {
    try {
      // Get payment record from database
      const payment = await StripePaymentModel.getStripePaymentByIntentId(paymentIntentId);
      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Check if credits already allocated
      if (payment.credits_allocated) {
        console.log('Credits already allocated for payment:', paymentIntentId);
        return { success: true, message: 'Credits already allocated' };
      }

      // Handle free trial setup intent success (check metadata for is_free_trial flag)
      let isFreeTrial = false;
      try {
        const metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
        isFreeTrial = metadata?.is_free_trial === true || metadata?.is_free_trial === 'true';
      } catch (e) {
        console.warn('Failed to parse payment metadata for free trial check:', e);
      }

      if (isFreeTrial && payment.amount_cents === 0) {
        return await StripeService.handleFreeTrialSuccess(paymentIntentId, payment);
      }

      // Parse metadata to get package name
      let packageName = 'Credit Package';
      try {
        const metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
        packageName = metadata?.package_name || packageName;
      } catch (e) {
        console.warn('Failed to parse payment metadata:', e);
      }

      // Get package details for bonus credits
      const creditPackage = await CreditPackageModel.getCreditPackageById(payment.package_id);
      const bonusCredits = creditPackage?.bonus_credits || 0;

      // Create credit batches with expiration (30 days)
      const batchResult = await CreditExpirationService.processCreditPurchase({
        user_id: payment.user_id,
        credits_amount: payment.credits_purchased - bonusCredits, // Main credits
        bonus_credits: bonusCredits,
        package_id: payment.package_id,
        payment_reference: paymentIntentId,
        expiry_days: 30
      });

      // Add credits to user account (for backward compatibility with existing queries)
      const creditResult = await CreditModel.addCreditsToUser(
        payment.user_id,
        payment.credits_purchased,
        'purchase',
        `Credit purchase: ${packageName}`,
        paymentIntentId,
        payment.package_id
      );

      // Mark credits as allocated
      await StripePaymentModel.markCreditsAllocated(paymentIntentId);

      // Update payment status
      await StripePaymentModel.updateStripePayment(paymentIntentId, {
        status: 'succeeded',
        processed_at: new Date()
      });

      console.log(`✅ Credits allocated successfully: ${payment.credits_purchased} credits to user ${payment.user_id} for package: ${packageName}`);

      return {
        success: true,
        creditsAdded: payment.credits_purchased,
        transactionId: creditResult.transactionId,
        newBalance: creditResult.balanceAfter,
        packageName: packageName
      };
    } catch (error) {
      console.error('❌ Error handling successful payment:', error);
      throw new Error(`Failed to process successful payment: ${error.message}`);
    }
  }

  // Handle free trial success
  static async handleFreeTrialSuccess(setupIntentId, payment) {
    try {
      console.log(`🎉 Processing free trial success for user ${payment.user_id}`);

      // Parse metadata to get auto-subscription settings
      let metadata = {};
      try {
        metadata = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
      } catch (e) {
        console.warn('Failed to parse payment metadata:', e);
      }

      // Add credits to user account
      const creditResult = await CreditModel.addCreditsToUser(
        payment.user_id,
        payment.credits_purchased,
        'bonus',
        `Free trial credits - ${metadata.package_name || 'Starter Pack'}`,
        setupIntentId,
        payment.package_id
      );

      // Mark free trial as claimed
      await AutoSubscriptionModel.markFreeTrialClaimed(payment.user_id);

      // Store payment method for future auto-subscriptions if enabled
      if (metadata.auto_subscription_enabled === 'true' || metadata.auto_subscription_enabled === true) {
        try {
          // Get the setup intent to retrieve payment method
          const stripeInstance = StripeService.requireStripe();
          const setupIntent = await stripeInstance.setupIntents.retrieve(setupIntentId);

          if (setupIntent.payment_method) {
            // Store customer and payment method info
            await AutoSubscriptionModel.storeUserPaymentInfo(payment.user_id, {
              stripe_customer_id: payment.stripe_customer_id,
              default_payment_method_id: setupIntent.payment_method
            });

            // Set up auto-subscription settings
            await AutoSubscriptionModel.setUserAutoSubscriptionSettings(payment.user_id, {
              enabled: true,
              target_package_id: metadata.auto_subscription_package || 'professional',
              trigger_threshold: 0,
              max_monthly_purchases: 1
            });

            console.log(`✅ Auto-subscription enabled for user ${payment.user_id} with package ${metadata.auto_subscription_package || 'professional'}`);
          }
        } catch (autoSubError) {
          console.error('⚠️ Failed to set up auto-subscription:', autoSubError.message);
          // Don't fail the whole process if auto-subscription setup fails
        }
      }

      // Mark credits as allocated
      await StripePaymentModel.markCreditsAllocated(setupIntentId);

      // Update payment status
      await StripePaymentModel.updateStripePayment(setupIntentId, {
        status: 'succeeded',
        processed_at: new Date()
      });

      console.log(`✅ Free trial credits allocated successfully: ${payment.credits_purchased} credits to user ${payment.user_id}`);

      return {
        success: true,
        creditsAdded: payment.credits_purchased,
        transactionId: creditResult.transactionId,
        newBalance: creditResult.balanceAfter,
        packageName: metadata.package_name || 'Free Trial - Starter Pack',
        isFreeTrial: true
      };
    } catch (error) {
      console.error('❌ Error handling free trial success:', error);
      throw new Error(`Failed to process free trial success: ${error.message}`);
    }
  }

  // Handle failed payment
  static async handleFailedPayment(paymentIntentId, failureReason = '') {
    try {
      await StripePaymentModel.updateStripePayment(paymentIntentId, {
        status: 'failed',
        failure_reason: failureReason,
        processed_at: new Date()
      });

      console.log(`Payment failed: ${paymentIntentId}, Reason: ${failureReason}`);
      return { success: true, message: 'Payment failure recorded' };
    } catch (error) {
      console.error('Error handling failed payment:', error);
      throw new Error(`Failed to process payment failure: ${error.message}`);
    }
  }

  // Process webhook event
  async processWebhookEvent(event) {
    try {
      console.log(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          return await StripeService.handleSuccessfulPayment(event.data.object.id);

        case 'setup_intent.succeeded':
          // Handle free trial setup intent success
          return await StripeService.handleSuccessfulPayment(event.data.object.id);

        case 'payment_intent.payment_failed':
          const failureReason = event.data.object.last_payment_error?.message || 'Payment failed';
          return await StripeService.handleFailedPayment(event.data.object.id, failureReason);

        case 'setup_intent.setup_failed':
          const setupFailureReason = event.data.object.last_setup_error?.message || 'Setup failed';
          return await StripeService.handleFailedPayment(event.data.object.id, setupFailureReason);

        case 'payment_intent.canceled':
          await StripePaymentModel.updateStripePayment(event.data.object.id, {
            status: 'canceled',
            processed_at: new Date()
          });
          return { success: true, message: 'Payment cancellation recorded' };

        case 'setup_intent.canceled':
          await StripePaymentModel.updateStripePayment(event.data.object.id, {
            status: 'canceled',
            processed_at: new Date()
          });
          return { success: true, message: 'Setup cancellation recorded' };

        case 'customer.created':
          console.log('New Stripe customer created:', event.data.object.id);
          return { success: true, message: 'Customer creation noted' };

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          return { success: true, message: 'Event noted but not processed' };
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
      }

      const stripeInstance = StripeService.requireStripe();
      return stripeInstance.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Invalid webhook signature: ${error.message}`);
    }
  }

  // Get payment status
  async getPaymentStatus(paymentIntentId) {
    try {
      const stripeInstance = StripeService.requireStripe();
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
      const dbPayment = await StripePaymentModel.getStripePaymentByIntentId(paymentIntentId);

      return {
        stripe_status: paymentIntent.status,
        db_status: dbPayment?.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        credits_purchased: dbPayment?.credits_purchased,
        credits_allocated: dbPayment?.credits_allocated,
        created: paymentIntent.created,
        receipt_url: paymentIntent.charges?.data[0]?.receipt_url
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  // Create refund
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const stripeInstance = StripeService.requireStripe();
      const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Cannot refund unsuccessful payment');
      }

      const refund = await stripeInstance.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount, // null for full refund
        reason: reason,
        metadata: {
          refund_requested_at: new Date().toISOString()
        }
      });

      // Update payment record
      await StripePaymentModel.updateStripePayment(paymentIntentId, {
        status: 'refunded',
        refund_amount_cents: refund.amount,
        processed_at: new Date(),
        metadata: { refund_id: refund.id, refund_reason: reason }
      });

      // TODO: Deduct refunded credits from user account
      // This should be implemented based on business logic

      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  // Get customer payment methods
  async getCustomerPaymentMethods(customerId) {
    try {
      const stripeInstance = StripeService.requireStripe();
      const paymentMethods = await stripeInstance.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }
}

module.exports = StripeService;
