#!/usr/bin/env node
/**
 * Manually update a shop's subscription tier
 */

const admin = require('firebase-admin')

// Initialize with default credentials
admin.initializeApp({
  projectId: 'scheduler-65e51'
})

const db = admin.firestore()

async function main() {
  console.log('Finding shops with Stripe customers...\n')
  
  // Find all shops
  const shopsSnapshot = await db.collection('shops').get()
  
  for (const doc of shopsSnapshot.docs) {
    const shop = doc.data()
    console.log(`Shop: ${shop.name} (${doc.id})`)
    console.log(`  Owner: ${shop.ownerEmail || 'N/A'}`)
    console.log(`  Stripe Customer: ${shop.stripeCustomerId || 'None'}`)
    console.log(`  Current Tier: ${shop.subscriptionTier || 'free'}`)
    console.log(`  Subscription Status: ${shop.subscriptionStatus || 'None'}`)
    console.log('')
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
