# SpotBookie Subscription System Setup

This guide walks you through setting up the subscription tier system for SpotBookie.

## Overview

SpotBookie has three subscription tiers:
- **Free** ($0/mo): 1 staff, basic booking, 5% platform fee on deposits
- **Pro** ($29/mo): 5 staff, AI assistant, recurring, waitlist, CRM, analytics, SMS, no platform fee
- **Unlimited** ($79/mo): Unlimited staff, walk-ins, multi-location, no branding, API access

## Setup Steps

### 1. Create Stripe Products

Run the setup script to create products in Stripe:

```bash
cd stylist-scheduler
STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.js
```

This will output two price IDs. Add them to your `.env` file:

```
VITE_STRIPE_PRO_PRICE_ID=price_xxxxx
VITE_STRIPE_UNLIMITED_PRICE_ID=price_xxxxx
```

### 2. Set Firebase Secrets

```bash
# Set your Stripe secret key
firebase functions:secrets:set STRIPE_SECRET_KEY
# Enter: sk_test_xxxxx

# Set your Stripe webhook secret (from step 3)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Enter: whsec_xxxxx
```

### 3. Configure Stripe Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set the endpoint URL to:
   ```
   https://us-central1-scheduler-65e51.cloudfunctions.net/stripeWebhook
   ```
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)
7. Set it in Firebase secrets (step 2)

### 4. Deploy Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 5. Rebuild Frontend

```bash
npm run build
npm run deploy
```

## Firestore Shop Fields

The subscription system adds these fields to shop documents:

```javascript
{
  subscriptionTier: 'free' | 'pro' | 'unlimited',
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | null,
  stripeCustomerId: 'cus_xxxxx',
  stripeSubscriptionId: 'sub_xxxxx',
  stripePriceId: 'price_xxxxx',
  subscriptionEndsAt: Timestamp, // Set when subscription is canceling
  subscriptionUpdatedAt: Timestamp
}
```

## Feature Gating

Use the features utility to check permissions:

```javascript
import { canUseFeature, getStaffLimit, canAddStaff } from '../utils/features'

// Check if shop can use a feature
if (canUseFeature(shop, 'aiAssistant')) {
  // Show AI assistant
}

// Check staff limit
const limit = getStaffLimit(shop) // 1, 5, or Infinity
const canAdd = canAddStaff(shop, currentStaffCount)
```

## Testing

1. Create a test shop
2. Go to Dashboard → Plan tab
3. Click "Upgrade to Pro"
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete checkout
6. Verify shop's `subscriptionTier` updated to `pro`

## Troubleshooting

### Checkout not redirecting
- Check browser console for errors
- Verify CORS is enabled on Cloud Functions
- Check that `VITE_STRIPE_PRO_PRICE_ID` is set correctly

### Webhook not updating shop
- Check Firebase Functions logs
- Verify webhook secret is correct
- Ensure events are enabled in Stripe webhook settings
- Check that shopId is in session metadata

### Staff limit not enforcing
- Verify shop document has `subscriptionTier` field
- Check that StaffManager receives `shop` prop
