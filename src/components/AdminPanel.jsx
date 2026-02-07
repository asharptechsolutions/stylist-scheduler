import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { signOut, signInWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '../firebase'

const functions = getFunctions()
import {
  Shield, Store, CreditCard, DollarSign, Users, Search, ExternalLink,
  LogOut, Crown, Zap, Gift, TrendingUp, Calendar, Mail, Eye,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, Clock,
  BarChart3, PieChart, ArrowUpRight, Settings, Trash2, Ban, RefreshCw, X, Archive
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
  const [deleteConfirmShop, setDeleteConfirmShop] = useState(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [shopBookingCounts, setShopBookingCounts] = useState({})
  const [forceDelete, setForceDelete] = useState(false)
  const [deleteUserModal, setDeleteUserModal] = useState(null)
  const [deleteUserShops, setDeleteUserShops] = useState(true)
  const [deletingUser, setDeletingUser] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Check if user is admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase())

  useEffect(() => {
    if (!user || !isAdmin) {
      return
    }

    fetchData()
  }, [user, isAdmin])

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

  const toggleShopArchived = async (shopId, currentArchived) => {
    setActionLoading(shopId)
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        archived: !currentArchived,
        archivedAt: !currentArchived ? serverTimestamp() : null
      })
      setShops(prev => prev.map(s =>
        s.id === shopId ? { ...s, archived: !currentArchived, archivedAt: !currentArchived ? new Date().toISOString() : null } : s
      ))
      if (selectedShop?.id === shopId) {
        setSelectedShop(prev => ({ ...prev, archived: !currentArchived }))
      }
    } catch (err) {
      console.error('Error toggling shop archive status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const checkUpcomingBookings = async (shopId) => {
    try {
      const bookingsSnapshot = await getDocs(collection(db, 'shops', shopId, 'bookings'))
      const today = new Date().toISOString().split('T')[0]
      const upcomingBookings = bookingsSnapshot.docs.filter(doc => {
        const data = doc.data()
        return data.date >= today && 
          (data.status === 'pending' || data.status === 'confirmed' || !data.status)
      })
      setShopBookingCounts(prev => ({ ...prev, [shopId]: upcomingBookings.length }))
      return upcomingBookings.length
    } catch (err) {
      console.error('Error checking bookings:', err)
      return 0
    }
  }

  const deleteShopPermanently = async (shopId) => {
    setActionLoading(shopId)
    try {
      // Delete subcollections
      const subcollections = ['staff', 'bookings', 'availability', 'waitlist', 'schedulePresets', 'services', 'walkins', 'clientNotes']
      
      for (const subcol of subcollections) {
        const subSnapshot = await getDocs(collection(db, 'shops', shopId, subcol))
        for (const subDoc of subSnapshot.docs) {
          await deleteDoc(doc(db, 'shops', shopId, subcol, subDoc.id))
        }
      }
      
      // Delete the shop document
      await deleteDoc(doc(db, 'shops', shopId))
      
      // Update local state
      setShops(prev => prev.filter(s => s.id !== shopId))
      setSelectedShop(null)
      setDeleteConfirmShop(null)
      setDeleteConfirmName('')
      setForceDelete(false)
    } catch (err) {
      console.error('Error deleting shop:', err)
      alert('An error occurred while deleting the shop. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async (userId) => {
    setDeletingUser(true)
    try {
      const adminDeleteUser = httpsCallable(functions, 'adminDeleteUser')
      const result = await adminDeleteUser({
        userId,
        deleteShops: deleteUserShops
      })
      
      if (result.data.success) {
        // Update local state
        setUsers(prev => prev.filter(u => u.id !== userId))
        if (deleteUserShops && result.data.shopsDeleted > 0) {
          // Refresh shops list
          const shopsSnapshot = await getDocs(collection(db, 'shops'))
          setShops(shopsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })))
        }
        setDeleteUserModal(null)
        setDeleteUserShops(true)
        alert(`User deleted successfully. ${result.data.shopsDeleted} shop(s) deleted.`)
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      alert(err.message || 'Failed to delete user')
    } finally {
      setDeletingUser(false)
    }
  }

  // Get shops owned by a user
  const getUserShops = (userId) => {
    return shops.filter(s => s.ownerId === userId)
  }

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users
    const q = userSearchQuery.toLowerCase()
    return users.filter(u => 
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  }, [users, userSearchQuery])

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

  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoggingIn(true)
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword)
    } catch (err) {
      console.error('Login error:', err)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLoginError('Invalid email or password')
      } else if (err.code === 'auth/invalid-email') {
        setLoginError('Invalid email address')
      } else {
        setLoginError(err.message)
      }
    } finally {
      setLoggingIn(false)
    }
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-600/30 mx-auto mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin Access</h1>
            <p className="text-slate-500 text-sm">Sign in with your admin credentials</p>
          </div>
          
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
              />
            </div>
            
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {loginError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-violet-600/20"
            >
              {loggingIn ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Ban className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-2">You don't have permission to access the admin panel.</p>
          <p className="text-sm text-slate-400 mb-6">Signed in as: {user.email}</p>
          <div className="flex gap-3">
            <button
              onClick={() => signOut(auth)}
              className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all"
            >
              Sign Out
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
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
    { key: 'users', label: 'Users', icon: Users },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'support', label: 'Support', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-2">
            {/* Left: Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-md shadow-violet-600/20 flex-shrink-0">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">Admin</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Platform Management</p>
              </div>
            </div>

            {/* Center: Tabs (desktop only) */}
            <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl">
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
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={fetchData}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2">
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
                              {shop.archived && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  Archived
                                </span>
                              )}
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-500" />
                  All Users ({users.length})
                </h2>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by email, name, or ID..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              {/* Users List */}
              <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No users found</p>
                ) : (
                  filteredUsers.map(u => {
                    const userShops = getUserShops(u.id)
                    return (
                      <div key={u.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {(u.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{u.email || 'No email'}</div>
                              <div className="text-xs text-slate-500 font-mono truncate">{u.id}</div>
                              {userShops.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Store className="w-3 h-3 text-blue-500" />
                                  <span className="text-xs text-blue-600">{userShops.length} shop{userShops.length > 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteUserModal(u)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
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

              {/* Archive/Unarchive Button */}
              <button
                onClick={() => toggleShopArchived(selectedShop.id, selectedShop.archived)}
                disabled={actionLoading === selectedShop.id}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  selectedShop.archived
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                }`}
              >
                <Archive className="w-4 h-4" />
                {selectedShop.archived ? 'Unarchive Shop' : 'Archive Shop'}
              </button>

              {/* Danger Zone - Delete */}
              <div className="pt-4 mt-4 border-t border-red-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Danger Zone</span>
                </div>
                <button
                  onClick={async () => {
                    const count = await checkUpcomingBookings(selectedShop.id)
                    setDeleteConfirmShop(selectedShop)
                    setDeleteConfirmName('')
                    setForceDelete(false)
                  }}
                  disabled={actionLoading === selectedShop.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-red-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Shop Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmShop && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Shop Permanently</h3>
                <p className="text-sm text-slate-500">/{deleteConfirmShop.slug}</p>
              </div>
            </div>

            {/* Warning about upcoming bookings */}
            {shopBookingCounts[deleteConfirmShop.id] > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">
                    {shopBookingCounts[deleteConfirmShop.id]} Upcoming Booking{shopBookingCounts[deleteConfirmShop.id] !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  This shop has active bookings. Deleting it will cancel all bookings and notify no one.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-400 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-amber-800">
                    I understand and want to force delete anyway
                  </span>
                </label>
              </div>
            )}

            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 mb-2">
                <strong>This will permanently delete:</strong>
              </p>
              <ul className="text-sm text-red-600 space-y-1 ml-4 list-disc">
                <li>Shop and all settings</li>
                <li>All staff members</li>
                <li>All bookings (past and future)</li>
                <li>All time slots and schedule presets</li>
                <li>All waitlist entries</li>
                <li>All client notes</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type "<span className="text-red-600">{deleteConfirmShop.name}</span>" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Enter shop name"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmShop(null)
                  setDeleteConfirmName('')
                  setForceDelete(false)
                }}
                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteShopPermanently(deleteConfirmShop.id)}
                disabled={
                  deleteConfirmName !== deleteConfirmShop.name || 
                  actionLoading === deleteConfirmShop.id ||
                  (shopBookingCounts[deleteConfirmShop.id] > 0 && !forceDelete)
                }
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-red-600/20"
              >
                {actionLoading === deleteConfirmShop.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete User Account</h3>
                <p className="text-sm text-slate-500">{deleteUserModal.email}</p>
              </div>
            </div>

            {/* User's shops */}
            {getUserShops(deleteUserModal.id).length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">
                    {getUserShops(deleteUserModal.id).length} Shop{getUserShops(deleteUserModal.id).length !== 1 ? 's' : ''} Owned
                  </span>
                </div>
                <ul className="text-sm text-amber-700 mb-3 space-y-1">
                  {getUserShops(deleteUserModal.id).map(s => (
                    <li key={s.id}>• {s.name} (/{s.slug})</li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteUserShops}
                    onChange={(e) => setDeleteUserShops(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-400 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-amber-800">
                    Also delete all shops owned by this user
                  </span>
                </label>
              </div>
            )}

            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700 mb-2">
                <strong>This will permanently delete:</strong>
              </p>
              <ul className="text-sm text-red-600 space-y-1 ml-4 list-disc">
                <li>User's Firebase Auth account</li>
                <li>User document in database</li>
                {deleteUserShops && <li>All shops and their data (bookings, staff, etc.)</li>}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteUserModal(null)
                  setDeleteUserShops(true)
                }}
                disabled={deletingUser}
                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteUserModal.id)}
                disabled={deletingUser}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-red-600/20"
              >
                {deletingUser ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete User
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
