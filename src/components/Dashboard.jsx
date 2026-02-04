import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, query, where, getDocs, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { Calendar, Clock, Mail, Phone, User, Trash2, LogOut, Eye, Plus, Tag, DollarSign, Users, RefreshCw } from 'lucide-react'
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

    await deleteDoc(doc(db, 'shops', shopId, 'bookings', bookingId))

    if (booking) {
      try {
        await updateDoc(doc(db, 'shops', shopId, 'availability', booking.slotId), {
          available: true
        })
      } catch (err) {
        console.warn('Could not re-open slot:', err)
      }
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

  // Compute which days of the week have recurring availability (for calendar indicator)
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

  if (shopLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 text-lg">Loading…</div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Unauthorized</h1>
          <p className="text-slate-600 mb-6">
            You don't have access to this dashboard.
          </p>
          <Link
            to={`/shop/${slug}/login`}
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all"
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

  return (
    <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
      <div className="flex gap-3 mb-8">
        <Link
          to={`/shop/${slug}`}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
        >
          <Eye className="w-4 h-4" />
          Booking Page
        </Link>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-500/30"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <div className="border-b-2 border-slate-100 pb-4 mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">{shop.name}</h1>
        <p className="text-slate-600">Manage your availability and view bookings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'schedule'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'services'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tag className="w-4 h-4" />
          Services
        </button>
      </div>

      {/* Staff Tab */}
      {activeTab === 'staff' && <StaffManager shopId={shopId} />}

      {/* Services Tab */}
      {activeTab === 'services' && <ServiceManager shopId={shopId} />}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && <>

      {/* Settings Row: Staff Filter + Buffer Time */}
      <div className="flex flex-wrap gap-6 mb-6">
        {/* Staff Filter */}
        {staff.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Filter by Staff
            </label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium"
            >
              <option value="all">All Staff</option>
              {staff.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.role ? ` — ${member.role}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Buffer Time Setting */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Buffer Between Appointments
          </label>
          <select
            value={shop?.bufferMinutes || 0}
            onChange={(e) => updateBufferMinutes(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium"
          >
            <option value="0">No buffer</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>
      </div>

      {/* Weekly Hours Summary */}
      {staffWithHours.length > 0 && (
        <div className="mb-8 bg-purple-50 border border-purple-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-900">Recurring Weekly Hours</h3>
          </div>
          <div className="space-y-3">
            {staffWithHours.map((member) => {
              const enabledDays = DAY_LABELS.filter(
                (d) => member.weeklyHours[d.key]?.enabled
              )
              return (
                <div key={member.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {enabledDays.map((d) => {
                        const cfg = member.weeklyHours[d.key]
                        return (
                          <span
                            key={d.key}
                            className="inline-block px-2 py-0.5 bg-white text-purple-700 border border-purple-200 rounded text-xs font-medium"
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
          <p className="text-xs text-purple-500 mt-3">
            Slots are auto-generated from these hours on the booking page. Manage hours in the Staff tab.
          </p>
        </div>
      )}

      {/* Calendar Overview */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Monthly Overview</h2>
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
              className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all border border-slate-200"
            >
              Show All
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            {staffWithHours.length > 0 ? 'Add Custom Slots' : 'Create Time Slots'}
          </h2>
          {staffWithHours.length > 0 && (
            <p className="text-sm text-slate-500 mb-4">
              Recurring hours auto-generate slots. Use this form for one-off availability (e.g., a Saturday event).
            </p>
          )}
          <form onSubmit={generateTimeSlots} className="space-y-5">
            {/* Staff Member Selection */}
            {staff.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Staff Member
                </label>
                <select
                  value={newSlots.staffId}
                  onChange={(e) => setNewSlots({...newSlots, staffId: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Date
              </label>
              <input 
                type="date" 
                value={newSlots.date}
                onChange={(e) => setNewSlots({...newSlots, date: e.target.value})}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Time
                </label>
                <input 
                  type="time" 
                  value={newSlots.startTime}
                  onChange={(e) => setNewSlots({...newSlots, startTime: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  End Time
                </label>
                <input 
                  type="time" 
                  value={newSlots.endTime}
                  onChange={(e) => setNewSlots({...newSlots, endTime: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Time Slot Duration
              </label>
              <select 
                value={newSlots.slotDuration}
                onChange={(e) => setNewSlots({...newSlots, slotDuration: e.target.value})}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              Generate Time Slots
            </button>
          </form>

          <div className="mt-5 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg text-sm text-slate-700">
            <strong className="block text-slate-900 mb-1">💡 Tip:</strong>
            {staffWithHours.length > 0
              ? 'Weekly hours are set — slots auto-generate on the booking page. Use this form only for one-off slots outside regular hours.'
              : staff.length > 0
                ? 'Select a staff member, pick a date, set working hours, and choose slot duration. Slots will be created for that staff member.'
                : 'Select a date, set your working hours, and choose how long each appointment should be. We\'ll automatically create all the slots for that day.'}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            {selectedDate ? 'Bookings for Date' : 'Current Bookings'}
            <span className="ml-2 text-blue-600">({filteredBookings.length})</span>
          </h2>
          {filteredBookings.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-slate-600">{selectedDate ? 'No bookings for this date' : 'No bookings yet'}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredBookings.map(booking => (
                <div key={booking.id} className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <strong className="text-lg text-slate-900">{booking.clientName}</strong>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-600 mb-3">
                    {booking.serviceName && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-800">{booking.serviceName}</span>
                        {booking.servicePrice != null && (
                          <span className="text-blue-600 font-semibold">
                            ${Number(booking.servicePrice).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                    {booking.staffName && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-purple-700">{booking.staffName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {booking.clientEmail}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {booking.clientPhone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {formatDateTime(booking.date, booking.time)}
                    </div>
                  </div>
                  <button 
                    onClick={() => cancelBooking(booking.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Cancel Booking
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-b-2 border-slate-100 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          {selectedDate ? 'Custom Time Slots' : 'All Custom Time Slots'}
          <span className="ml-2 text-slate-500 font-normal">
            ({selectedDate
              ? (slotsByDate[selectedDate] || []).length
              : filteredAvailability.length
            } {selectedDate ? 'for date' : 'total'})
          </span>
        </h2>
        {staffWithHours.length > 0 && (
          <p className="text-sm text-slate-500 mt-1">
            Recurring slots from weekly hours are not shown here — they auto-generate on the booking page.
          </p>
        )}
      </div>
      
      {filteredSlotDates.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-slate-800 font-medium mb-1">
            {selectedDate ? 'No custom time slots for this date' : 'No custom time slots created yet'}
          </p>
          <p className="text-sm text-slate-600">
            {staffWithHours.length > 0
              ? 'Recurring hours handle most scheduling. Add custom slots for special availability.'
              : selectedDate
                ? 'Select another date or create slots'
                : 'Use the form above to generate your availability'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSlotDates.map(date => (
            <div key={date}>
              <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-100">
                {new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {slotsByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                  <div key={slot.id} className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <strong className="text-xl text-slate-900">{slot.time}</strong>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">
                      Duration: {slot.duration} min
                    </div>
                    {slot.staffName && (
                      <div className="text-sm text-purple-600 mb-2 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {slot.staffName}
                      </div>
                    )}
                    <div className="mb-3">
                      {slot.available ? (
                        <span className="inline-block px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-semibold">
                          ✓ Available
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-semibold">
                          ● Booked
                        </span>
                      )}
                    </div>
                    {slot.available && (
                      <button 
                        onClick={() => removeSlot(slot.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
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
      </>}
    </div>
  )
}

export default Dashboard
