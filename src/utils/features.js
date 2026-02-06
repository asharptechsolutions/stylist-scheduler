/**
 * SpotBookie Feature Flags & Subscription Tier System
 * 
 * Tiers:
 * - free: 1 staff, basic booking, 5% platform fee on deposits
 * - pro ($29/mo): 5 staff, AI assistant, recurring, waitlist, CRM, analytics, SMS, no platform fee
 * - unlimited ($79/mo): unlimited staff, walk-ins, multi-location, no branding, API access
 */

// Tier configuration
export const TIERS = {
  free: {
    name: 'Free',
    price: 0,
    staffLimit: 1,
    platformFeePercent: 5, // 5% fee on deposits
    features: [
      'basicBooking',
      'emailNotifications',
    ],
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceId: null, // Will be set after Stripe setup
    staffLimit: 5,
    platformFeePercent: 0,
    features: [
      'basicBooking',
      'emailNotifications',
      'aiAssistant',
      'recurringBookings',
      'waitlist',
      'crm',
      'analytics',
      'smsNotifications',
      'customBranding',
    ],
  },
  unlimited: {
    name: 'Unlimited',
    price: 79,
    priceId: null, // Will be set after Stripe setup
    staffLimit: Infinity,
    platformFeePercent: 0,
    features: [
      'basicBooking',
      'emailNotifications',
      'aiAssistant',
      'recurringBookings',
      'waitlist',
      'crm',
      'analytics',
      'smsNotifications',
      'customBranding',
      'walkIns',
      'multiLocation',
      'noBranding',
      'apiAccess',
      'prioritySupport',
    ],
  },
}

// Feature descriptions for UI
export const FEATURE_INFO = {
  basicBooking: {
    name: 'Online Booking',
    description: 'Accept bookings through your booking page',
  },
  emailNotifications: {
    name: 'Email Notifications',
    description: 'Automatic booking confirmations and reminders',
  },
  aiAssistant: {
    name: 'AI Booking Assistant',
    description: 'Smart suggestions and automated responses',
  },
  recurringBookings: {
    name: 'Recurring Bookings',
    description: 'Schedule repeating appointments',
  },
  waitlist: {
    name: 'Waitlist',
    description: 'Let clients join a waitlist when fully booked',
  },
  crm: {
    name: 'Client CRM',
    description: 'Client notes, history, and win-back tracking',
  },
  analytics: {
    name: 'Analytics',
    description: 'Detailed booking and revenue analytics',
  },
  smsNotifications: {
    name: 'SMS Notifications',
    description: 'Send text message reminders to clients',
  },
  customBranding: {
    name: 'Custom Branding',
    description: 'Customize colors and branding on your booking page',
  },
  walkIns: {
    name: 'Walk-in Queue',
    description: 'Manage walk-in clients with live queue',
  },
  multiLocation: {
    name: 'Multi-Location',
    description: 'Manage multiple business locations',
  },
  noBranding: {
    name: 'Remove SpotBookie Branding',
    description: 'White-label your booking experience',
  },
  apiAccess: {
    name: 'API Access',
    description: 'Integrate with external tools and systems',
  },
  prioritySupport: {
    name: 'Priority Support',
    description: '24/7 priority customer support',
  },
}

/**
 * Check if a shop can use a specific feature
 * @param {Object} shop - Shop document with subscriptionTier field
 * @param {string} feature - Feature key to check
 * @returns {boolean}
 */
export function canUseFeature(shop, feature) {
  const tier = shop?.subscriptionTier || 'free'
  const tierConfig = TIERS[tier]
  
  if (!tierConfig) {
    console.warn(`Unknown tier: ${tier}, defaulting to free`)
    return TIERS.free.features.includes(feature)
  }
  
  return tierConfig.features.includes(feature)
}

/**
 * Get the staff limit for a shop's tier
 * @param {Object} shop - Shop document with subscriptionTier field
 * @returns {number}
 */
export function getStaffLimit(shop) {
  const tier = shop?.subscriptionTier || 'free'
  const tierConfig = TIERS[tier]
  return tierConfig?.staffLimit || 1
}

/**
 * Check if a shop can add more staff
 * @param {Object} shop - Shop document
 * @param {number} currentStaffCount - Current active staff count
 * @returns {boolean}
 */
export function canAddStaff(shop, currentStaffCount) {
  const limit = getStaffLimit(shop)
  return currentStaffCount < limit
}

/**
 * Get the platform fee percentage for a shop
 * @param {Object} shop - Shop document
 * @returns {number} Fee percentage (0-100)
 */
export function getPlatformFeePercent(shop) {
  const tier = shop?.subscriptionTier || 'free'
  const tierConfig = TIERS[tier]
  return tierConfig?.platformFeePercent || 5
}

/**
 * Calculate platform fee for a deposit amount
 * @param {Object} shop - Shop document
 * @param {number} depositAmount - Deposit amount in dollars
 * @returns {number} Fee amount in dollars
 */
export function calculatePlatformFee(shop, depositAmount) {
  const feePercent = getPlatformFeePercent(shop)
  return (depositAmount * feePercent) / 100
}

/**
 * Check if subscription is active (not canceled or past_due)
 * @param {Object} shop - Shop document
 * @returns {boolean}
 */
export function isSubscriptionActive(shop) {
  // Free tier is always "active"
  if (!shop?.subscriptionTier || shop.subscriptionTier === 'free') {
    return true
  }
  
  return shop.subscriptionStatus === 'active'
}

/**
 * Get the tier a shop will fall back to when subscription ends
 * @param {Object} shop - Shop document
 * @returns {string} Tier key
 */
export function getFallbackTier(shop) {
  if (shop?.subscriptionStatus === 'canceled' && shop?.subscriptionEndsAt) {
    const endsAt = shop.subscriptionEndsAt.toDate 
      ? shop.subscriptionEndsAt.toDate() 
      : new Date(shop.subscriptionEndsAt)
    
    if (new Date() > endsAt) {
      return 'free'
    }
  }
  return shop?.subscriptionTier || 'free'
}

/**
 * Get tier display info for UI
 * @param {string} tierKey - Tier key
 * @returns {Object} Tier display info
 */
export function getTierInfo(tierKey) {
  return TIERS[tierKey] || TIERS.free
}

/**
 * Get features available at a tier but not at current tier
 * @param {string} currentTier - Current tier key
 * @param {string} targetTier - Target tier key
 * @returns {string[]} Array of feature keys
 */
export function getUpgradeFeatures(currentTier, targetTier) {
  const current = TIERS[currentTier] || TIERS.free
  const target = TIERS[targetTier]
  
  if (!target) return []
  
  return target.features.filter(f => !current.features.includes(f))
}

/**
 * Format tier comparison for upgrade prompts
 * @param {string} currentTier - Current tier
 * @returns {Object[]} Array of upgrade options with features
 */
export function getUpgradeOptions(currentTier) {
  const tierOrder = ['free', 'pro', 'unlimited']
  const currentIndex = tierOrder.indexOf(currentTier || 'free')
  
  return tierOrder
    .slice(currentIndex + 1)
    .map(tierKey => ({
      key: tierKey,
      ...TIERS[tierKey],
      newFeatures: getUpgradeFeatures(currentTier, tierKey),
    }))
}

export default {
  TIERS,
  FEATURE_INFO,
  canUseFeature,
  getStaffLimit,
  canAddStaff,
  getPlatformFeePercent,
  calculatePlatformFee,
  isSubscriptionActive,
  getFallbackTier,
  getTierInfo,
  getUpgradeOptions,
}
