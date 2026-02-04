import { useState, useEffect } from 'react'

function Dashboard({ onLogout, onBackToBooking }) {
  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [newSlot, setNewSlot] = useState({
    date: '',
    time: '',
    duration: '60'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    const storedAvailability = JSON.parse(localStorage.getItem('availability') || '[]')
    const storedBookings = JSON.parse(localStorage.getItem('bookings') || '[]')
    setAvailability(storedAvailability)
    setBookings(storedBookings)
  }

  const addTimeSlot = (e) => {
    e.preventDefault()
    const slot = {
      id: Date.now(),
      date: newSlot.date,
      time: newSlot.time,
      duration: parseInt(newSlot.duration),
      available: true
    }
    
    const updated = [...availability, slot]
    setAvailability(updated)
    localStorage.setItem('availability', JSON.stringify(updated))
    
    setNewSlot({ date: '', time: '', duration: '60' })
  }

  const removeSlot = (id) => {
    const updated = availability.filter(slot => slot.id !== id)
    setAvailability(updated)
    localStorage.setItem('availability', JSON.stringify(updated))
  }

  const cancelBooking = (bookingId) => {
    // Remove booking
    const updatedBookings = bookings.filter(b => b.id !== bookingId)
    setBookings(updatedBookings)
    localStorage.setItem('bookings', JSON.stringify(updatedBookings))
    
    // Re-open the slot
    const booking = bookings.find(b => b.id === bookingId)
    if (booking) {
      const updatedAvailability = availability.map(slot => 
        slot.id === booking.slotId ? { ...slot, available: true } : slot
      )
      setAvailability(updatedAvailability)
      localStorage.setItem('availability', JSON.stringify(updatedAvailability))
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

  return (
    <div className="container">
      <div className="nav">
        <button className="btn btn-secondary" onClick={onBackToBooking}>
          View Booking Page
        </button>
        <button className="btn btn-danger" onClick={onLogout}>
          Logout
        </button>
      </div>

      <h1>📅 Owner Dashboard</h1>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>Manage your availability and bookings</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
        <div>
          <h2>Add Available Time Slot</h2>
          <form onSubmit={addTimeSlot}>
            <div className="form-group">
              <label>Date</label>
              <input 
                type="date" 
                value={newSlot.date}
                onChange={(e) => setNewSlot({...newSlot, date: e.target.value})}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="form-group">
              <label>Time</label>
              <input 
                type="time" 
                value={newSlot.time}
                onChange={(e) => setNewSlot({...newSlot, time: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Duration (minutes)</label>
              <select 
                value={newSlot.duration}
                onChange={(e) => setNewSlot({...newSlot, duration: e.target.value})}
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            
            <button type="submit" className="btn btn-primary">Add Time Slot</button>
          </form>
        </div>

        <div>
          <h2>Current Bookings ({bookings.length})</h2>
          {bookings.length === 0 ? (
            <div className="empty-state">No bookings yet</div>
          ) : (
            <div>
              {bookings.map(booking => (
                <div key={booking.id} className="booking-info">
                  <div style={{ marginBottom: '8px' }}>
                    <strong>{booking.clientName}</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    📧 {booking.clientEmail}<br />
                    📞 {booking.clientPhone}<br />
                    🕐 {formatDateTime(booking.date, booking.time)}
                  </div>
                  <button 
                    className="btn btn-danger"
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                    onClick={() => cancelBooking(booking.id)}
                  >
                    Cancel Booking
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2>All Time Slots ({availability.length})</h2>
      <div className="grid">
        {availability.length === 0 ? (
          <div className="empty-state">No time slots created yet</div>
        ) : (
          availability.map(slot => (
            <div key={slot.id} className={`card ${slot.available ? 'available' : 'booked'}`}>
              <div style={{ marginBottom: '10px' }}>
                <strong>{formatDateTime(slot.date, slot.time)}</strong>
              </div>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>
                Duration: {slot.duration} min
              </div>
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                Status: {slot.available ? '✅ Available' : '🔴 Booked'}
              </div>
              {slot.available && (
                <button 
                  className="btn btn-danger"
                  style={{ fontSize: '14px', padding: '6px 12px', width: '100%' }}
                  onClick={() => removeSlot(slot.id)}
                >
                  Remove Slot
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Dashboard
