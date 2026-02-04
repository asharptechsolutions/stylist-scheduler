import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, query, where, getDocs, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Calendar as CalendarIcon, Clock, Lock, CheckCircle, ArrowLeft, DollarSign, Tag } from 'lucide-react'
import Calendar from './Calendar'

function BookingPage() {
  const { slug } = useParams()
  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [shopLoading, setShopLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
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

    return () => {
      unsubServices()
      unsubAvailability()
      unsubBookings()
    }
  }, [shopId])

  // Determine if shop has services
  const hasServices = services.length > 0

  // Filter slots that can accommodate the selected service duration
  const getCompatibleSlots = () => {
    if (!selectedService) return availability.filter((s) => s.available)

    const serviceDuration = selectedService.duration

    return availability.filter((slot) => {
      if (!slot.available) return false
      // Slot must be at least as long as the service duration
      return slot.duration >= serviceDuration
    })
  }

  const compatibleSlots = getCompatibleSlots()

  const handleSelectService = (service) => {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
    setConfirmationMessage('')
  }

  const handleBackToServices = () => {
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setShowBookingForm(false)
  }

  const handleBookSlot = (slot) => {
    setSelectedSlot(slot)
    setShowBookingForm(true)
    setConfirmationMessage('')
  }

  const confirmBooking = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const bookingData = {
        slotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration: selectedService ? selectedService.duration : selectedSlot.duration,
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        bookedAt: new Date().toISOString(),
      }

      // Include service info if a service was selected
      if (selectedService) {
        bookingData.serviceId = selectedService.id
        bookingData.serviceName = selectedService.name
        bookingData.servicePrice = selectedService.price
        bookingData.serviceDuration = selectedService.duration
      }

      await addDoc(collection(db, 'shops', shopId, 'bookings'), bookingData)

      await updateDoc(doc(db, 'shops', shopId, 'availability', selectedSlot.id), {
        available: false
      })

      setClientInfo({ name: '', email: '', phone: '' })
      setShowBookingForm(false)
      setSelectedSlot(null)
      setSelectedService(null)
      setSelectedDate(null)
      setConfirmationMessage('✅ Booking confirmed! You will receive a confirmation email shortly.')
    } catch (err) {
      console.error('Booking error:', err)
      setConfirmationMessage('❌ Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`
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

  if (shopLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 text-lg">Loading…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Shop Not Found</h1>
          <p className="text-slate-600 mb-6">
            We couldn't find a shop with the URL "<span className="font-mono text-blue-600">{slug}</span>".
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all"
          >
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
  const getStep = () => {
    if (showBookingForm) return 'form'
    if (!hasServices || selectedService) return 'calendar'
    return 'services'
  }

  const step = getStep()

  return (
    <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            {shop.name}
          </h1>
          <p className="text-slate-600 text-base">
            {step === 'services' && 'Choose a service to get started'}
            {step === 'calendar' && 'Pick a date and time for your appointment'}
            {step === 'form' && 'Complete your booking details'}
          </p>
        </div>
        <Link
          to={`/shop/${slug}/login`}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
        >
          <Lock className="w-4 h-4" />
          Owner Login
        </Link>
      </div>

      {/* Step indicators when services exist */}
      {hasServices && (
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            step === 'services'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : selectedService
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">1</span>
            Service
          </div>
          <div className="w-6 h-px bg-slate-300" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            step === 'calendar'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : step === 'form'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">2</span>
            Date & Time
          </div>
          <div className="w-6 h-px bg-slate-300" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            step === 'form'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            <span className="w-6 h-6 rounded-full bg-current/10 flex items-center justify-center text-xs font-bold">3</span>
            Book
          </div>
        </div>
      )}

      {confirmationMessage && (
        <div className={`mb-6 p-5 rounded-xl flex items-center gap-3 ${
          confirmationMessage.startsWith('✅')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {confirmationMessage.startsWith('✅') && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
          <span className="font-medium">{confirmationMessage}</span>
        </div>
      )}

      {/* ─── Step 1: Service Selection ─── */}
      {step === 'services' && (
        <>
          <div className="border-b-2 border-slate-100 pb-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Our Services</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className="group text-left bg-white border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {service.name}
                  </h3>
                  <span className="text-2xl font-extrabold text-blue-600 whitespace-nowrap ml-3">
                    {formatPrice(service.price)}
                  </span>
                </div>
                {service.description && (
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-5">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(service.duration)}</span>
                </div>
                <div className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 group-hover:from-blue-600 group-hover:to-blue-700 text-white rounded-xl font-semibold text-sm text-center transition-all shadow-md shadow-blue-500/20 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  Select & Book →
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── Step 2: Calendar / Slot Selection ─── */}
      {step === 'calendar' && (
        <>
          {/* Back button + selected service summary */}
          {hasServices && selectedService && (
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleBackToServices}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Services
              </button>
              <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Tag className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-slate-800">{selectedService.name}</span>
                <span className="text-blue-600 font-bold">{formatPrice(selectedService.price)}</span>
                <span className="text-slate-400 text-sm">· {formatDuration(selectedService.duration)}</span>
              </div>
            </div>
          )}

          {availableDates.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                No available slots at the moment
              </h3>
              <p className="text-slate-600">
                {selectedService
                  ? `No time slots available for ${selectedService.name} (${formatDuration(selectedService.duration)}). Check back soon!`
                  : 'Check back soon for new availability!'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Select a Date</h2>
                <Calendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>

              {selectedDate && (
                <>
                  <div className="border-b-2 border-slate-100 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-slate-800">
                      Available Times for {formatDate(selectedDate)}
                      <span className="ml-2 text-slate-500 font-normal">({availableSlots.length} slots)</span>
                    </h2>
                  </div>
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-slate-600">No slots available for this date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {availableSlots
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => handleBookSlot(slot)}
                            className="group bg-white border-2 border-slate-200 hover:border-blue-500 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1"
                          >
                            <div className="flex items-baseline justify-center gap-2 mb-3">
                              <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                              <span className="text-2xl font-bold text-slate-900">
                                {formatTime(slot.time)}
                              </span>
                            </div>
                            <div className="text-sm text-slate-600 mb-4">
                              {selectedService
                                ? formatDuration(selectedService.duration)
                                : `${slot.duration} minutes`}
                            </div>
                            <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 group-hover:from-blue-600 group-hover:to-blue-700 text-white rounded-lg font-medium text-sm transition-all">
                              Book Now →
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}

              {!selectedDate && (
                <div className="text-center py-12 text-slate-600 text-base">
                  👆 Select a date from the calendar above to see available time slots
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─── Step 3: Booking Form ─── */}
      {step === 'form' && (
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Complete Your Booking</h2>

          {/* Appointment summary */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg mb-6">
            {selectedService && (
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-blue-200">
                <Tag className="w-5 h-5 text-blue-600" />
                <strong className="text-lg text-slate-900">{selectedService.name}</strong>
                <span className="text-blue-600 font-bold text-lg ml-auto">
                  {formatPrice(selectedService.price)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <strong className="text-lg text-slate-900">
                {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-slate-600 ml-8">
              <Clock className="w-4 h-4" />
              <span>
                {selectedService
                  ? formatDuration(selectedService.duration)
                  : `${selectedSlot.duration}min`}
              </span>
            </div>
          </div>

          <form onSubmit={confirmBooking} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={clientInfo.name}
                onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                required
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={clientInfo.email}
                onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                required
                placeholder="john@example.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={clientInfo.phone}
                onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                required
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Booking…' : 'Confirm Booking'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBookingForm(false)
                  setSelectedSlot(null)
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default BookingPage
