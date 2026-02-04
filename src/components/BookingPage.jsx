import { useState, useEffect } from 'react'

function BookingPage({ onOwnerClick }) {
  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    const storedAvailability = JSON.parse(localStorage.getItem('availability') || '[]')
    const storedBookings = JSON.parse(localStorage.getItem('bookings') || '[]')
    
    // Filter out past slots
    const now = new Date()
    const futureSlots = storedAvailability.filter(slot => {
      const slotDate = new Date(`${slot.date}T${slot.time}`)
      return slotDate > now
    })
    
    setAvailability(futureSlots)
    setBookings(storedBookings)
  }

  const handleBookSlot = (slot) => {
    setSelectedSlot(slot)
    setShowBookingForm(true)
  }

  const confirmBooking = (e) => {
    e.preventDefault()
    
    const booking = {
      id: Date.now(),
      slotId: selectedSlot.id,
      date: selectedSlot.date,
      time: selectedSlot.time,
      duration: selectedSlot.duration,
      clientName: clientInfo.name,
      clientEmail: clientInfo.email,
      clientPhone: clientInfo.phone,
      bookedAt: new Date().toISOString()
    }
    
    // Save booking
    const updatedBookings = [...bookings, booking]
    setBookings(updatedBookings)
    localStorage.setItem('bookings', JSON.stringify(updatedBookings))
    
    // Mark slot as unavailable
    const updatedAvailability = availability.map(slot =>
      slot.id === selectedSlot.id ? { ...slot, available: false } : slot
    )
    setAvailability(updatedAvailability)
    localStorage.setItem('availability', JSON.stringify(updatedAvailability))
    
    // Reset form
    setClientInfo({ name: '', email: '', phone: '' })
    setShowBookingForm(false)
    setSelectedSlot(null)
    
    alert('✅ Booking confirmed! You will receive a confirmation email shortly.')
  }

  const formatDateTime = (date, time) => {
    return new Date(`${date}T${time}`).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const availableSlots = availability.filter(slot => slot.available)

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1>💇‍♀️ Book Your Appointment</h1>
          <p style={{ color: '#64748b' }}>Choose an available time slot</p>
        </div>
        <button className="btn btn-secondary" onClick={onOwnerClick}>
          Owner Login
        </button>
      </div>

      {showBookingForm ? (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2>Complete Your Booking</h2>
          <div className="booking-info" style={{ marginBottom: '20px' }}>
            <strong>{formatDateTime(selectedSlot.date, selectedSlot.time)}</strong>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '5px' }}>
              Duration: {selectedSlot.duration} minutes
            </div>
          </div>

          <form onSubmit={confirmBooking}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text"
                value={clientInfo.name}
                onChange={(e) => setClientInfo({...clientInfo, name: e.target.value})}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input 
                type="email"
                value={clientInfo.email}
                onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                required
                placeholder="john@example.com"
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="tel"
                value={clientInfo.phone}
                onChange={(e) => setClientInfo({...clientInfo, phone: e.target.value})}
                required
                placeholder="(555) 123-4567"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                Confirm Booking
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowBookingForm(false)
                  setSelectedSlot(null)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {availableSlots.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>📅</div>
              <h3>No available slots at the moment</h3>
              <p>Check back soon for new availability!</p>
            </div>
          ) : (
            <>
              <h2>Available Time Slots ({availableSlots.length})</h2>
              <div className="grid">
                {availableSlots.map(slot => (
                  <div 
                    key={slot.id} 
                    className="card time-slot available"
                    onClick={() => handleBookSlot(slot)}
                  >
                    <div style={{ marginBottom: '10px' }}>
                      <strong>{formatDateTime(slot.date, slot.time)}</strong>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>
                      Duration: {slot.duration} minutes
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', fontSize: '14px' }}>
                      Book This Slot
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default BookingPage
