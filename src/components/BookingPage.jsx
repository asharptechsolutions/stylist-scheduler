import { useState, useEffect, useMemo, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, query, where, getDocs, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Calendar as CalendarIcon, Clock, Lock, CheckCircle, ArrowLeft, DollarSign, Tag, Users, Scissors, CalendarCheck, PartyPopper, ListPlus, Repeat, CreditCard, Archive, Image, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Calendar from './Calendar'
import WaitlistForm from './WaitlistForm'
import BookingAssistant from './BookingAssistant'
import PaymentForm from './PaymentForm'
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

/* ── Staff Portfolio Modal ── */
function StaffPortfolioModal({ member, onClose }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const portfolio = member.portfolio || []

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) {
          setLightboxIndex(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <InitialsAvatar
              name={member.name}
              className="w-14 h-14"
              bgClass="bg-violet-100 text-violet-700"
            />
            <div>
              <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
              {member.role && (
                <p className="text-sm text-violet-600 font-medium">{member.role}</p>
              )}
            </div>
          </div>
          {member.bio && (
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{member.bio}</p>
          )}
        </div>

        {/* Portfolio Grid */}
        <div className="p-6">
          {portfolio.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Image className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No portfolio photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {portfolio.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Portfolio'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {photo.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
                      <p className="text-xs text-white font-medium truncate">
                        {photo.caption}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && portfolio[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Previous */}
          {lightboxIndex > 0 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
              className="absolute left-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Next */}
          {lightboxIndex < portfolio.length - 1 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
              className="absolute right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={portfolio[lightboxIndex].url}
              alt={portfolio[lightboxIndex].caption || 'Portfolio'}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            {portfolio[lightboxIndex].caption && (
              <p className="mt-3 text-sm text-white/90 font-medium text-center px-4">
                {portfolio[lightboxIndex].caption}
              </p>
            )}
            <p className="mt-1 text-xs text-white/50">
              {lightboxIndex + 1} / {portfolio.length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function BookingPage() {
  const { slug } = useParams()
  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [shopLoading, setShopLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [services, setServices] = useState([])
  const [staffMembers, setStaffMembers] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [lastRefCode, setLastRefCode] = useState('')
  const [showWaitlistForm, setShowWaitlistForm] = useState(false)
  const [portfolioModalMember, setPortfolioModalMember] = useState(null)

  // Recurring appointment state
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringInterval, setRecurringInterval] = useState('biweekly')
  const [recurringResult, setRecurringResult] = useState(null) // { created, skipped } after booking

  // Payment state
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState(null) // { paymentMethodId, last4, brand }

  // Look up shop by slug
  useEffect(() => {
    const lookupShop = async () => {
      setShopLoading(true)
      setNotFound(false)
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
        setShopLoading(false)
      }
    }
    lookupShop()
  }, [slug])

  // Real-time listeners
  useEffect(() => {
    if (!shopId) return

    const unsubServices = onSnapshot(
      collection(db, 'shops', shopId, 'services'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setServices(items)
      }
    )

    const unsubAvailability = onSnapshot(
      collection(db, 'shops', shopId, 'availability'),
      (snapshot) => {
        const now = new Date()
        const slots = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((slot) => {
            const slotDate = new Date(`${slot.date}T${slot.time}`)
            return slotDate > now
          })
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
        setStaffMembers(items)
      }
    )

    return () => {
      unsubServices()
      unsubAvailability()
      unsubBookings()
      unsubStaff()
    }
  }, [shopId])

  // Auto-select staff when only 1 exists
  useEffect(() => {
    if (staffMembers.length === 1) {
      setSelectedStaff(staffMembers[0])
    } else if (staffMembers.length === 0) {
      setSelectedStaff(null)
    }
  }, [staffMembers])

  // Determine flow flags
  const hasServices = services.length > 0
  const hasStaff = staffMembers.length > 0
  const showStaffStep = staffMembers.length > 1

  // Buffer minutes from shop settings
  const bufferMinutes = shop?.bufferMinutes || 0

  // Compute all compatible slots
  const compatibleSlots = useMemo(() => {
    const now = new Date()

    let manualSlots = availability.filter((s) => s.available)

    if (selectedService) {
      manualSlots = manualSlots.filter((slot) => slot.duration >= selectedService.duration)
    }

    if (selectedStaff && selectedStaff !== 'any') {
      manualSlots = manualSlots.filter(
        (slot) => slot.staffId === selectedStaff.id || !slot.staffId
      )
    }

    if (!selectedService) return manualSlots

    const relevantStaff =
      selectedStaff && selectedStaff !== 'any'
        ? staffMembers.filter((s) => s.id === selectedStaff.id)
        : staffMembers

    const generatedSlots = generateAllSlots(
      relevantStaff,
      selectedService.duration,
      bufferMinutes,
      4
    ).filter((slot) => new Date(`${slot.date}T${slot.time}`) > now)

    const merged = mergeSlots(generatedSlots, manualSlots)

    return filterBookedSlots(merged, bookings, bufferMinutes)
  }, [availability, selectedService, selectedStaff, staffMembers, bookings, bufferMinutes])

  // ── Recurring date generation helpers ──
  const generateRecurringDates = (startDate, interval, months = 3) => {
    const dates = []
    const start = new Date(startDate + 'T12:00:00')
    const end = new Date(start)
    end.setMonth(end.getMonth() + months)

    let current = new Date(start)
    // Skip the first date (it's the original booking)
    if (interval === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (interval === 'biweekly') {
      current.setDate(current.getDate() + 14)
    } else if (interval === 'fourweekly') {
      current.setDate(current.getDate() + 28)
    } else if (interval === 'monthly') {
      current.setMonth(current.getMonth() + 1)
    }

    while (current <= end) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)

      if (interval === 'weekly') {
        current.setDate(current.getDate() + 7)
      } else if (interval === 'biweekly') {
        current.setDate(current.getDate() + 14)
      } else if (interval === 'fourweekly') {
        current.setDate(current.getDate() + 28)
      } else if (interval === 'monthly') {
        current.setMonth(current.getMonth() + 1)
      }
    }
    return dates
  }

  // Preview of recurring bookings
  const recurringPreview = useMemo(() => {
    if (!recurringEnabled || !selectedSlot) return null

    const futureDates = generateRecurringDates(selectedSlot.date, recurringInterval)
    const duration = selectedService ? selectedService.duration : (selectedSlot.duration || 60)
    const staffId = (selectedStaff && selectedStaff !== 'any') ? selectedStaff.id : selectedSlot.staffId
    const time = selectedSlot.time

    // Check conflicts against existing bookings
    const activeBookings = bookings.filter(b => !b.status || b.status === 'pending' || b.status === 'confirmed')
    const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const slotStart = timeToMin(time)
    const slotEnd = slotStart + duration

    let available = []
    let conflicts = []

    // Track dates we've already "booked" in this batch to avoid self-conflicts
    const batchDates = new Set()

    futureDates.forEach((date) => {
      const hasConflict = activeBookings.some((booking) => {
        if (staffId && booking.staffId && booking.staffId !== staffId) return false
        if (booking.date !== date) return false
        const bStart = timeToMin(booking.time)
        const bDuration = booking.serviceDuration || booking.duration || duration
        const bEnd = bStart + bDuration
        const buffer = bufferMinutes || 0
        const noConflict = slotEnd + buffer <= bStart || bEnd + buffer <= slotStart
        return !noConflict
      })

      if (hasConflict || batchDates.has(date)) {
        conflicts.push(date)
      } else {
        available.push(date)
        batchDates.add(date)
      }
    })

    const endDate = futureDates.length > 0 ? futureDates[futureDates.length - 1] : selectedSlot.date
    const endDateFormatted = new Date(endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const intervalLabels = {
      weekly: 'week',
      biweekly: '2 weeks',
      fourweekly: '4 weeks',
      monthly: 'month',
    }

    return {
      available,
      conflicts,
      total: available.length + 1, // +1 for the original booking
      skipped: conflicts.length,
      endDate: endDateFormatted,
      intervalLabel: intervalLabels[recurringInterval] || recurringInterval,
    }
  }, [recurringEnabled, recurringInterval, selectedSlot, selectedService, selectedStaff, bookings, bufferMinutes])

  const handleSelectService = (service) => {
    setSelectedService(service)
    if (staffMembers.length > 1) {
      setSelectedStaff(null)
    }
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
    setConfirmationMessage('')
  }

  const handleSelectStaff = (staffMember) => {
    setSelectedStaff(staffMember)
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
    setConfirmationMessage('')
  }

  const handleBackToServices = () => {
    setSelectedService(null)
    if (staffMembers.length > 1) {
      setSelectedStaff(null)
    }
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
  }

  const handleBackToStaff = () => {
    setSelectedStaff(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
  }

  const handleBackFromCalendar = () => {
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
    if (showStaffStep) {
      setSelectedStaff(null)
    } else if (hasServices) {
      setSelectedService(null)
    }
  }

  const handleBookSlot = (slot) => {
    setSelectedSlot(slot)
    setShowBookingForm(true)
    setConfirmationMessage('')
  }

  const generateRefCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'BK'
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Handle form submission - either go to payment or confirm directly
  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (requiresDeposit) {
      setShowPaymentForm(true)
    } else {
      confirmBooking()
    }
  }

  // Handle payment success
  const handlePaymentSuccess = (payment) => {
    setPaymentInfo(payment)
    confirmBooking(payment)
  }

  const confirmBooking = async (payment = null) => {
    setSubmitting(true)
    setRecurringResult(null)

    try {
      const refCode = generateRefCode()
      const status = shop?.requireApproval ? 'pending' : 'confirmed'
      const recurringGroupId = recurringEnabled ? `rg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null
      const recurringUntilDate = recurringEnabled && recurringPreview
        ? recurringPreview.endDate
        : null

      const bookingData = {
        slotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration: selectedService ? selectedService.duration : selectedSlot.duration,
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        bookedAt: new Date().toISOString(),
        status,
        refCode,
      }

      if (selectedService) {
        bookingData.serviceId = selectedService.id
        bookingData.serviceName = selectedService.name
        bookingData.servicePrice = selectedService.price
        bookingData.serviceDuration = selectedService.duration
        bookingData.depositPercent = selectedService.depositPercent || 0
      }

      // Add payment info if deposit was collected
      if (payment || paymentInfo) {
        const pmt = payment || paymentInfo
        bookingData.depositPaid = true
        bookingData.depositAmount = depositAmount / 100 // convert cents to dollars
        bookingData.paymentMethodId = pmt.paymentMethodId
        bookingData.cardLast4 = pmt.last4
        bookingData.cardBrand = pmt.brand
      }

      if (selectedStaff && selectedStaff !== 'any') {
        bookingData.staffId = selectedStaff.id
        bookingData.staffName = selectedStaff.name
      } else if (selectedSlot.staffId) {
        bookingData.staffId = selectedSlot.staffId
        bookingData.staffName = selectedSlot.staffName || ''
      }

      // Add recurring fields
      if (recurringEnabled && recurringGroupId) {
        bookingData.recurring = true
        bookingData.recurringInterval = recurringInterval
        bookingData.recurringGroupId = recurringGroupId
        bookingData.recurringUntil = recurringUntilDate
      }

      // Create the primary booking
      await addDoc(collection(db, 'shops', shopId, 'bookings'), bookingData)

      if (!selectedSlot.generated) {
        await updateDoc(doc(db, 'shops', shopId, 'availability', selectedSlot.id), {
          available: false
        })
      }

      // Create recurring bookings
      let createdCount = 1
      let skippedCount = 0

      if (recurringEnabled && recurringPreview) {
        const availableDatesForRecurring = recurringPreview.available
        skippedCount = recurringPreview.skipped

        for (const date of availableDatesForRecurring) {
          const recurRefCode = generateRefCode()
          const recurBooking = {
            ...bookingData,
            date,
            slotId: `recurring-${recurringGroupId}-${date}`,
            refCode: recurRefCode,
            bookedAt: new Date().toISOString(),
          }
          await addDoc(collection(db, 'shops', shopId, 'bookings'), recurBooking)
          createdCount++
        }

        setRecurringResult({ created: createdCount, skipped: skippedCount })
      }

      setClientInfo({ name: '', email: '', phone: '' })
      setShowBookingForm(false)
      setShowPaymentForm(false)
      setPaymentInfo(null)
      setSelectedSlot(null)
      setSelectedService(null)
      setSelectedDate(null)
      setSelectedStaff(staffMembers.length === 1 ? staffMembers[0] : null)
      setRecurringEnabled(false)
      setLastRefCode(refCode)
      if (shop?.requireApproval) {
        setConfirmationMessage('⏳ Your booking request has been submitted! The shop will review and confirm it shortly.')
      } else {
        setConfirmationMessage('✅ Booking confirmed! You will receive a confirmation email shortly.')
      }
    } catch (err) {
      console.error('Booking error:', err)
      setConfirmationMessage('❌ Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
    if (minutes < 60) return `${minutes} min`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hrs}h ${mins}m` : `${hrs} hour${hrs > 1 ? 's' : ''}`
  }

  /* ── Loading state ── */
  if (shopLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading booking page…</span>
        </div>
      </div>
    )
  }

  /* ── Not found ── */
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

  /* ── Shop Archived ── */
  if (shop?.archived) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-amber-200 text-center max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Archive className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Shop Unavailable</h1>
          <p className="text-slate-600 mb-6">
            <span className="font-semibold">{shop.name}</span> is currently not accepting new bookings.
            Please check back later or contact the shop directly.
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

  const availableDates = [...new Set(
    compatibleSlots.map((slot) => slot.date)
  )].sort()

  const availableSlots = selectedDate
    ? compatibleSlots.filter((slot) => slot.date === selectedDate)
    : compatibleSlots

  // Determine current step
  // Check if payment is required
  const requiresDeposit = selectedService && selectedService.depositPercent > 0
  const depositAmount = requiresDeposit 
    ? Math.round(selectedService.price * (selectedService.depositPercent / 100) * 100) // in cents
    : 0

  const getStep = () => {
    if (showPaymentForm) return 'payment'
    if (showBookingForm) return 'form'
    if (hasServices && !selectedService) return 'services'
    if (showStaffStep && !selectedStaff) return 'staff'
    return 'calendar'
  }

  const step = getStep()

  // Build dynamic step indicators
  const steps = []
  if (hasServices) steps.push({ key: 'services', label: 'Service' })
  if (showStaffStep) steps.push({ key: 'staff', label: 'Stylist' })
  steps.push({ key: 'calendar', label: 'Date & Time' })
  steps.push({ key: 'form', label: 'Details' })
  if (requiresDeposit) steps.push({ key: 'payment', label: 'Payment' })

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  // Service color accents
  const serviceColors = [
    'border-l-blue-500', 'border-l-violet-500', 'border-l-emerald-500',
    'border-l-amber-500', 'border-l-rose-500', 'border-l-cyan-500',
    'border-l-indigo-500', 'border-l-pink-500', 'border-l-teal-500',
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      {/* ─── Top Header ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {shop.logoUrl ? (
              <img 
                src={shop.logoUrl} 
                alt={`${shop.name} logo`}
                className="w-10 h-10 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ backgroundColor: shop.brandColor || '#3B82F6' }}
              >
                {(shop.name || '')[0]?.toUpperCase() || 'S'}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{shop.name}</h1>
              <p className="text-xs text-slate-500">{shop.tagline || 'Book your appointment'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/shop/${slug}/login`}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Owner</span>
            </Link>
            <SpotBookieMark />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* ─── Step Indicator ─── */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center gap-0 mb-8 animate-fade-in">
            {steps.map((s, i) => {
              const isActive = s.key === step
              const isCompleted = i < currentStepIndex

              return (
                <Fragment key={s.key}>
                  {i > 0 && (
                    <div className={`w-8 sm:w-14 h-0.5 transition-colors duration-300 ${
                      i <= currentStepIndex ? 'bg-blue-500' : 'bg-slate-200'
                    }`} />
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-110'
                        : isCompleted
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block transition-colors ${
                      isActive ? 'text-blue-700' : isCompleted ? 'text-blue-600' : 'text-slate-400'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                </Fragment>
              )
            })}
          </div>
        )}

        {/* ─── Confirmation Card ─── */}
        {confirmationMessage && (
          <div className="mb-8 animate-scale-in">
            {confirmationMessage.startsWith('✅') ? (
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-100/50 p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h3>
                <p className="text-slate-600 mb-4">You're all set. We'll send a confirmation to your email.</p>
                {recurringResult && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-center gap-2 text-blue-700 font-semibold text-sm mb-1">
                      <Repeat className="w-4 h-4" />
                      Recurring Series Created
                    </div>
                    <p className="text-sm text-slate-700">
                      {recurringResult.created} appointment{recurringResult.created !== 1 ? 's' : ''} booked
                    </p>
                    {recurringResult.skipped > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠ {recurringResult.skipped} date{recurringResult.skipped !== 1 ? 's' : ''} skipped due to conflicts
                      </p>
                    )}
                  </div>
                )}
                {lastRefCode && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-1">Your reference</p>
                    <p className="text-2xl font-mono font-extrabold text-blue-600 tracking-wider">{lastRefCode}</p>
                  </div>
                )}
                {lastRefCode && (
                  <div className="mb-4">
                    <Link
                      to={`/shop/${slug}/booking/${lastRefCode}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-600/20 hover:shadow-lg"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      Manage Your Booking
                    </Link>
                    <p className="text-xs text-slate-400 mt-2">Save this link to reschedule or cancel your booking</p>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                  <CalendarCheck className="w-4 h-4" />
                  Add to your calendar to remember
                </div>
              </div>
            ) : confirmationMessage.startsWith('⏳') ? (
              <div className="bg-white rounded-2xl border border-amber-200 shadow-lg shadow-amber-100/50 p-8 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h3>
                <p className="text-slate-600 mb-4">Your booking request has been submitted! The shop will review and confirm it shortly.</p>
                {recurringResult && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-center gap-2 text-blue-700 font-semibold text-sm mb-1">
                      <Repeat className="w-4 h-4" />
                      Recurring Series Created
                    </div>
                    <p className="text-sm text-slate-700">
                      {recurringResult.created} appointment{recurringResult.created !== 1 ? 's' : ''} submitted
                    </p>
                    {recurringResult.skipped > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠ {recurringResult.skipped} date{recurringResult.skipped !== 1 ? 's' : ''} skipped due to conflicts
                      </p>
                    )}
                  </div>
                )}
                {lastRefCode && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-1">Your reference</p>
                    <p className="text-2xl font-mono font-extrabold text-blue-600 tracking-wider">{lastRefCode}</p>
                  </div>
                )}
                {lastRefCode && (
                  <div className="mb-4">
                    <Link
                      to={`/shop/${slug}/booking/${lastRefCode}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-600/20 hover:shadow-lg"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      Manage Your Booking
                    </Link>
                    <p className="text-xs text-slate-400 mt-2">Save this link to reschedule or cancel your booking</p>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 font-medium">
                  <Clock className="w-4 h-4" />
                  You'll be notified once it's confirmed
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3 text-red-800 font-medium">
                <span>❌</span>
                <span>Something went wrong. Please try again.</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Step: Service Selection ─── */}
        {step === 'services' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Choose a Service</h2>
              <p className="text-slate-500 text-sm mt-1">Select the service you'd like to book</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
              {services.map((service, idx) => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className={`group text-left bg-white border-l-4 ${serviceColors[idx % serviceColors.length]} border border-slate-200 hover:border-blue-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors pr-2">
                      {service.name}
                    </h3>
                    <span className="text-xl font-extrabold text-blue-600 whitespace-nowrap">
                      {formatPrice(service.price)}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDuration(service.duration)}</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                      Select →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step: Staff Selection ─── */}
        {step === 'staff' && (
          <div className="animate-fade-in">
            {/* Back & selection summary */}
            {hasServices && selectedService && (
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <button
                  onClick={handleBackToServices}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition-all border border-slate-200 text-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-slate-800">{selectedService.name}</span>
                  <span className="text-blue-600 font-bold">{formatPrice(selectedService.price)}</span>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Choose Your Stylist</h2>
              <p className="text-slate-500 text-sm mt-1">Select your preferred professional</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {/* "Any Available" card */}
              <button
                onClick={() => handleSelectStaff('any')}
                className="group text-left bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Any Available
                    </h3>
                    <p className="text-xs text-slate-500">First available professional</p>
                  </div>
                </div>
                <span className="block text-center text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  Select →
                </span>
              </button>

              {/* Staff member cards */}
              {staffMembers.map((member) => {
                const portfolio = member.portfolio || []
                return (
                  <div
                    key={member.id}
                    className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5"
                  >
                    <button
                      onClick={() => handleSelectStaff(member)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-3.5 mb-2">
                        <InitialsAvatar name={member.name} />
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {member.name}
                          </h3>
                          {member.role && (
                            <p className="text-xs text-slate-500">{member.role}</p>
                          )}
                        </div>
                      </div>
                      {member.bio && (
                        <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                          {member.bio}
                        </p>
                      )}
                      {/* Portfolio thumbnail previews */}
                      {portfolio.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {portfolio.slice(0, 3).map((photo, i) => (
                            <img
                              key={i}
                              src={photo.url}
                              alt={photo.caption || 'Work'}
                              className="w-10 h-10 rounded-md object-cover border border-slate-200"
                            />
                          ))}
                          {portfolio.length > 3 && (
                            <span className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-500 font-semibold">
                              +{portfolio.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="block text-center text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        Select →
                      </span>
                    </button>
                    {/* View Portfolio link */}
                    {portfolio.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setPortfolioModalMember(member)
                        }}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-all"
                      >
                        <Image className="w-3.5 h-3.5" />
                        View Portfolio ({portfolio.length})
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Step: Calendar / Slot Selection ─── */}
        {step === 'calendar' && (
          <div className="animate-fade-in">
            {/* Back & selection summary */}
            {(hasServices || showStaffStep) && (
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <button
                  onClick={handleBackFromCalendar}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-medium transition-all border border-slate-200 text-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                {selectedService && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <Tag className="w-3.5 h-3.5 text-blue-500" />
                    <span className="font-semibold text-slate-800">{selectedService.name}</span>
                    <span className="text-blue-600 font-bold">{formatPrice(selectedService.price)}</span>
                    <span className="text-slate-400">· {formatDuration(selectedService.duration)}</span>
                  </div>
                )}
                {selectedStaff && selectedStaff !== 'any' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm">
                    <InitialsAvatar name={selectedStaff.name} className="w-5 h-5 text-[10px]" bgClass="bg-violet-200 text-violet-700" />
                    <span className="font-semibold text-slate-800">{selectedStaff.name}</span>
                  </div>
                )}
                {selectedStaff === 'any' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-700">Any Available</span>
                  </div>
                )}
              </div>
            )}

            {availableDates.length === 0 ? (
              <div>
                {!showWaitlistForm ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      No available slots
                    </h3>
                    <p className="text-slate-600 max-w-md mx-auto mb-6">
                      {selectedService
                        ? `No time slots available for ${selectedService.name} (${formatDuration(selectedService.duration)}). Join the waitlist to be notified when a slot opens up!`
                        : 'Check back soon for new availability, or join the waitlist!'}
                    </p>
                    <button
                      onClick={() => setShowWaitlistForm(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 hover:-translate-y-0.5"
                    >
                      <ListPlus className="w-4 h-4" />
                      Join Waitlist
                    </button>
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto">
                    <WaitlistForm
                      shopId={shopId}
                      slug={slug}
                      selectedService={selectedService}
                      selectedStaff={selectedStaff}
                      staffMembers={staffMembers}
                      preferredDate={null}
                      onCancel={() => setShowWaitlistForm(false)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">Select a Date</h2>
                  <p className="text-slate-500 text-sm">Pick a day that works for you</p>
                </div>
                <div className="mb-8">
                  <Calendar
                    availableDates={availableDates}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                {selectedDate && (
                  <div className="animate-slide-down">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-slate-900">
                        Times for {formatDate(selectedDate)}
                      </h2>
                      <span className="text-sm text-slate-500 font-medium">
                        {availableSlots.length} slot{availableSlots.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {availableSlots.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <p className="text-slate-500 mb-4">No times available for this date</p>
                        {!showWaitlistForm ? (
                          <button
                            onClick={() => setShowWaitlistForm(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-600/20 hover:shadow-lg"
                          >
                            <ListPlus className="w-4 h-4" />
                            Join the Waitlist
                          </button>
                        ) : (
                          <div className="mt-4 text-left">
                            <WaitlistForm
                              shopId={shopId}
                              slug={slug}
                              selectedService={selectedService}
                              selectedStaff={selectedStaff}
                              staffMembers={staffMembers}
                              preferredDate={selectedDate}
                              onCancel={() => setShowWaitlistForm(false)}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
                        {availableSlots
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map((slot) => (
                            <button
                              key={slot.id}
                              onClick={() => handleBookSlot(slot)}
                              className="group bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-0.5 text-center"
                            >
                              <div className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors mb-1">
                                {formatTime(slot.time)}
                              </div>
                              {slot.staffName && selectedStaff === 'any' && (
                                <div className="text-xs text-violet-600 mb-0.5 flex items-center justify-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {slot.staffName}
                                </div>
                              )}
                              <div className="text-xs text-slate-400">
                                {selectedService
                                  ? formatDuration(selectedService.duration)
                                  : `${slot.duration} min`}
                              </div>
                            </button>
                          ))}
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

        {/* ─── Step: Booking Form ─── */}
        {step === 'form' && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Complete Your Booking</h2>
            <p className="text-slate-500 text-sm mb-6">Review your details and confirm</p>

            {/* Appointment summary card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 space-y-3">
              {selectedService && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Tag className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-slate-800">{selectedService.name}</span>
                  </div>
                  <span className="font-bold text-blue-600">{formatPrice(selectedService.price)}</span>
                </div>
              )}
              {selectedStaff && selectedStaff !== 'any' && (
                <div className="flex items-center gap-2.5">
                  <InitialsAvatar name={selectedStaff.name} className="w-8 h-8 text-xs" bgClass="bg-violet-100 text-violet-700" />
                  <div>
                    <span className="font-semibold text-slate-800">{selectedStaff.name}</span>
                    {selectedStaff.role && (
                      <span className="text-slate-400 text-sm ml-1.5">· {selectedStaff.role}</span>
                    )}
                  </div>
                </div>
              )}
              {selectedStaff === 'any' && selectedSlot?.staffName && (
                <div className="flex items-center gap-2.5">
                  <InitialsAvatar name={selectedSlot.staffName} className="w-8 h-8 text-xs" bgClass="bg-violet-100 text-violet-700" />
                  <span className="font-semibold text-slate-800">{selectedSlot.staffName}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-slate-600" />
                </div>
                <span className="font-semibold text-slate-800">
                  {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-500">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <span>
                  {selectedService
                    ? formatDuration(selectedService.duration)
                    : `${selectedSlot.duration} min`}
                </span>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                  required
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                  required
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              {/* ─── Recurring Appointment Toggle ─── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Repeat className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-800">Make this recurring</span>
                      <p className="text-xs text-slate-500">Book the same slot on a regular schedule</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecurringEnabled(!recurringEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                      recurringEnabled ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        recurringEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {recurringEnabled && (
                  <div className="space-y-3 pt-1 animate-fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Repeat every
                      </label>
                      <select
                        value={recurringInterval}
                        onChange={(e) => setRecurringInterval(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm font-medium"
                      >
                        <option value="weekly">Week</option>
                        <option value="biweekly">2 Weeks</option>
                        <option value="fourweekly">4 Weeks</option>
                        <option value="monthly">Month</option>
                      </select>
                    </div>

                    {recurringPreview && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 font-medium">
                          📅 Every {recurringPreview.intervalLabel} through {recurringPreview.endDate}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {recurringPreview.total} total appointment{recurringPreview.total !== 1 ? 's' : ''}
                        </p>
                        {recurringPreview.skipped > 0 && (
                          <p className="text-xs text-amber-600 mt-1 font-medium">
                            ⚠ {recurringPreview.skipped} date{recurringPreview.skipped !== 1 ? 's' : ''} will be skipped due to existing bookings
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deposit notice */}
              {requiresDeposit && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      ${(depositAmount / 100).toFixed(2)} deposit required
                    </p>
                    <p className="text-xs text-emerald-600">
                      {selectedService.depositPercent}% of service price · Remaining ${(selectedService.price - depositAmount / 100).toFixed(2)} due at appointment
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 ${
                    requiresDeposit 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 hover:shadow-emerald-600/25' 
                      : ''
                  } text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                  style={!requiresDeposit ? { backgroundColor: shop.brandColor || '#3B82F6' } : {}}
                >
                  {submitting ? (
                    <>
                      <div className="spinner-sm border-white/30 border-t-white" />
                      Booking…
                    </>
                  ) : requiresDeposit ? (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Continue to Payment
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Booking
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingForm(false)
                    setSelectedSlot(null)
                  }}
                  className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Step: Payment ─── */}
        {step === 'payment' && (
          <div className="max-w-lg mx-auto animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Secure Payment</h2>
            <p className="text-slate-500 text-sm mb-6">Complete your deposit to confirm your booking</p>

            {/* Appointment summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{selectedService?.name}</p>
                  <p className="text-sm text-slate-500">
                    {selectedSlot && formatDate(selectedSlot.date)} at {selectedSlot && formatTime(selectedSlot.time)}
                  </p>
                </div>
              </div>
              <div className="text-sm text-slate-600 pl-13">
                <p><strong>Client:</strong> {clientInfo.name}</p>
                <p><strong>Email:</strong> {clientInfo.email}</p>
              </div>
            </div>

            {/* Free tier without Stripe Connect - block booking entirely */}
            {!shop?.payoutsEnabled && (!shop?.subscriptionTier || shop?.subscriptionTier === 'free') && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-800 text-sm">Booking Unavailable</p>
                    <p className="text-xs text-red-700 mt-1">
                      This shop is still setting up their payment system and cannot accept bookings yet.
                      Please check back later or contact the shop directly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paid tier without Stripe Connect - allow booking without deposit */}
            {!shop?.payoutsEnabled && shop?.subscriptionTier && shop?.subscriptionTier !== 'free' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Payment Setup in Progress</p>
                    <p className="text-xs text-amber-700 mt-1">
                      This shop is still setting up their payment system. You can still book,
                      but payment will be collected at the time of your appointment.
                    </p>
                    <button
                      onClick={() => confirmBooking()}
                      disabled={submitting}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="spinner-sm border-white/30 border-t-white" />
                          Booking…
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Book Without Deposit
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {shop?.payoutsEnabled && (
              <PaymentForm
                amount={depositAmount}
                serviceName={selectedService?.name || 'Service'}
                clientInfo={clientInfo}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPaymentForm(false)}
                shopId={shopId}
                bookingRefCode={null}
                shopHasConnect={shop?.payoutsEnabled}
              />
            )}

            {!shop?.payoutsEnabled && (
              <button
                onClick={() => setShowPaymentForm(false)}
                className="w-full px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200 mt-4"
              >
                ← Back
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Portfolio Modal ─── */}
      {portfolioModalMember && (
        <StaffPortfolioModal
          member={portfolioModalMember}
          onClose={() => setPortfolioModalMember(null)}
        />
      )}

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

      {/* ─── Booking Assistant Chatbot ─── */}
      <BookingAssistant
        services={services}
        staffMembers={staffMembers}
        shop={shop}
        onSelectService={handleSelectService}
      />
    </div>
  )
}

export default BookingPage
