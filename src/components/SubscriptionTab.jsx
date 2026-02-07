import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { 
  Crown, 
  Check, 
  Zap, 
  Users, 
  Bot, 
  Calendar, 
  Clock, 
  BarChart3, 
  MessageSquare, 
  Palette,
  UserPlus,
  MapPin,
  Sparkles,
  Code,
  Headphones,
  ExternalLink,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { TIERS, FEATURE_INFO, canUseFeature } from '../utils/features'

// Cloud Functions URL (update after deploy)
const FUNCTIONS_URL = 'https://us-central1-scheduler-65e51.cloudfunctions.net'

// Stripe price IDs (set after running setup script)
const STRIPE_PRICES = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
  unlimited: import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID || 'price_unlimited_monthly',
}

const FEATURE_ICONS = {
  basicBooking: Calendar,
  emailNotifications: MessageSquare,
  aiAssistant: Bot,
  recurringBookings: Clock,
  waitlist: Users,
  crm: Users,
  analytics: BarChart3,
  smsNotifications: MessageSquare,
  customBranding: Palette,
  walkIns: UserPlus,
  multiLocation: MapPin,
  noBranding: Sparkles,
  apiAccess: Code,
  prioritySupport: Headphones,
}

function SubscriptionTab({ shopId, shop: initialShop, slug }) {
  const [shop, setShop] = useState(initialShop)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [billingLoading, setBillingLoading] = useState(false)

  // Real-time listener for shop subscription updates
  useEffect(() => {
    if (!shopId) return
    
    const unsub = onSnapshot(doc(db, 'shops', shopId), (doc) => {
      if (doc.exists()) {
        setShop(doc.data())
      }
    })
    
    return () => unsub()
  }, [shopId])

  const currentTier = shop?.subscriptionTier || 'free'
  const currentTierInfo = TIERS[currentTier]
  const subscriptionStatus = shop?.subscriptionStatus
  const subscriptionEndsAt = shop?.subscriptionEndsAt

  // Format end date if subscription is canceling
  const formatEndDate = (date) => {
    if (!date) return null
    const d = date.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const handleUpgrade = async (tier) => {
    setLoading(tier)
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/createCheckoutSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          priceId: STRIPE_PRICES[tier],
          successUrl: `${window.location.origin}/stylist-scheduler/#/shop/${slug}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/stylist-scheduler/#/shop/${slug}/dashboard?subscription=canceled`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Upgrade error:', err)
      setError(err.message)
      setLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setBillingLoading(true)
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/createBillingPortalSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          returnUrl: `${window.location.origin}/stylist-scheduler/#/shop/${slug}/dashboard`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      // Redirect to Stripe Billing Portal
      window.location.href = data.url
    } catch (err) {
      console.error('Billing portal error:', err)
      setError(err.message)
      setBillingLoading(false)
    }
  }

  const tiers = [
    {
      key: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started',
      color: 'slate',
      features: [
        { key: 'staff', text: '1 staff member' },
        { key: 'basicBooking', text: 'Online booking' },
        { key: 'emailNotifications', text: 'Email notifications' },
        { key: 'fee', text: '5% platform fee on deposits', negative: true },
      ],
    },
    {
      key: 'pro',
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'For growing businesses',
      color: 'blue',
      popular: true,
      features: [
        { key: 'staff', text: 'Up to 5 staff members' },
        { key: 'basicBooking', text: 'Online booking' },
        { key: 'emailNotifications', text: 'Email notifications' },
        { key: 'aiAssistant', text: 'AI booking assistant' },
        { key: 'recurringBookings', text: 'Recurring bookings' },
        { key: 'waitlist', text: 'Waitlist management' },
        { key: 'crm', text: 'Client CRM & notes' },
        { key: 'analytics', text: 'Analytics dashboard' },
        { key: 'smsNotifications', text: 'SMS notifications' },
        { key: 'fee', text: 'No platform fees', highlight: true },
      ],
    },
    {
      key: 'unlimited',
      name: 'Unlimited',
      price: '$79',
      period: '/month',
      description: 'For established businesses',
      color: 'violet',
      features: [
        { key: 'staff', text: 'Unlimited staff members' },
        { key: 'everything', text: 'Everything in Pro, plus:' },
        { key: 'walkIns', text: 'Walk-in queue management' },
        { key: 'multiLocation', text: 'Multi-location support' },
        { key: 'noBranding', text: 'Remove SpotBookie branding' },
        { key: 'apiAccess', text: 'API access' },
        { key: 'prioritySupport', text: 'Priority support' },
      ],
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Current Plan Banner */}
      <div className={`rounded-2xl p-6 mb-8 ${
        currentTier === 'unlimited' 
          ? 'bg-gradient-to-r from-violet-500 to-purple-600' 
          : currentTier === 'pro'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
            : 'bg-gradient-to-r from-slate-600 to-slate-700'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {currentTierInfo.name} Plan
                </h2>
                {subscriptionStatus === 'past_due' && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    Payment Failed
                  </span>
                )}
                {subscriptionEndsAt && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                    Canceling
                  </span>
                )}
              </div>
              <p className="text-white/80 text-sm mt-0.5">
                {currentTier === 'free' 
                  ? 'Upgrade to unlock more features'
                  : subscriptionEndsAt
                    ? `Access until ${formatEndDate(subscriptionEndsAt)}`
                    : 'Your subscription is active'
                }
              </p>
            </div>
          </div>

          {currentTier !== 'free' && (
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              {billingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Past Due Warning */}
      {subscriptionStatus === 'past_due' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Payment Failed</p>
            <p className="text-sm text-amber-600">
              Your last payment failed. Please update your payment method to keep your subscription active.
            </p>
            <button
              onClick={handleManageBilling}
              className="mt-2 text-sm font-semibold text-amber-700 hover:text-amber-800 underline"
            >
              Update Payment Method →
            </button>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const isCurrentTier = tier.key === currentTier
          const isLowerTier = ['free', 'pro', 'unlimited'].indexOf(tier.key) < ['free', 'pro', 'unlimited'].indexOf(currentTier)
          const canUpgrade = !isCurrentTier && !isLowerTier

          return (
            <div
              key={tier.key}
              className={`relative bg-white rounded-2xl border-2 p-6 transition-all ${
                tier.popular
                  ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                  : isCurrentTier
                    ? 'border-emerald-500'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentTier && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">{tier.price}</span>
                  <span className="text-slate-500 text-sm">{tier.period}</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, i) => {
                  const Icon = FEATURE_ICONS[feature.key] || Check
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        feature.negative
                          ? 'bg-red-100 text-red-500'
                          : feature.highlight
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {feature.negative ? (
                          <span className="text-xs font-bold">%</span>
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                      <span className={`text-sm ${
                        feature.negative 
                          ? 'text-red-600' 
                          : feature.highlight
                            ? 'text-emerald-700 font-medium'
                            : 'text-slate-700'
                      }`}>
                        {feature.text}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {canUpgrade ? (
                <button
                  onClick={() => handleUpgrade(tier.key)}
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                    tier.key === 'unlimited'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/20'
                      : tier.key === 'pro'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  } disabled:opacity-50`}
                >
                  {loading === tier.key ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Upgrade to {tier.name}
                    </>
                  )}
                </button>
              ) : isCurrentTier ? (
                <div className="w-full py-3 text-center text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200">
                  ✓ Your Current Plan
                </div>
              ) : (
                <div className="w-full py-3 text-center text-sm font-medium text-slate-400 bg-slate-50 rounded-xl">
                  Included in your plan
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <div className="mt-12">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Feature Comparison</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700">Feature</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-slate-700">Free</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-blue-600">Pro</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-violet-600">Unlimited</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-6 text-sm text-slate-700">Staff Members</td>
                <td className="py-3 px-4 text-center text-sm text-slate-600">1</td>
                <td className="py-3 px-4 text-center text-sm text-slate-600">5</td>
                <td className="py-3 px-4 text-center text-sm text-slate-600">Unlimited</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-6 text-sm text-slate-700">Platform Fee</td>
                <td className="py-3 px-4 text-center text-sm text-red-500">5%</td>
                <td className="py-3 px-4 text-center text-sm text-emerald-600">0%</td>
                <td className="py-3 px-4 text-center text-sm text-emerald-600">0%</td>
              </tr>
              {Object.entries(FEATURE_INFO).map(([key, info]) => (
                <tr key={key} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 px-6 text-sm text-slate-700">{info.name}</td>
                  <td className="py-3 px-4 text-center">
                    {TIERS.free.features.includes(key) ? (
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {TIERS.pro.features.includes(key) ? (
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {TIERS.unlimited.features.includes(key) ? (
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {[
            {
              q: 'Can I cancel anytime?',
              a: 'Yes! You can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.',
            },
            {
              q: 'What happens if I downgrade?',
              a: 'When you downgrade, you\'ll keep your current plan until the end of the billing period. After that, feature limits (like staff count) will apply.',
            },
            {
              q: 'What is the platform fee?',
              a: 'On the Free plan, we charge a 5% fee on any deposits collected through SpotBookie. Pro and Unlimited plans have no platform fees.',
            },
            {
              q: 'Do you offer refunds?',
              a: 'We offer a 14-day money-back guarantee for first-time subscribers. Contact us if you\'re not satisfied.',
            },
          ].map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <h4 className="font-semibold text-slate-900 mb-2">{faq.q}</h4>
              <p className="text-sm text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SubscriptionTab
