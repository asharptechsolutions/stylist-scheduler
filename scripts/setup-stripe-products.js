#!/usr/bin/env node
/**
 * SpotBookie Stripe Products Setup Script
 * 
 * Run this once to create subscription products and prices in Stripe.
 * 
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.js
 * 
 * This creates:
 *   - SpotBookie Pro product ($29/mo)
 *   - SpotBookie Unlimited product ($79/mo)
 */

const Stripe = require('stripe')

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is required')
  console.error('Usage: STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.js')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

async function main() {
  console.log('🚀 Setting up SpotBookie subscription products in Stripe...\n')

  try {
    // Check if products already exist
    const existingProducts = await stripe.products.list({ active: true })
    const proProduct = existingProducts.data.find(p => p.name === 'SpotBookie Pro')
    const unlimitedProduct = existingProducts.data.find(p => p.name === 'SpotBookie Unlimited')

    let proPriceId, unlimitedPriceId

    // Create Pro product if it doesn't exist
    if (proProduct) {
      console.log('✅ SpotBookie Pro product already exists:', proProduct.id)
      const prices = await stripe.prices.list({ product: proProduct.id, active: true })
      proPriceId = prices.data[0]?.id
    } else {
      console.log('Creating SpotBookie Pro product...')
      const product = await stripe.products.create({
        name: 'SpotBookie Pro',
        description: 'Pro subscription for SpotBookie. 5 staff, AI assistant, recurring bookings, waitlist, CRM, analytics, SMS.',
        metadata: {
          tier: 'pro',
        },
      })
      console.log('✅ Created SpotBookie Pro product:', product.id)

      // Create monthly price for Pro
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 2900, // $29.00
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          tier: 'pro',
        },
      })
      proPriceId = price.id
      console.log('✅ Created Pro monthly price:', price.id, '($29/mo)')
    }

    // Create Unlimited product if it doesn't exist
    if (unlimitedProduct) {
      console.log('✅ SpotBookie Unlimited product already exists:', unlimitedProduct.id)
      const prices = await stripe.prices.list({ product: unlimitedProduct.id, active: true })
      unlimitedPriceId = prices.data[0]?.id
    } else {
      console.log('Creating SpotBookie Unlimited product...')
      const product = await stripe.products.create({
        name: 'SpotBookie Unlimited',
        description: 'Unlimited subscription for SpotBookie. Unlimited staff, walk-ins, multi-location, no branding, API access, priority support.',
        metadata: {
          tier: 'unlimited',
        },
      })
      console.log('✅ Created SpotBookie Unlimited product:', product.id)

      // Create monthly price for Unlimited
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 7900, // $79.00
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          tier: 'unlimited',
        },
      })
      unlimitedPriceId = price.id
      console.log('✅ Created Unlimited monthly price:', price.id, '($79/mo)')
    }

    console.log('\n========================================')
    console.log('🎉 Stripe products setup complete!')
    console.log('========================================\n')
    console.log('Add these price IDs to your environment:')
    console.log('')
    console.log(`VITE_STRIPE_PRO_PRICE_ID=${proPriceId}`)
    console.log(`VITE_STRIPE_UNLIMITED_PRICE_ID=${unlimitedPriceId}`)
    console.log('')
    console.log('Also set these Firebase secrets:')
    console.log('  firebase functions:secrets:set STRIPE_SECRET_KEY')
    console.log('  firebase functions:secrets:set STRIPE_WEBHOOK_SECRET')
    console.log('')

  } catch (error) {
    console.error('Error setting up Stripe products:', error.message)
    process.exit(1)
  }
}

main()
