import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { 
  Shield, Store, Users, CreditCard, TrendingUp, Search, 
  ExternalLink, ChevronDown, ChevronUp, Check, X, AlertCircle,
  DollarSign, Calendar, Eye, Settings, LogOut
} from 'lucide-react'

const ADMIN_EMAILS = ['aaron.sharp2011@gmail.com']

const TIER_INFO = {
  free: { label: 'Free', color: 'slate', price: 0 },
  pro: { label: 'Pro', color: 'blue', price: 29 },
  unlimited: { label: 'Unlimited', color: 'violet', price: 79 },
}

function AdminPanel({ user }) {
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedShop, setExpandedShop] = useState(null)
  const [updating, setUpdating] = useState(null)

  // Check admin access
  const isAdmin = user && ADMIN_EMAILS.includes(user.email)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }

    // Listen to shops
    const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setShops(items)
      setLoading(false)
    })

    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(items)
    })

    return () => {
      unsubShops()
      unsubUsers()
    }
  }, [isAdmin, navigate])

  if (!isAdmin) {
    return null
  }

  // Calculate metrics
  const metrics = {
    totalShops: shops.length,
    byTier: {
      free: shops.filter(s => (s.subscriptionTier || 'free') === 'free').length,
      pro: shops.filter(s => s.subscriptionTier === 'pro').length,
      unlimited: shops.filter(s => s.subscriptionTier === 'unlimited').length,
    },
    stripeConnected: shops.filter(s => s.stripeAccountId && s.stripeConnectStatus === 'active').length,
    mrr: shops.reduce((sum, s) => {
      const tier = s.subscriptionTier || 'free'
      return sum + (TIER_INFO[tier]?.price || 0)
    }, 0),
    totalUsers: users.length,
  }

  // Filter shops
  const filteredShops = shops.filter(shop => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      shop.name?.toLowerCase().includes(q) ||
      shop.slug?.toLowerCase().includes(q) ||
      shop.ownerEmail?.toLowerCase().includes(q)
    )
  }).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))

  const updateShopTier = async (shopId, newTier) => {
    setUpdating(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        subscriptionTier: newTier,
        updatedAt: new Date(),
      })
    } catch (err) {
      console.error('Failed to update tier:', err)
    }
    setUpdating(null)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'shops', label: 'Shops', icon: Store },
    { id: 'users', label: 'Users', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">SpotBookie Admin</h1>
                <p className="text-xs text-slate-500">Platform Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">{user.email}</span>
              <button
                onClick={() => auth.signOut().then(() => navigate('/'))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Store className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-600">Total Shops</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{metrics.totalShops}</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-600">MRR</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">${metrics.mrr}</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-violet-100 rounded-lg">
                        <CreditCard className="w-5 h-5 text-violet-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-600">Stripe Connected</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{metrics.stripeConnected}</p>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Users className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-600">Total Users</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{metrics.totalUsers}</p>
                  </div>
                </div>

                {/* Tier Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Shops by Tier</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className="text-3xl font-bold text-slate-600">{metrics.byTier.free}</p>
                      <p className="text-sm text-slate-500 mt-1">Free</p>
                      <p className="text-xs text-slate-400">5% platform fee</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <p className="text-3xl font-bold text-blue-600">{metrics.byTier.pro}</p>
                      <p className="text-sm text-slate-500 mt-1">Pro</p>
                      <p className="text-xs text-slate-400">$29/mo</p>
                    </div>
                    <div className="text-center p-4 bg-violet-50 rounded-xl">
                      <p className="text-3xl font-bold text-violet-600">{metrics.byTier.unlimited}</p>
                      <p className="text-sm text-slate-500 mt-1">Unlimited</p>
                      <p className="text-xs text-slate-400">$79/mo</p>
                    </div>
                  </div>
                </div>

                {/* Recent Shops */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Shops</h3>
                  <div className="space-y-3">
                    {shops.slice(0, 5).map(shop => (
                      <div key={shop.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-slate-900">{shop.name || 'Unnamed'}</p>
                          <p className="text-sm text-slate-500">{shop.ownerEmail}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          shop.subscriptionTier === 'unlimited' ? 'bg-violet-100 text-violet-700' :
                          shop.subscriptionTier === 'pro' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {TIER_INFO[shop.subscriptionTier || 'free']?.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Shops Tab */}
            {activeTab === 'shops' && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search shops by name, slug, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Shops List */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <div className="col-span-4">Shop</div>
                    <div className="col-span-2">Tier</div>
                    <div className="col-span-2">Stripe</div>
                    <div className="col-span-2">Created</div>
                    <div className="col-span-2">Actions</div>
                  </div>

                  {filteredShops.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-500">
                      No shops found
                    </div>
                  ) : (
                    filteredShops.map(shop => (
                      <div key={shop.id} className="border-b border-slate-100 last:border-0">
                        <div 
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 cursor-pointer"
                          onClick={() => setExpandedShop(expandedShop === shop.id ? null : shop.id)}
                        >
                          <div className="sm:col-span-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex items-center justify-center text-white font-bold">
                              {(shop.name || 'S')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{shop.name || 'Unnamed'}</p>
                              <p className="text-xs text-slate-500 truncate">{shop.ownerEmail}</p>
                            </div>
                          </div>

                          <div className="sm:col-span-2 flex items-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              shop.subscriptionTier === 'unlimited' ? 'bg-violet-100 text-violet-700' :
                              shop.subscriptionTier === 'pro' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {TIER_INFO[shop.subscriptionTier || 'free']?.label}
                            </span>
                          </div>

                          <div className="sm:col-span-2 flex items-center">
                            {shop.stripeAccountId ? (
                              shop.stripeConnectStatus === 'active' ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Check className="w-3.5 h-3.5" /> Connected
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <AlertCircle className="w-3.5 h-3.5" /> Pending
                                </span>
                              )
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <X className="w-3.5 h-3.5" /> None
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-2 flex items-center text-sm text-slate-500">
                            {shop.createdAt?.toDate?.().toLocaleDateString() || '—'}
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-2">
                            <a
                              href={`#/shop/${shop.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View booking page"
                            >
                              <Eye className="w-4 h-4 text-blue-500" />
                            </a>
                            <a
                              href={`#/shop/${shop.slug}/dashboard`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 hover:bg-violet-50 rounded-lg transition-colors"
                              title="View dashboard"
                            >
                              <ExternalLink className="w-4 h-4 text-violet-500" />
                            </a>
                            {expandedShop === shop.id ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedShop === shop.id && (
                          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Shop ID</p>
                                <p className="text-sm font-mono text-slate-700">{shop.id}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Slug</p>
                                <p className="text-sm font-mono text-slate-700">{shop.slug}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Stripe Customer</p>
                                <p className="text-sm font-mono text-slate-700">{shop.stripeCustomerId || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Connect Account</p>
                                <p className="text-sm font-mono text-slate-700">{shop.stripeAccountId || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Subscription ID</p>
                                <p className="text-sm font-mono text-slate-700">{shop.stripeSubscriptionId || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Change Tier</p>
                                <div className="flex gap-2">
                                  {['free', 'pro', 'unlimited'].map(tier => (
                                    <button
                                      key={tier}
                                      onClick={() => updateShopTier(shop.id, tier)}
                                      disabled={updating === shop.id || (shop.subscriptionTier || 'free') === tier}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        (shop.subscriptionTier || 'free') === tier
                                          ? 'bg-slate-900 text-white'
                                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                                      } disabled:opacity-50`}
                                    >
                                      {updating === shop.id ? '...' : TIER_INFO[tier].label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <div className="col-span-5">User</div>
                  <div className="col-span-4">UID</div>
                  <div className="col-span-3">Created</div>
                </div>

                {users.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-500">
                    No users found
                  </div>
                ) : (
                  users.map(u => (
                    <div key={u.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-6 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <div className="sm:col-span-5">
                        <p className="font-semibold text-slate-900">{u.email || 'No email'}</p>
                        <p className="text-xs text-slate-500">{u.displayName || '—'}</p>
                      </div>
                      <div className="sm:col-span-4">
                        <p className="text-sm font-mono text-slate-500 truncate">{u.id}</p>
                      </div>
                      <div className="sm:col-span-3 text-sm text-slate-500">
                        {u.createdAt?.toDate?.().toLocaleDateString() || '—'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
