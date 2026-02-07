import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  CreditCard,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  Building2,
  Shield,
  Zap,
  ArrowRight,
  Clock,
  TrendingUp,
  Wallet,
  Calendar,
  Info
} from 'lucide-react'

const FUNCTIONS_URL = 'https://us-central1-scheduler-65e51.cloudfunctions.net'

function StripeConnectSettings({ shopId, shop: initialShop, slug }) {
  const [shop, setShop] = useState(initialShop)
  const [loading, setLoading] = useState(null) // 'create' | 'onboard' | 'dashboard' | 'balance'
  const [error, setError] = useState(null)
  const [balanceData, setBalanceData] = useState(null)

  // Real-time listener for shop Connect updates
  useEffect(() => {
    if (!shopId) return
    
    const unsub = onSnapshot(doc(db, 'shops', shopId), (doc) => {
      if (doc.exists()) {
        setShop(doc.data())
      }
    })
    
    return () => unsub()
  }, [shopId])

  const hasAccount = !!shop?.stripeAccountId
  const isOnboarded = shop?.stripeOnboardingComplete
  const payoutsEnabled = shop?.payoutsEnabled
  const accountStatus = shop?.stripeAccountStatus
  const currentTier = shop?.subscriptionTier || 'free'
  const platformFee = currentTier === 'free' ? '5%' : '0%'

  // Create Connect account
  const handleCreateAccount = async () => {
    setLoading('create')
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/createConnectAccount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          email: shop.ownerEmail,
          businessName: shop.name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account')
      }

      // If account was just created or already exists, start onboarding
      if (!data.alreadyExists || !shop.stripeOnboardingComplete) {
        await startOnboarding()
      }
    } catch (err) {
      console.error('Create account error:', err)
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  // Start/continue onboarding
  const startOnboarding = async () => {
    setLoading('onboard')
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/createAccountLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          returnUrl: `${window.location.origin}/stylist-scheduler/#/shop/${slug}/dashboard?connect=return`,
          refreshUrl: `${window.location.origin}/stylist-scheduler/#/shop/${slug}/dashboard?connect=refresh`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create onboarding link')
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url
    } catch (err) {
      console.error('Onboarding error:', err)
      setError(err.message)
      setLoading(null)
    }
  }

  // Open Stripe Express dashboard
  const openDashboard = async () => {
    setLoading('dashboard')
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/getConnectDashboardLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get dashboard link')
      }

      // Open in new tab
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('Dashboard link error:', err)
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  // Fetch balance data
  const fetchBalance = async () => {
    setLoading('balance')
    setError(null)

    try {
      const response = await fetch(`${FUNCTIONS_URL}/getConnectBalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch balance')
      }

      setBalanceData(data)
    } catch (err) {
      console.error('Balance fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  // Fetch balance on mount if account is ready
  useEffect(() => {
    if (payoutsEnabled && !balanceData) {
      fetchBalance()
    }
  }, [payoutsEnabled])

  // Format currency
  const formatCurrency = (amount, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Payments</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Connect Stripe to accept deposits and get paid
          </p>
        </div>
        {hasAccount && payoutsEnabled && (
          <button
            onClick={fetchBalance}
            disabled={loading === 'balance'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
          >
            {loading === 'balance' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Something went wrong</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Not Connected Yet */}
      {!hasAccount && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200 p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-5">
              <CreditCard className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Accept Payments</h3>
            <p className="text-slate-600 max-w-md mb-6">
              Connect your Stripe account to accept deposit payments from clients when they book. 
              Funds are transferred directly to your bank account.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl mb-8">
              {[
                { icon: Shield, label: 'Secure payments', desc: '256-bit encryption' },
                { icon: Zap, label: 'Fast payouts', desc: '2-day transfers' },
                { icon: DollarSign, label: 'Low fees', desc: '2.9% + 30¢' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-white/70 rounded-xl p-4 text-center">
                  <Icon className="w-5 h-5 text-violet-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleCreateAccount}
              disabled={loading === 'create'}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold text-base shadow-lg shadow-violet-600/25 transition-all disabled:opacity-50"
            >
              {loading === 'create' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Connect with Stripe
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {currentTier === 'free' && (
              <p className="mt-4 text-xs text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Free tier: {platformFee} platform fee on deposits. 
                <a href="#" className="text-violet-600 hover:underline">Upgrade to remove</a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Account Created but Onboarding Incomplete */}
      {hasAccount && !isOnboarded && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Complete Your Setup</h3>
              <p className="text-sm text-slate-600 mb-4">
                Your Stripe account is created, but you need to complete the onboarding process 
                to start accepting payments.
              </p>
              <button
                onClick={startOnboarding}
                disabled={loading === 'onboard'}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all disabled:opacity-50"
              >
                {loading === 'onboard' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Connected but Payouts Not Enabled */}
      {hasAccount && isOnboarded && !payoutsEnabled && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Verification in Progress</h3>
              <p className="text-sm text-slate-600 mb-4">
                Stripe is reviewing your account. This usually takes a few minutes. 
                Once approved, you'll be able to accept payments.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={startOnboarding}
                  disabled={loading === 'onboard'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {loading === 'onboard' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Check Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fully Connected */}
      {hasAccount && payoutsEnabled && (
        <>
          {/* Status Card */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">Stripe Connected</h3>
                    <span className="px-2 py-0.5 bg-white/20 text-xs font-bold rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-white/80 text-sm mt-0.5">
                    You're ready to accept deposit payments
                  </p>
                </div>
              </div>
              <button
                onClick={openDashboard}
                disabled={loading === 'dashboard'}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              >
                {loading === 'dashboard' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Stripe Dashboard
              </button>
            </div>
          </div>

          {/* Balance & Earnings */}
          {balanceData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Available Balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-500">Available</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {balanceData.balance.available[0] 
                    ? formatCurrency(balanceData.balance.available[0].amount, balanceData.balance.available[0].currency)
                    : '$0.00'
                  }
                </p>
                <p className="text-xs text-slate-400 mt-1">Ready to pay out</p>
              </div>

              {/* Pending Balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-500">Pending</span>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {balanceData.balance.pending[0] 
                    ? formatCurrency(balanceData.balance.pending[0].amount, balanceData.balance.pending[0].currency)
                    : '$0.00'
                  }
                </p>
                <p className="text-xs text-slate-400 mt-1">Processing</p>
              </div>

              {/* Platform Fee Info */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-500">Platform Fee</span>
                  <DollarSign className="w-4 h-4 text-violet-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{platformFee}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {currentTier === 'free' ? 'Upgrade to remove' : 'No platform fees'}
                </p>
              </div>
            </div>
          )}

          {/* Recent Payments */}
          {balanceData?.recentCharges?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Recent Payments</h3>
                <button
                  onClick={openDashboard}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-3">
                {balanceData.recentCharges.slice(0, 5).map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        charge.status === 'succeeded' ? 'bg-emerald-100' : 'bg-slate-100'
                      }`}>
                        {charge.status === 'succeeded' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {charge.metadata?.clientName || 'Payment'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(charge.created)}
                          {charge.metadata?.serviceName && ` · ${charge.metadata.serviceName}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(charge.amount, charge.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Payouts */}
          {balanceData?.recentPayouts?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Recent Payouts</h3>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="space-y-3">
                {balanceData.recentPayouts.slice(0, 3).map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        payout.status === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                      }`}>
                        <Wallet className={`w-4 h-4 ${
                          payout.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">{payout.status}</p>
                        <p className="text-xs text-slate-400">
                          {payout.arrivalDate ? `Arrives ${formatDate(payout.arrivalDate)}` : formatDate(payout.created)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {formatCurrency(payout.amount, payout.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Info about how it works */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          How it works
        </h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
            <span>Client books an appointment and pays the deposit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
            <span>Payment goes directly to your Stripe account (minus Stripe's 2.9% + 30¢ fee{currentTier === 'free' && ` and ${platformFee} platform fee`})</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
            <span>Stripe automatically transfers funds to your bank (usually within 2 days)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default StripeConnectSettings
