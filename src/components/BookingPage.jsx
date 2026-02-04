import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Calendar as CalendarIcon, Clock, Lock, CheckCircle } from 'lucide-react'
import Calendar from './Calendar'

function BookingPage({ onOwnerClick }) {
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

  // Real-time listener for availability
  useEffect(() => {
    const unsubAvailability = onSnapshot(
      collection(db, 'availability'),
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
      collection(db, 'bookings'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setBookings(items)
      }
    )

    return () => {
      unsubAvailability()
      unsubBookings()
    }
  }, [])

  const handleBookSlot = (slot) => {
    setSelectedSlot(slot)
    setShowBookingForm(true)
    setConfirmationMessage('')
  }

  const confirmBooking = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Create the booking document
      await addDoc(collection(db, 'bookings'), {
        slotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration: selectedSlot.duration,
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        bookedAt: new Date().toISOString()
      })

      // Mark the slot as unavailable
      await updateDoc(doc(db, 'availability', selectedSlot.id), {
        available: false
      })

      setClientInfo({ name: '', email: '', phone: '' })
      setShowBookingForm(false)
      setSelectedSlot(null)
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

  const availableDates = [...new Set(
    availability
      .filter(slot => slot.available)
      .map(slot => slot.date)
  )].sort()

  const availableSlots = selectedDate
    ? availability.filter(slot => slot.available && slot.date === selectedDate)
    : availability.filter(slot => slot.available)

  return (
    <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            Book Your Appointment
          </h1>
          <p className="text-slate-600 text-base">
            Choose an available time slot
          </p>
        </div>
        <button 
          onClick={onOwnerClick}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
        >
          <Lock className="w-4 h-4" />
          Owner Login
        </button>
      </div>

      {/* Inline confirmation / error message */}
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

      {showBookingForm ? (
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Complete Your Booking</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg mb-6">
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <strong className="text-lg text-slate-900">
                {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)}
              </strong>
            </div>
            <div className="flex items-center gap-2 text-slate-600 ml-8">
              <Clock className="w-4 h-4" />
              <span>{selectedSlot.duration}min</span>
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
                onChange={(e) => setClientInfo({...clientInfo, name: e.target.value})}
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
                onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
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
                onChange={(e) => setClientInfo({...clientInfo, phone: e.target.value})}
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
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {availableDates.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                No available slots at the moment
              </h3>
              <p className="text-slate-600">Check back soon for new availability!</p>
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
                      {availableSlots.map(slot => (
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
                            {slot.duration} minutes
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
    </div>
  )
}

export default BookingPage
