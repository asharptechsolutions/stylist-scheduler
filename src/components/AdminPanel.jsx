import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import {
  Shield, Store, CreditCard, DollarSign, Users, Search, ExternalLink,
  LogOut, Crown, Zap, Gift, TrendingUp, Calendar, Mail, Eye,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, Clock,
  BarChart3, PieChart, ArrowUpRight, Settings, Trash2, Ban, RefreshCw, X
} from 'lucide-react'

// Admin emails that can access this panel
const ADMIN_EMAILS = ['aaron.sharp2011@gmail.com']

// Pricing tiers
const TIER_PRICES = {
  free: 0,
  pro: 29,
  unlimited: 79
}

const TIER_LABELS = {
  free: { label: 'Free', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  pro: { label: 'Pro', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  unlimited: { label: 'Unlimited', color: 'bg-violet-100 text-violet-700 border-violet-200' }
}

function AdminPanel({ user }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [shops, setShops] = useState([])
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShop, setSelectedShop] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Check if user is admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase())

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true })
      return
    }

    if (!isAdmin) {
      navigate('/', { replace: true })
      return
    }

    fetchData()
  }, [user, isAdmin, navigate])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all shops
      const shopsSnapshot = await getDocs(collection(db, 'shops'))
      const shopsData = shopsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setShops(shopsData)

      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const tierCounts = { free: 0, pro: 0, unlimited: 0 }
    let stripeConnectedCount = 0
    let stripePendingCount = 0

    shops.forEach(shop => {
      const tier = shop.subscriptionTier || 'free'
      tierCounts[tier] = (tierCounts[tier] || 0) + 1

      if (shop.stripeConnectAccountId) {
        if (shop.stripeConnectComplete) {
          stripeConnectedCount++
        } else {
          stripePendingCount++
        }
      }
    })

    const mrr = (tierCounts.pro * TIER_PRICES.pro) + (tierCounts.unlimited * TIER_PRICES.unlimited)

    // Recent shops (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentShops = shops.filter(shop => {
      if (!shop.createdAt) return false
      const createdDate = shop.createdAt.toDate ? shop.createdAt.toDate() : new Date(shop.createdAt)
      return createdDate > thirtyDaysAgo
    })

    return {
      totalShops: shops.length,
      tierCounts,
      mrr,
      stripeConnectedCount,
      stripePendingCount,
      recentShops: recentShops.length
    }
  }, [shops])

  // Filter shops by search
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shops

    const query = searchQuery.toLowerCase()
    return shops.filter(shop =>
      shop.name?.toLowerCase().includes(query) ||
      shop.slug?.toLowerCase().includes(query) ||
      shop.ownerEmail?.toLowerCase().includes(query)
    )
  }, [shops, searchQuery])

  // Sort shops by created date (newest first)
  const sortedShops = useMemo(() => {
    return [...filteredShops].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
      return dateB - dateA
    })
  }, [filteredShops])

  // Actions
  const changeTier = async (shopId, newTier) => {
    setActionLoading(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        subscriptionTier: newTier
      })
      setShops(prev => prev.map(s =>
        s.id === shopId ? { ...s, subscriptionTier: newTier } : s
      ))
    } catch (err) {
      console.error('Error changing tier:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const toggleShopDisabled = async (shopId, currentDisabled) => {
    setActionLoading(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        disabled: !currentDisabled
      })
      setShops(prev => prev.map(s =>
        s.id === shopId ? { ...s, disabled: !currentDisabled } : s
      ))
    } catch (err) {
      console.error('Error toggling shop status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStripeStatus = (shop) => {
    if (!shop.stripeConnectAccountId) {
      return { label: 'None', color: 'bg-slate-100 text-slate-500', icon: null }
    }
    if (shop.stripeConnectComplete) {
      return { label: 'Connected', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle }
    }
    return { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading admin panel…</span>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: PieChart },
    { key: 'shops', label: 'Shops', icon: Store },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'support', label: 'Support', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-violet-600/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">SpotBookie Admin</h1>
                <p className="text-xs text-slate-500">Platform Management</p>
              </div>
            </div>

            {/* Center: Tabs */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === tab.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Store className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">{metrics.totalShops}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">Total Shops</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">${metrics.mrr}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">Monthly Recurring Revenue</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-violet-600" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">{metrics.stripeConnectedCount}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">Stripe Connected</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">{metrics.recentShops}</div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">New (Last 30 Days)</div>
              </div>
            </div>

            {/* Subscription Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Subscription Tiers
                </h2>
                <div className="space-y-4">
                  {Object.entries(metrics.tierCounts).map(([tier, count]) => {
                    const tierInfo = TIER_LABELS[tier] || TIER_LABELS.free
                    const percentage = metrics.totalShops > 0 ? Math.round((count / metrics.totalShops) * 100) : 0
                    return (
                      <div key={tier} className="flex items-center gap-4">
                        <div className="w-24">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${tierInfo.color}`}>
                            {tierInfo.label}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                tier === 'free' ? 'bg-slate-400' :
                                tier === 'pro' ? 'bg-blue-500' : 'bg-violet-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-sm font-bold text-slate-900">{count}</span>
                          <span className="text-xs text-slate-500 ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-violet-500" />
                  Payment Status
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-slate-900">Stripe Connected</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{metrics.stripeConnectedCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-slate-900">Pending Setup</span>
                    </div>
                    <span className="text-lg font-bold text-amber-700">{metrics.stripePendingCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-slate-500" />
                      <span className="font-semibold text-slate-900">No Payments</span>
                    </div>
                    <span className="text-lg font-bold text-slate-700">
                      {metrics.totalShops - metrics.stripeConnectedCount - metrics.stripePendingCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Signups */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Recent Signups
              </h2>
              <div className="space-y-3">
                {sortedShops.slice(0, 5).map(shop => {
                  const tierInfo = TIER_LABELS[shop.subscriptionTier] || TIER_LABELS.free
                  return (
                    <div key={shop.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Store className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{shop.name || 'Unnamed Shop'}</div>
                          <div className="text-xs text-slate-500">{shop.ownerEmail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${tierInfo.color}`}>
                          {tierInfo.label}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(shop.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Shops Tab */}
        {activeTab === 'shops' && (
          <div className="animate-fade-in">
            {/* Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, slug, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            {/* Shops List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">All Shops</h2>
                <span className="text-sm font-medium text-slate-500">
                  {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {sortedShops.map(shop => {
                  const tierInfo = TIER_LABELS[shop.subscriptionTier] || TIER_LABELS.free
                  const stripeStatus = getStripeStatus(shop)
                  const StripeIcon = stripeStatus.icon

                  return (
                    <div
                      key={shop.id}
                      className={`p-4 hover:bg-slate-50 transition-all ${shop.disabled ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(shop.name || 'S')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm truncate">
                                {shop.name || 'Unnamed Shop'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${tierInfo.color}`}>
                                {tierInfo.label}
                              </span>
                              {shop.disabled && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              /{shop.slug} • {shop.ownerEmail}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${stripeStatus.color}`}>
                                {StripeIcon && <StripeIcon className="w-3 h-3" />}
                                Stripe: {stripeStatus.label}
                              </span>
                              <span className="text-slate-400">
                                Created: {formatDate(shop.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            to={`/shop/${shop.slug}`}
                            target="_blank"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View public page"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/shop/${shop.slug}/dashboard`}
                            target="_blank"
                            className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            title="View dashboard (impersonate)"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setSelectedShop(shop)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Manage shop"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {sortedShops.length === 0 && (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Store className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No shops found</p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-2 text-sm text-violet-600 hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* MRR Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  MRR Breakdown
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div>
                      <span className="font-semibold text-slate-900">Pro Plans</span>
                      <p className="text-xs text-slate-500 mt-0.5">{metrics.tierCounts.pro} shops × $29/mo</p>
                    </div>
                    <span className="text-lg font-bold text-blue-700">
                      ${metrics.tierCounts.pro * TIER_PRICES.pro}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-violet-50 border border-violet-200 rounded-xl">
                    <div>
                      <span className="font-semibold text-slate-900">Unlimited Plans</span>
                      <p className="text-xs text-slate-500 mt-0.5">{metrics.tierCounts.unlimited} shops × $79/mo</p>
                    </div>
                    <span className="text-lg font-bold text-violet-700">
                      ${metrics.tierCounts.unlimited * TIER_PRICES.unlimited}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div>
                      <span className="font-bold text-slate-900">Total MRR</span>
                    </div>
                    <span className="text-2xl font-extrabold text-emerald-700">${metrics.mrr}</span>
                  </div>
                </div>
              </div>

              {/* Platform Fees Info */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-violet-500" />
                  Platform Fees
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-900">Free Tier</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      5% platform fee on deposit payments via Stripe Connect
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-slate-900">Pro & Unlimited</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      No platform fees — shops keep 100% of payments
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200">
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-violet-600/20 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Stripe Dashboard
                  </a>
                </div>
              </div>
            </div>

            {/* Stripe Connect Overview */}
            <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-500" />
                Stripe Connect Accounts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-3xl font-extrabold text-emerald-700">{metrics.stripeConnectedCount}</div>
                  <div className="text-sm font-medium text-emerald-600 mt-1">Fully Connected</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-3xl font-extrabold text-amber-700">{metrics.stripePendingCount}</div>
                  <div className="text-sm font-medium text-amber-600 mt-1">Pending Setup</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-3xl font-extrabold text-slate-700">
                    {metrics.totalShops - metrics.stripeConnectedCount - metrics.stripePendingCount}
                  </div>
                  <div className="text-sm font-medium text-slate-600 mt-1">Not Started</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-500" />
                Support Tools
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Manage shops, impersonate dashboards, and take quick actions.
              </p>

              {/* Quick Actions Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-slate-900">View Dashboard</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Click the external link icon on any shop to view their dashboard. You must be logged in as an admin.
                  </p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-slate-900">Change Tier</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Click the settings icon on any shop to change their subscription tier or disable the account.
                  </p>
                </div>
              </div>
            </div>

            {/* Shop Lookup */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Shop Lookup</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, slug, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              {searchQuery && (
                <div className="space-y-2">
                  {filteredShops.slice(0, 10).map(shop => (
                    <button
                      key={shop.id}
                      onClick={() => setSelectedShop(shop)}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Store className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{shop.name}</div>
                          <div className="text-xs text-slate-500">/{shop.slug}</div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shop Detail Modal */}
      {selectedShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center text-white font-bold">
                  {(selectedShop.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedShop.name}</h3>
                  <p className="text-sm text-slate-500">/{selectedShop.slug}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShop(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shop Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{selectedShop.ownerEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Created: {formatDate(selectedShop.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">
                  Stripe: {getStripeStatus(selectedShop).label}
                  {selectedShop.stripeConnectAccountId && (
                    <span className="ml-1 text-xs text-slate-400 font-mono">
                      ({selectedShop.stripeConnectAccountId})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Subscription Tier */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Subscription Tier
              </label>
              <div className="flex gap-2">
                {['free', 'pro', 'unlimited'].map(tier => {
                  const tierInfo = TIER_LABELS[tier]
                  const isActive = (selectedShop.subscriptionTier || 'free') === tier
                  return (
                    <button
                      key={tier}
                      onClick={() => changeTier(selectedShop.id, tier)}
                      disabled={actionLoading === selectedShop.id}
                      className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all border-2 ${
                        isActive
                          ? tier === 'free' ? 'border-slate-400 bg-slate-100 text-slate-900' :
                            tier === 'pro' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                            'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {tierInfo.label}
                      {tier !== 'free' && (
                        <span className="block text-xs font-normal mt-0.5">${TIER_PRICES[tier]}/mo</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Quick Actions
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to={`/shop/${selectedShop.slug}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-all"
                >
                  <Eye className="w-4 h-4" />
                  View Page
                </Link>
                <Link
                  to={`/shop/${selectedShop.slug}/dashboard`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-medium text-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Dashboard
                </Link>
              </div>

              <button
                onClick={() => toggleShopDisabled(selectedShop.id, selectedShop.disabled)}
                disabled={actionLoading === selectedShop.id}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  selectedShop.disabled
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                {selectedShop.disabled ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Enable Shop
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Disable Shop
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
