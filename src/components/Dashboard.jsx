import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, query, where, getDocs, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { Calendar, Clock, Mail, Phone, User, Trash2, LogOut, Eye, Plus, Tag, DollarSign, Users, RefreshCw, Scissors, BarChart3, CalendarDays, TrendingUp, Lock, Check, XCircle, Settings } from 'lucide-react'
import DashboardCalendar from './DashboardCalendar'
import ServiceManager from './ServiceManager'
import StaffManager from './StaffManager'

const DAY_LABELS = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
]

function formatTimeShort(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function Dashboard({ user }) {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [shopLoading, setShopLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [staff, setStaff] = useState([])
  const [activeTab, setActiveTab] = useState('schedule')
  const [selectedDate, setSelectedDate] = useState(null)
  const [staffFilter, setStaffFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [newSlots, setNewSlots] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: '60',
    staffId: ''
  })

  // Check auth & ownership
  useEffect(() => {
    if (!user) {
      navigate(`/shop/${slug}/login`, { replace: true })
      return
    }

    const checkOwnership = async () => {
      setShopLoading(true)
      try {
        const q = query(collection(db, 'shops'), where('slug', '==', slug))
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          setUnauthorized(true)
          setShopLoading(false)
          return
        }

        const shopDoc = snapshot.docs[0]
        const shopData = shopDoc.data()

        if (shopData.ownerUid !== user.uid) {
          setUnauthorized(true)
          setShopLoading(false)
          return
        }

        setShop(shopData)
        setShopId(shopDoc.id)
      } catch (err) {
        console.error('Error checking ownership:', err)
        setUnauthorized(true)
      } finally {
        setShopLoading(false)
      }
    }

    checkOwnership()
  }, [user, slug, navigate])

  // Real-time listeners for shop subcollections
  useEffect(() => {
    if (!shopId) return

    const unsubAvailability = onSnapshot(
      collection(db, 'shops', shopId, 'availability'),
      (snapshot) => {
        const slots = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setAvailability(slots)
      }
    )

    const unsubBookings = onSnapshot(
      collection(db, 'shops', shopId, 'bookings'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setBookings(items)
      }
    )

    const unsubStaff = onSnapshot(
      collection(db, 'shops', shopId, 'staff'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setStaff(items)
      }
    )

    return () => {
      unsubAvailability()
      unsubBookings()
      unsubStaff()
    }
  }, [shopId])

  const handleLogout = async () => {
    await signOut(auth)
    navigate(`/shop/${slug}`, { replace: true })
  }

  const generateTimeSlots = async (e) => {
    e.preventDefault()
    
    const { date, startTime, endTime, slotDuration, staffId } = newSlots
    const duration = parseInt(slotDuration)
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    let currentMinutes = startMinutes
    
    while (currentMinutes + duration <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60)
      const mins = currentMinutes % 60
      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      
      const slotData = {
        date: date,
        time: timeString,
        duration: duration,
        available: true
      }

      if (staffId) {
        const selectedStaffMember = staff.find(s => s.id === staffId)
        slotData.staffId = staffId
        slotData.staffName = selectedStaffMember?.name || ''
      }

      await addDoc(collection(db, 'shops', shopId, 'availability'), slotData)
      
      currentMinutes += duration
    }
    
    setNewSlots({ date: '', startTime: '09:00', endTime: '17:00', slotDuration: '60', staffId: '' })
  }

  const removeSlot = async (id) => {
    await deleteDoc(doc(db, 'shops', shopId, 'availability', id))
  }

  const cancelBooking = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId)

    await updateDoc(doc(db, 'shops', shopId, 'bookings', bookingId), {
      status: 'cancelled'
    })

    if (booking && booking.slotId && !booking.slotId.startsWith('wh-')) {
      try {
        await updateDoc(doc(db, 'shops', shopId, 'availability', booking.slotId), {
          available: true
        })
      } catch (err) {
        console.warn('Could not re-open slot:', err)
      }
    }
  }

  const approveBooking = async (bookingId) => {
    await updateDoc(doc(db, 'shops', shopId, 'bookings', bookingId), {
      status: 'confirmed'
    })
  }

  const rejectBooking = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId)

    await updateDoc(doc(db, 'shops', shopId, 'bookings', bookingId), {
      status: 'rejected'
    })

    if (booking && booking.slotId && !booking.slotId.startsWith('wh-')) {
      try {
        await updateDoc(doc(db, 'shops', shopId, 'availability', booking.slotId), {
          available: true
        })
      } catch (err) {
        console.warn('Could not re-open slot:', err)
      }
    }
  }

  const toggleRequireApproval = async () => {
    const newValue = !shop?.requireApproval
    try {
      await updateDoc(doc(db, 'shops', shopId), { requireApproval: newValue })
      setShop((prev) => ({ ...prev, requireApproval: newValue }))
    } catch (err) {
      console.error('Error updating requireApproval:', err)
    }
  }

  const updateBufferMinutes = async (value) => {
    const minutes = parseInt(value)
    try {
      await updateDoc(doc(db, 'shops', shopId), { bufferMinutes: minutes })
      setShop((prev) => ({ ...prev, bufferMinutes: minutes }))
    } catch (err) {
      console.error('Error updating buffer minutes:', err)
    }
  }

  const formatDateTime = (date, time) => {
    return new Date(`${date}T${time}`).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Compute which days of the week have recurring availability
  const recurringDayFlags = useMemo(() => {
    const flags = {}
    const relevantStaff = staffFilter === 'all' ? staff : staff.filter((s) => s.id === staffFilter)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    for (const member of relevantStaff) {
      if (!member.weeklyHours) continue
      dayNames.forEach((name, index) => {
        if (member.weeklyHours[name]?.enabled) {
          flags[index] = true
        }
      })
    }

    return flags
  }, [staff, staffFilter])

  // Staff with weekly hours (for summary)
  const staffWithHours = useMemo(() => {
    const relevantStaff = staffFilter === 'all' ? staff : staff.filter((s) => s.id === staffFilter)
    return relevantStaff.filter((s) => {
      if (!s.weeklyHours) return false
      return DAY_LABELS.some((d) => s.weeklyHours[d.key]?.enabled)
    })
  }, [staff, staffFilter])

  // ── Stats ──
  const stats = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // This week: Mon–Sun
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`

    const todayBookings = bookings.filter(b => b.date === todayStr).length
    const weekBookings = bookings.filter(b => b.date >= weekStartStr && b.date <= weekEndStr).length
    const uniqueClients = new Set(bookings.map(b => b.clientEmail?.toLowerCase()).filter(Boolean)).size

    return { todayBookings, weekBookings, uniqueClients, totalBookings: bookings.length }
  }, [bookings])

  const pendingCount = useMemo(() => {
    return bookings.filter(b => b.status === 'pending').length
  }, [bookings])

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-slate-200 text-center max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unauthorized</h1>
          <p className="text-slate-600 mb-6">
            You don't have access to this dashboard.
          </p>
          <Link
            to={`/shop/${slug}/login`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
          >
            Login
          </Link>
        </div>
      </div>
    )
  }

  // Filter availability and bookings by staff filter
  const filteredAvailability = staffFilter === 'all'
    ? availability
    : availability.filter(s => s.staffId === staffFilter)

  const filteredBookingsList = staffFilter === 'all'
    ? bookings
    : bookings.filter(b => b.staffId === staffFilter)

  const slotsByDate = filteredAvailability.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  const bookingsByDate = filteredBookingsList.reduce((acc, booking) => {
    if (!acc[booking.date]) acc[booking.date] = []
    acc[booking.date].push(booking)
    return acc
  }, {})

  const filteredSlotDates = selectedDate
    ? Object.keys(slotsByDate).filter(d => d === selectedDate).sort()
    : Object.keys(slotsByDate).sort()

  const filteredBookings = selectedDate
    ? filteredBookingsList.filter(b => b.date === selectedDate)
    : filteredBookingsList

  const displayedBookings = statusFilter === 'all'
    ? filteredBookings
    : statusFilter === 'pending'
      ? filteredBookings.filter(b => b.status === 'pending')
      : statusFilter === 'confirmed'
        ? filteredBookings.filter(b => !b.status || b.status === 'confirmed')
        : filteredBookings.filter(b => b.status === 'cancelled' || b.status === 'rejected')

  const statusCounts = {
    all: filteredBookings.length,
    pending: filteredBookings.filter(b => b.status === 'pending').length,
    confirmed: filteredBookings.filter(b => !b.status || b.status === 'confirmed').length,
    cancelled: filteredBookings.filter(b => b.status === 'cancelled' || b.status === 'rejected').length,
  }

  const tabs = [
    { key: 'schedule', label: 'Schedule', icon: Calendar },
    { key: 'staff', label: 'Staff', icon: Users },
    { key: 'services', label: 'Services', icon: Tag },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Top Navigation ─── */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Left: Shop name */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
                {(shop.name || '')[0]?.toUpperCase() || 'S'}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 leading-tight">{shop.name}</h1>
                <p className="text-xs text-slate-500">Dashboard</p>
              </div>
            </div>

            {/* Center: Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
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
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.key === 'schedule' && pendingCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Link
                to={`/shop/${slug}`}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">View Page</span>
              </Link>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ─── Stats Cards ─── */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
            {[
              { label: "Today's Bookings", value: stats.todayBookings, icon: CalendarDays, color: 'bg-blue-100 text-blue-600' },
              { label: 'This Week', value: stats.weekBookings, icon: TrendingUp, color: 'bg-violet-100 text-violet-600' },
              { label: 'Total Bookings', value: stats.totalBookings, icon: BarChart3, color: 'bg-emerald-100 text-emerald-600' },
              { label: 'Unique Clients', value: stats.uniqueClients, icon: Users, color: 'bg-amber-100 text-amber-600' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">{stat.value}</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in">
            <StaffManager shopId={shopId} />
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 animate-fade-in">
            <ServiceManager shopId={shopId} />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Shop Settings</h2>
              <p className="text-sm text-slate-500 mb-6">Configure your booking preferences</p>

              <div className="space-y-4">
                {/* Require Approval Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="pr-4">
                    <h3 className="font-semibold text-slate-900 text-sm">Require Booking Approval</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review and approve bookings before they're confirmed
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleRequireApproval}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                      shop?.requireApproval ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        shop?.requireApproval ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {shop?.requireApproval && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                    <strong>📋 Approval mode is on.</strong> New bookings will appear as "Pending" until you approve or reject them.
                    Time slots are held while pending to prevent double-booking.
                  </div>
                )}

                {/* Buffer Time */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="pr-4">
                    <h3 className="font-semibold text-slate-900 text-sm">Buffer Time Between Bookings</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add a gap between consecutive appointments
                    </p>
                  </div>
                  <select
                    value={shop?.bufferMinutes || 0}
                    onChange={(e) => updateBufferMinutes(e.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium flex-shrink-0"
                  >
                    <option value="0">No buffer</option>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="animate-fade-in">
            {/* Settings Row */}
            {staff.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Filter by Staff
                  </label>
                  <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium"
                  >
                    <option value="all">All Staff</option>
                    {staff.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}{member.role ? ` — ${member.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Weekly Hours Summary */}
            {staffWithHours.length > 0 && (
              <div className="mb-6 bg-violet-50 border border-violet-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-violet-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recurring Weekly Hours</h3>
                </div>
                <div className="space-y-2.5">
                  {staffWithHours.map((member) => {
                    const enabledDays = DAY_LABELS.filter(
                      (d) => member.weeklyHours[d.key]?.enabled
                    )
                    return (
                      <div key={member.id} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {enabledDays.map((d) => {
                              const cfg = member.weeklyHours[d.key]
                              return (
                                <span
                                  key={d.key}
                                  className="inline-block px-2 py-0.5 bg-white text-violet-700 border border-violet-200 rounded text-xs font-medium"
                                >
                                  {d.short} {formatTimeShort(cfg.start)}–{formatTimeShort(cfg.end)}
                                  {cfg.break && (
                                    <span className="text-amber-600 ml-1">
                                      (break {formatTimeShort(cfg.break.start)}–{formatTimeShort(cfg.break.end)})
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-violet-500 mt-3">
                  Slots auto-generate on the booking page. Manage hours in the Staff tab.
                </p>
              </div>
            )}

            {/* Calendar Overview */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Overview</h2>
              <DashboardCalendar
                slotsByDate={slotsByDate}
                bookingsByDate={bookingsByDate}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                recurringDayFlags={recurringDayFlags}
              />
              {selectedDate && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    Showing: <strong className="text-slate-900">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </strong>
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all border border-slate-200"
                  >
                    Show All
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Create Slots Form */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  {staffWithHours.length > 0 ? 'Add Custom Slots' : 'Create Time Slots'}
                </h2>
                {staffWithHours.length > 0 && (
                  <p className="text-xs text-slate-500 mb-4">
                    Use this for one-off availability outside regular hours.
                  </p>
                )}
                {!staffWithHours.length && <div className="mb-4" />}

                <form onSubmit={generateTimeSlots} className="space-y-4">
                  {staff.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Staff Member
                      </label>
                      <select
                        value={newSlots.staffId}
                        onChange={(e) => setNewSlots({...newSlots, staffId: e.target.value})}
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      >
                        <option value="">Select a staff member</option>
                        {staff.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.name}{member.role ? ` — ${member.role}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newSlots.date}
                      onChange={(e) => setNewSlots({...newSlots, date: e.target.value})}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Start
                      </label>
                      <input
                        type="time"
                        value={newSlots.startTime}
                        onChange={(e) => setNewSlots({...newSlots, startTime: e.target.value})}
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        End
                      </label>
                      <input
                        type="time"
                        value={newSlots.endTime}
                        onChange={(e) => setNewSlots({...newSlots, endTime: e.target.value})}
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Slot Duration
                    </label>
                    <select
                      value={newSlots.slotDuration}
                      onChange={(e) => setNewSlots({...newSlots, slotDuration: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5"
                  >
                    <Plus className="w-4 h-4" />
                    Generate Slots
                  </button>
                </form>

                <div className="mt-4 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-700">💡 Tip:</strong>{' '}
                  {staffWithHours.length > 0
                    ? 'Weekly hours auto-generate slots. Use this for one-off slots outside regular hours.'
                    : staff.length > 0
                      ? 'Select a staff member, pick a date, and set working hours to create slots.'
                      : "Set your hours and slot duration. We'll create all the time slots for that day."}
                </div>
              </div>

              {/* Bookings List */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedDate ? 'Bookings' : 'All Bookings'}
                    </h2>
                    {statusCounts.pending > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
                        {statusCounts.pending} pending
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {displayedBookings.length}
                  </span>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 mb-4 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'pending', label: 'Pending' },
                    { key: 'confirmed', label: 'Confirmed' },
                    { key: 'cancelled', label: 'Cancelled' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                        statusFilter === tab.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                        statusFilter === tab.key
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {statusCounts[tab.key]}
                      </span>
                    </button>
                  ))}
                </div>

                {displayedBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <CalendarDays className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      {statusFilter !== 'all'
                        ? `No ${statusFilter} bookings`
                        : selectedDate
                          ? 'No bookings for this date'
                          : 'No bookings yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {displayedBookings
                      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
                      .map(booking => {
                        const status = booking.status || 'confirmed'
                        const statusStyles = {
                          pending: 'bg-amber-50 text-amber-700 border-amber-200',
                          confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          rejected: 'bg-red-50 text-red-700 border-red-200',
                          cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
                        }
                        const statusLabels = {
                          pending: 'Pending',
                          confirmed: 'Confirmed',
                          rejected: 'Rejected',
                          cancelled: 'Cancelled',
                        }
                        return (
                          <div key={booking.id} className="group border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 text-sm">{booking.clientName}</span>
                                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${statusStyles[status]}`}>
                                      {statusLabels[status]}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {formatDateTime(booking.date, booking.time)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => approveBooking(booking.id)}
                                      className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Approve booking"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => rejectBooking(booking.id)}
                                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      title="Reject booking"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {status === 'confirmed' && (
                                  <button
                                    onClick={() => cancelBooking(booking.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Cancel booking"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="ml-[46px] space-y-0.5 text-xs text-slate-500">
                              {booking.serviceName && (
                                <div className="flex items-center gap-1.5">
                                  <Tag className="w-3 h-3 text-blue-400" />
                                  <span className="font-medium text-slate-700">{booking.serviceName}</span>
                                  {booking.servicePrice != null && (
                                    <span className="text-blue-600 font-semibold">
                                      ${Number(booking.servicePrice).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {booking.staffName && (
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-3 h-3 text-violet-400" />
                                  <span className="text-violet-600">{booking.staffName}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {booking.clientEmail}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {booking.clientPhone}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Time Slots */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedDate ? 'Custom Time Slots' : 'All Custom Time Slots'}
                </h2>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {selectedDate
                    ? (slotsByDate[selectedDate] || []).length
                    : filteredAvailability.length
                  }
                </span>
              </div>
              {staffWithHours.length > 0 && (
                <p className="text-xs text-slate-500 mb-4">
                  Recurring slots from weekly hours auto-generate — not shown here.
                </p>
              )}
              {!staffWithHours.length && <div className="mb-4" />}

              {filteredSlotDates.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium mb-1">
                    {selectedDate ? 'No custom slots for this date' : 'No custom slots yet'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {staffWithHours.length > 0
                      ? 'Recurring hours handle most scheduling.'
                      : 'Use the form above to generate availability.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredSlotDates.map(date => (
                    <div key={date}>
                      <h3 className="text-sm font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {slotsByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                          <div key={slot.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center group hover:border-slate-300 transition-all">
                            <div className="text-sm font-bold text-slate-900 mb-0.5">{slot.time}</div>
                            <div className="text-xs text-slate-500 mb-1">{slot.duration} min</div>
                            {slot.staffName && (
                              <div className="text-xs text-violet-600 mb-1.5 flex items-center justify-center gap-1">
                                <Users className="w-3 h-3" />
                                {slot.staffName}
                              </div>
                            )}
                            <div className="mb-2">
                              {slot.available ? (
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium">
                                  Available
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-medium">
                                  Booked
                                </span>
                              )}
                            </div>
                            {slot.available && (
                              <button
                                onClick={() => removeSlot(slot.id)}
                                className="opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 w-full px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-all border border-red-200"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
