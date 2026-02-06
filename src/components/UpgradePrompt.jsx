import { useState } from 'react'
import { Crown, Zap, X, ArrowRight, Loader2, Users, Check } from 'lucide-react'
import { TIERS, getUpgradeOptions } from '../utils/features'

// Cloud Functions URL
const FUNCTIONS_URL = 'https://us-central1-scheduler-65e51.cloudfunctions.net'

// Stripe price IDs
const STRIPE_PRICES = {
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
  unlimited: import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID || 'price_unlimited_monthly',
}

/**
 * Modal upgrade prompt when hitting limits
 */
export function UpgradeModal({ 
  isOpen, 
  onClose, 
  shopId, 
  slug,
  currentTier = 'free',
  feature,
  title,
  description 
}) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const upgradeOptions = getUpgradeOptions(currentTier)

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
          successUrl: `${window.location.origin}/#/shop/${slug}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/#/shop/${slug}/dashboard?subscription=canceled`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      window.location.href = data.url
    } catch (err) {
      console.error('Upgrade error:', err)
      setError(err.message)
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {title || 'Upgrade Required'}
              </h3>
              <p className="text-sm text-slate-500">
                {description || 'Unlock more features with a premium plan'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Upgrade Options */}
        <div className="space-y-3">
          {upgradeOptions.map((option) => (
            <div
              key={option.key}
              className={`border-2 rounded-xl p-4 transition-all ${
                option.key === 'pro'
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-violet-300 bg-violet-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-slate-900">{option.name}</h4>
                  <p className="text-lg font-extrabold text-slate-900">
                    ${option.price}<span className="text-sm font-normal text-slate-500">/month</span>
                  </p>
                </div>
                <button
                  onClick={() => handleUpgrade(option.key)}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 ${
                    option.key === 'pro'
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-violet-500 hover:bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  }`}
                >
                  {loading === option.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Upgrade
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {option.key === 'pro' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700">
                    <Users className="w-3 h-3" />
                    5 staff
                  </span>
                )}
                {option.key === 'unlimited' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-violet-200 rounded-lg text-xs font-medium text-violet-700">
                    <Users className="w-3 h-3" />
                    Unlimited staff
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700">
                  <Check className="w-3 h-3" />
                  No platform fees
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Cancel anytime • 14-day money-back guarantee
        </p>
      </div>
    </div>
  )
}

/**
 * Inline upgrade banner for feature gates
 */
export function UpgradeBanner({ 
  feature,
  currentTier = 'free',
  onUpgradeClick 
}) {
  const tierInfo = TIERS[currentTier]
  const nextTier = currentTier === 'free' ? 'pro' : 'unlimited'
  const nextTierInfo = TIERS[nextTier]

  return (
    <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm">
            Upgrade to {nextTierInfo.name}
          </p>
          <p className="text-xs text-slate-600">
            {feature} is available on {nextTierInfo.name} and above
          </p>
        </div>
      </div>
      <button
        onClick={onUpgradeClick}
        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md shadow-blue-500/20 flex-shrink-0"
      >
        Upgrade
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * Small upgrade badge/button
 */
export function UpgradeBadge({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-md text-xs font-bold hover:from-blue-600 hover:to-violet-700 transition-all"
    >
      <Crown className="w-3 h-3" />
      PRO
    </button>
  )
}

/**
 * Staff limit warning banner
 */
export function StaffLimitBanner({ currentCount, limit, onUpgradeClick }) {
  const isAtLimit = currentCount >= limit
  const isNearLimit = currentCount >= limit - 1 && currentCount < limit

  if (!isAtLimit && !isNearLimit) return null

  return (
    <div className={`rounded-xl p-4 flex items-center justify-between gap-4 mb-4 ${
      isAtLimit 
        ? 'bg-amber-50 border border-amber-200' 
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isAtLimit ? 'bg-amber-100' : 'bg-blue-100'
        }`}>
          <Users className={`w-5 h-5 ${isAtLimit ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div>
          <p className={`font-semibold text-sm ${isAtLimit ? 'text-amber-900' : 'text-blue-900'}`}>
            {isAtLimit ? 'Staff limit reached' : 'Almost at staff limit'}
          </p>
          <p className="text-xs text-slate-600">
            You have {currentCount} of {limit} staff member{limit !== 1 ? 's' : ''}.
            {isAtLimit ? ' Upgrade to add more.' : ' Upgrade before you need more.'}
          </p>
        </div>
      </div>
      <button
        onClick={onUpgradeClick}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md flex-shrink-0 ${
          isAtLimit
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
            : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
        }`}
      >
        <Zap className="w-4 h-4" />
        Upgrade
      </button>
    </div>
  )
}

export default {
  UpgradeModal,
  UpgradeBanner,
  UpgradeBadge,
  StaffLimitBanner,
}
