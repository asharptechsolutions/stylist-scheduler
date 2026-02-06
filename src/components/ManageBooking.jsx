import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  Calendar as CalendarIcon, Clock, CheckCircle, ArrowLeft, Tag, Users,
  Scissors, XCircle, CalendarCheck, RefreshCw, AlertTriangle, PartyPopper, Copy, ExternalLink, Repeat
} from 'lucide-react'
import Calendar from './Calendar'
import { generateAllSlots, filterBookedSlots, mergeSlots } from '../utils/slotGenerator'

/* ── Initials avatar ── */
function InitialsAvatar({ name, className = 'w-12 h-12', bgClass = 'bg-blue-100 text-blue-700' }) {
  const initials = (name || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`${className} ${bgClass} rounded-full flex items-center justify-center font-bold text-sm select-none flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

/* ── Logo ── */
function SpotBookieMark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
        <CalendarCheck className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-sm font-extrabold tracking-tight text-slate-900">
        Spot<span className="text-amber-500">Bookie</span>
      </span>
    </Link>
  )
}

function ManageBooking() {
  const { slug, refCode } = useParams()

  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [booking, setBooking] = useState(null)
  const [bookingId, setBookingId] = useState(null)
  const [bookingNotFound, setBookingNotFound] = useState(false)

  // All bookings + availability + staff for rescheduling
  const [allBookings, setAllBookings] = useState([])
  const [availability, setAvailability] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [services, setServices] = useState([])

  // UI state
  const [showReschedule, setShowReschedule] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelMode, setCancelMode] = useState(null) // 'single' | 'future'
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Look up shop
  useEffect(() => {
    const lookupShop = async () => {
      setLoading(true)
      try {
        const q = query(collection(db, 'shops'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          setNotFound(true)
        } else {
          const shopDoc = snapshot.docs[0]
          setShop(shopDoc.data())
          setShopId(shopDoc.id)
        }
      } catch (err) {
        console.error('Error looking up shop:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    lookupShop()
  }, [slug])

  // Look up booking by refCode
  useEffect(() => {
    if (!shopId) return

    const lookupBooking = async () => {
      try {
        const q = query(
          collection(db, 'shops', shopId, 'bookings'),
          where('refCode', '==', refCode.toUpperCase())
        )
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          setBookingNotFound(true)
        } else {
          const bookingDoc = snapshot.docs[0]
          setBooking(bookingDoc.data())
          setBookingId(bookingDoc.id)
        }
      } catch (err) {
        console.error('Error looking up booking:', err)
        setBookingNotFound(true)
      }
    }
    lookupBooking()
  }, [shopId, refCode])

  // Real-time listeners for rescheduling data
  useEffect(() => {
    if (!shopId || !booking) return

    const unsubBookings = onSnapshot(
      collection(db, 'shops', shopId, 'bookings'),
      (snapshot) => {
        setAllBookings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      }
    )

    const unsubAvailability = onSnapshot(
      collection(db, 'shops', shopId, 'availability'),
      (snapshot) => {
        const now = new Date()
        const slots = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((slot) => new Date(`${slot.date}T${slot.time}`) > now)
        setAvailability(slots)
      }
    )

    const unsubStaff = onSnapshot(
      collection(db, 'shops', shopId, 'staff'),
      (snapshot) => {
        setStaffMembers(
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((s) => s.active !== false)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        )
      }
    )

    const unsubServices = onSnapshot(
      collection(db, 'shops', shopId, 'services'),
      (snapshot) => {
        setServices(
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((s) => s.active !== false)
        )
      }
    )

    return () => {
      unsubBookings()
      unsubAvailability()
      unsubStaff()
      unsubServices()
    }
  }, [shopId, booking])

  // Buffer minutes from shop settings
  const bufferMinutes = shop?.bufferMinutes || 0

  // Resolve the service object for the booking
  const bookingService = useMemo(() => {
    if (!booking) return null
    if (booking.serviceId) {
      const found = services.find((s) => s.id === booking.serviceId)
      if (found) return found
    }
    // Fallback from booking data
    if (booking.serviceName) {
      return {
        id: booking.serviceId,
        name: booking.serviceName,
        price: booking.servicePrice,
        duration: booking.serviceDuration || booking.duration,
      }
    }
    return null
  }, [booking, services])

  // Compute compatible slots for rescheduling (same service + same staff)
  const compatibleSlots = useMemo(() => {
    if (!showReschedule || !booking) return []
    const now = new Date()
    const duration = bookingService?.duration || booking.duration || 60

    let manualSlots = availability.filter((s) => s.available)
    manualSlots = manualSlots.filter((slot) => slot.duration >= duration)

    // Filter by same staff if the booking had a specific staff
    if (booking.staffId) {
      manualSlots = manualSlots.filter(
        (slot) => slot.staffId === booking.staffId || !slot.staffId
      )
    }

    const relevantStaff = booking.staffId
      ? staffMembers.filter((s) => s.id === booking.staffId)
      : staffMembers

    const generatedSlots = generateAllSlots(
      relevantStaff,
      duration,
      bufferMinutes,
      4
    ).filter((slot) => new Date(`${slot.date}T${slot.time}`) > now)

    const merged = mergeSlots(generatedSlots, manualSlots)

    // Exclude current booking from conflict check so its slot is available
    const otherBookings = allBookings.filter((b) => b.id !== bookingId)
    return filterBookedSlots(merged, otherBookings, bufferMinutes)
  }, [showReschedule, booking, bookingId, availability, staffMembers, allBookings, bufferMinutes, bookingService])

  const availableDates = useMemo(
    () => [...new Set(compatibleSlots.map((s) => s.date))].sort(),
    [compatibleSlots]
  )

  const slotsForDate = useMemo(
    () => selectedDate ? compatibleSlots.filter((s) => s.date === selectedDate) : [],
    [selectedDate, compatibleSlots]
  )

  // ── Cancel (supports single or all-future for recurring series) ──
  const handleCancel = async (mode = 'single') => {
    setSubmitting(true)
    try {
      // Cancel this booking
      await updateDoc(doc(db, 'shops', shopId, 'bookings', bookingId), {
        status: 'cancelled',
      })

      // Re-open manual slot if applicable
      if (booking.slotId && !booking.slotId.startsWith('wh-') && !booking.slotId.startsWith('recurring-')) {
        try {
          await updateDoc(doc(db, 'shops', shopId, 'availability', booking.slotId), {
            available: true,
          })
        } catch (err) {
          console.warn('Could not re-open slot:', err)
        }
      }

      // If cancelling all future in a recurring series
      if (mode === 'future' && booking.recurringGroupId) {
        const futureBookings = allBookings.filter((b) =>
          b.recurringGroupId === booking.recurringGroupId &&
          b.id !== bookingId &&
          b.date >= booking.date &&
          (b.status === 'pending' || b.status === 'confirmed')
        )

        for (const fb of futureBookings) {
          await updateDoc(doc(db, 'shops', shopId, 'bookings', fb.id), {
            status: 'cancelled',
          })
          // Re-open manual slot if applicable
          if (fb.slotId && !fb.slotId.startsWith('wh-') && !fb.slotId.startsWith('recurring-')) {
            try {
              await updateDoc(doc(db, 'shops', shopId, 'availability', fb.slotId), {
                available: true,
              })
            } catch (err) {
              console.warn('Could not re-open slot:', err)
            }
          }
        }
      }

      setBooking((prev) => ({ ...prev, status: 'cancelled' }))
      setShowCancelConfirm(false)
      setCancelMode(null)
      setActionMessage('cancelled')
    } catch (err) {
      console.error('Cancel error:', err)
      setActionMessage('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reschedule ──
  const handleReschedule = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      const updates = {
        date: selectedSlot.date,
        time: selectedSlot.time,
        slotId: selectedSlot.id,
      }

      if (selectedSlot.staffId) {
        updates.staffId = selectedSlot.staffId
        updates.staffName = selectedSlot.staffName || ''
      }

      // If shop requires approval, reset to pending
      if (shop?.requireApproval) {
        updates.status = 'pending'
      }

      // Free old manual slot
      if (booking.slotId && !booking.slotId.startsWith('wh-')) {
        try {
          await updateDoc(doc(db, 'shops', shopId, 'availability', booking.slotId), {
            available: true,
          })
        } catch (err) {
          console.warn('Could not re-open old slot:', err)
        }
      }

      // Block new manual slot
      if (!selectedSlot.generated && selectedSlot.id) {
        try {
          await updateDoc(doc(db, 'shops', shopId, 'availability', selectedSlot.id), {
            available: false,
          })
        } catch (err) {
          console.warn('Could not block new slot:', err)
        }
      }

      await updateDoc(doc(db, 'shops', shopId, 'bookings', bookingId), updates)

      setBooking((prev) => ({ ...prev, ...updates }))
      setShowReschedule(false)
      setSelectedDate(null)
      setSelectedSlot(null)
      setActionMessage('rescheduled')
    } catch (err) {
      console.error('Reschedule error:', err)
      setActionMessage('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers ──
  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatDuration = (minutes) => {
    if (!minutes) return ''
    if (minutes < 60) return `${minutes} min`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hrs}h ${mins}m` : `${hrs} hour${hrs > 1 ? 's' : ''}`
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading…</span>
        </div>
      </div>
    )
  }

  // ── Shop not found ──
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-slate-200 text-center max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CalendarIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Shop Not Found</h1>
          <p className="text-slate-600 mb-6">
            We couldn't find a shop with the URL "<span className="font-mono text-blue-600">{slug}</span>".
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  // ── Booking not found ──
  if (bookingNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
                {(shop?.name || '')[0]?.toUpperCase() || 'S'}
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">{shop?.name}</h1>
                <p className="text-xs text-slate-500">Manage Booking</p>
              </div>
            </div>
            <SpotBookieMark />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8">
          <div className="bg-white rounded-2xl p-10 shadow-lg border border-slate-200 text-center max-w-md mx-auto animate-scale-in">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Not Found</h2>
            <p className="text-slate-600 mb-2">
              No booking found with reference code
            </p>
            <p className="font-mono text-lg font-bold text-blue-600 mb-6">{refCode.toUpperCase()}</p>
            <Link
              to={`/shop/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              <CalendarIcon className="w-4 h-4" />
              Book an Appointment
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading booking…</span>
        </div>
      </div>
    )
  }

  const status = booking.status || 'confirmed'
  const isActive = status === 'pending' || status === 'confirmed'
  const isCancelled = status === 'cancelled'
  const isRejected = status === 'rejected'

  const statusConfig = {
    pending: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  }

  const sc = statusConfig[status] || statusConfig.confirmed
  const StatusIcon = sc.icon

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      {/* ─── Header ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
              {(shop?.name || '')[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{shop?.name}</h1>
              <p className="text-xs text-slate-500">Manage Booking</p>
            </div>
          </div>
          <SpotBookieMark />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* ─── Action Messages ─── */}
        {actionMessage === 'rescheduled' && (
          <div className="mb-6 animate-scale-in">
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-100/50 p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PartyPopper className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Booking Rescheduled!</h3>
              <p className="text-slate-600 mb-4">
                {shop?.requireApproval
                  ? 'Your booking has been rescheduled and is pending approval.'
                  : 'Your booking has been successfully rescheduled.'}
              </p>
              <button
                onClick={() => setActionMessage('')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View updated details ↓
              </button>
            </div>
          </div>
        )}

        {actionMessage === 'cancelled' && (
          <div className="mb-6 animate-scale-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Booking Cancelled</h3>
              <p className="text-slate-600 mb-4">Your booking has been cancelled.</p>
              <Link
                to={`/shop/${slug}`}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <CalendarIcon className="w-4 h-4" />
                Book a new appointment
              </Link>
            </div>
          </div>
        )}

        {actionMessage === 'error' && (
          <div className="mb-6 animate-scale-in">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3 text-red-800 font-medium">
              <span>❌</span>
              <span>Something went wrong. Please try again.</span>
            </div>
          </div>
        )}

        {/* ─── Booking Details Card ─── */}
        {!showReschedule && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Your Booking</h2>
              <p className="text-slate-500 text-sm mt-1">
                Reference: <span className="font-mono font-bold text-blue-600">{(booking.refCode || refCode).toUpperCase()}</span>
              </p>
            </div>

            {/* Status banner */}
            {(isCancelled || isRejected) && (
              <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3 ${
                isCancelled ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'
              }`}>
                <StatusIcon className={`w-5 h-5 ${isCancelled ? 'text-slate-400' : 'text-red-500'}`} />
                <span className={`font-medium text-sm ${isCancelled ? 'text-slate-600' : 'text-red-700'}`}>
                  {isCancelled
                    ? 'This booking has been cancelled.'
                    : 'This booking has been rejected by the shop.'}
                </span>
              </div>
            )}

            {/* Recurring series indicator */}
            {booking.recurringGroupId && (
              <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5">
                <Repeat className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-blue-800">Part of a recurring series</span>
                  {booking.recurringInterval && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Repeats every {
                        booking.recurringInterval === 'weekly' ? 'week' :
                        booking.recurringInterval === 'biweekly' ? '2 weeks' :
                        booking.recurringInterval === 'fourweekly' ? '4 weeks' :
                        booking.recurringInterval === 'monthly' ? 'month' :
                        booking.recurringInterval
                      }
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Details card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 space-y-3">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border ${sc.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {sc.label}
                </span>
              </div>

              {/* Service */}
              {booking.serviceName && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Tag className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-800">{booking.serviceName}</span>
                  </div>
                  {booking.servicePrice != null && (
                    <span className="font-bold text-blue-600">{formatPrice(booking.servicePrice)}</span>
                  )}
                </div>
              )}

              {/* Staff */}
              {booking.staffName && (
                <div className="flex items-center gap-2.5">
                  <InitialsAvatar name={booking.staffName} className="w-8 h-8 text-xs" bgClass="bg-violet-100 text-violet-700" />
                  <span className="font-semibold text-slate-800">{booking.staffName}</span>
                </div>
              )}

              {/* Date & Time */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-slate-600" />
                </div>
                <span className="font-semibold text-slate-800">
                  {formatDate(booking.date)} at {formatTime(booking.time)}
                </span>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2.5 text-sm text-slate-500">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <span>{formatDuration(booking.serviceDuration || booking.duration)}</span>
              </div>
            </div>

            {/* ─── Action buttons ─── */}
            {isActive && !actionMessage && (
              <div className="space-y-3">
                {!showCancelConfirm ? (
                  <>
                    <button
                      onClick={() => {
                        setShowReschedule(true)
                        setActionMessage('')
                      }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reschedule Booking
                    </button>
                    <button
                      onClick={() => {
                        setShowCancelConfirm(true)
                        setCancelMode(null)
                      }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-red-50 text-red-600 rounded-xl font-semibold border border-red-200 hover:border-red-300 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Booking
                    </button>
                  </>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 animate-scale-in">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">Are you sure?</h4>
                        <p className="text-sm text-slate-600">This action cannot be undone.</p>
                      </div>
                    </div>

                    {/* Recurring series: choose cancel mode */}
                    {booking.recurringGroupId && !cancelMode && (
                      <div className="space-y-2 mb-4">
                        <button
                          onClick={() => setCancelMode('single')}
                          className="w-full flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-red-300 rounded-xl text-left transition-all"
                        >
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-semibold text-slate-900">Cancel this appointment only</span>
                            <p className="text-xs text-slate-500">Other appointments in the series remain active</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setCancelMode('future')}
                          className="w-full flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-red-300 rounded-xl text-left transition-all"
                        >
                          <Repeat className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <div>
                            <span className="text-sm font-semibold text-slate-900">Cancel all future appointments</span>
                            <p className="text-xs text-slate-500">Cancel this and all later appointments in the series</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="w-full px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm transition-all border border-slate-200"
                        >
                          Go Back
                        </button>
                      </div>
                    )}

                    {/* Confirm cancel (non-recurring, or after choosing mode) */}
                    {(!booking.recurringGroupId || cancelMode) && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleCancel(cancelMode || 'single')}
                          disabled={submitting}
                          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                        >
                          {submitting ? (
                            <div className="spinner-sm border-white/30 border-t-white" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {submitting
                            ? 'Cancelling…'
                            : cancelMode === 'future'
                              ? 'Cancel All Future'
                              : 'Yes, Cancel'}
                        </button>
                        <button
                          onClick={() => {
                            if (cancelMode) {
                              setCancelMode(null)
                            } else {
                              setShowCancelConfirm(false)
                            }
                          }}
                          disabled={submitting}
                          className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
                        >
                          Go Back
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Book again link for cancelled/rejected */}
            {(isCancelled || isRejected) && (
              <div className="text-center">
                <Link
                  to={`/shop/${slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Book Again
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ─── Reschedule Flow ─── */}
        {showReschedule && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <button
                onClick={() => {
                  setShowReschedule(false)
                  setSelectedDate(null)
                  setSelectedSlot(null)
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition-all border border-slate-200 text-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Booking
              </button>
              {booking.serviceName && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-slate-800">{booking.serviceName}</span>
                  {booking.servicePrice != null && (
                    <span className="text-blue-600 font-bold">{formatPrice(booking.servicePrice)}</span>
                  )}
                </div>
              )}
              {booking.staffName && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm">
                  <InitialsAvatar name={booking.staffName} className="w-5 h-5 text-[10px]" bgClass="bg-violet-200 text-violet-700" />
                  <span className="font-semibold text-slate-800">{booking.staffName}</span>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Choose a New Time</h2>
              <p className="text-slate-500 text-sm mt-1">Pick a new date and time for your appointment</p>
            </div>

            {availableDates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No available slots</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  No time slots are currently available. Check back soon!
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <Calendar
                    availableDates={availableDates}
                    selectedDate={selectedDate}
                    onSelectDate={(date) => {
                      setSelectedDate(date)
                      setSelectedSlot(null)
                    }}
                  />
                </div>

                {selectedDate && (
                  <div className="animate-slide-down">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-slate-900">
                        Times for {formatDate(selectedDate)}
                      </h2>
                      <span className="text-sm text-slate-500 font-medium">
                        {slotsForDate.length} slot{slotsForDate.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {slotsForDate.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <p className="text-slate-500">No slots available for this date</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
                        {slotsForDate
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map((slot) => {
                            const isSelected = selectedSlot?.id === slot.id
                            return (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlot(slot)}
                                className={`group border rounded-xl p-4 transition-all duration-200 text-center ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-0.5'
                                }`}
                              >
                                <div className={`text-lg font-bold mb-1 ${
                                  isSelected ? 'text-white' : 'text-slate-900 group-hover:text-blue-700'
                                } transition-colors`}>
                                  {formatTime(slot.time)}
                                </div>
                                {slot.staffName && (
                                  <div className={`text-xs mb-0.5 flex items-center justify-center gap-1 ${
                                    isSelected ? 'text-blue-100' : 'text-violet-600'
                                  }`}>
                                    <Users className="w-3 h-3" />
                                    {slot.staffName}
                                  </div>
                                )}
                                <div className={`text-xs ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                  {formatDuration(booking.serviceDuration || booking.duration)}
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    )}

                    {/* Confirm reschedule button */}
                    {selectedSlot && (
                      <div className="mt-6 animate-fade-in">
                        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-4">
                          <h4 className="font-bold text-slate-900 mb-2">New Appointment Time</h4>
                          <div className="flex items-center gap-2.5 text-sm">
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                            <span className="font-semibold text-slate-800">
                              {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleReschedule}
                            disabled={submitting}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? (
                              <>
                                <div className="spinner-sm border-white/30 border-t-white" />
                                Rescheduling…
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Confirm Reschedule
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedSlot(null)}
                            className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!selectedDate && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Select a date above to see available times
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 mt-auto">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-center">
          <span className="text-xs text-slate-400">
            Powered by{' '}
            <Link to="/" className="font-semibold text-slate-500 hover:text-blue-600 transition-colors">
              SpotBookie
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

export default ManageBooking
