import { useState, useEffect } from 'react'

function Dashboard({ onLogout, onBackToBooking }) {
  const [availability, setAvailability] = useState([])
  const [bookings, setBookings] = useState([])
  const [newSlots, setNewSlots] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: '60'
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

  const generateTimeSlots = (e) => {
    e.preventDefault()
    
    const { date, startTime, endTime, slotDuration } = newSlots
    const duration = parseInt(slotDuration)
    
    // Convert times to minutes
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    // Generate all slots
    const generatedSlots = []
    let currentMinutes = startMinutes
    
    while (currentMinutes + duration <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60)
      const mins = currentMinutes % 60
      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      
      generatedSlots.push({
        id: Date.now() + currentMinutes, // Unique ID
        date: date,
        time: timeString,
        duration: duration,
        available: true
      })
      
      currentMinutes += duration
    }
    
    const updated = [...availability, ...generatedSlots]
    setAvailability(updated)
    localStorage.setItem('availability', JSON.stringify(updated))
    
    // Reset form
    setNewSlots({ date: '', startTime: '09:00', endTime: '17:00', slotDuration: '60' })
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

  // Group slots by date for better visualization
  const slotsByDate = availability.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  return (
    <div className="container">
      <div className="nav">
        <button className="btn btn-secondary" onClick={onBackToBooking}>
          ← Booking Page
        </button>
        <button className="btn btn-danger" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="section-header">
        <h1>📅 Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px' }}>
          Manage your availability and view bookings
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }}>
        <div>
          <h2>Create Time Slots</h2>
          <form onSubmit={generateTimeSlots}>
            <div className="form-group">
              <label>Select Date</label>
              <input 
                type="date" 
                value={newSlots.date}
                onChange={(e) => setNewSlots({...newSlots, date: e.target.value})}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input 
                  type="time" 
                  value={newSlots.startTime}
                  onChange={(e) => setNewSlots({...newSlots, startTime: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>End Time</label>
                <input 
                  type="time" 
                  value={newSlots.endTime}
                  onChange={(e) => setNewSlots({...newSlots, endTime: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Time Slot Duration</label>
              <select 
                value={newSlots.slotDuration}
                onChange={(e) => setNewSlots({...newSlots, slotDuration: e.target.value})}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Generate Time Slots
            </button>
          </form>

          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            background: '#F0F9FF', 
            borderRadius: '10px',
            fontSize: '14px',
            color: '#475569'
          }}>
            <strong>💡 Tip:</strong> Select a date, set your working hours, and choose how long each appointment should be. We'll automatically create all the slots for that day.
          </div>
        </div>

        <div>
          <h2>Current Bookings ({bookings.length})</h2>
          {bookings.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <p>No bookings yet</p>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {bookings.map(booking => (
                <div key={booking.id} className="booking-info">
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '16px' }}>{booking.clientName}</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', lineHeight: '1.6' }}>
                    📧 {booking.clientEmail}<br />
                    📞 {booking.clientPhone}<br />
                    🕐 {formatDateTime(booking.date, booking.time)}
                  </div>
                  <button 
                    className="btn btn-danger"
                    style={{ fontSize: '14px', padding: '8px 16px' }}
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

      <div className="section-header">
        <h2>All Time Slots ({availability.length} total)</h2>
      </div>
      
      {Object.keys(slotsByDate).length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
          <p>No time slots created yet</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Use the form above to generate your availability</p>
        </div>
      ) : (
        <div>
          {Object.keys(slotsByDate).sort().map(date => (
            <div key={date} style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                color: '#334155', 
                fontSize: '18px', 
                fontWeight: '600',
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '2px solid #F1F5F9'
              }}>
                {new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="grid">
                {slotsByDate[date].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                  <div key={slot.id} className="card">
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '18px', color: '#0F172A' }}>
                        {slot.time}
                      </strong>
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                      Duration: {slot.duration} min
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '16px' }}>
                      {slot.available ? (
                        <span style={{ 
                          color: '#16A34A', 
                          background: '#F0FDF4', 
                          padding: '4px 12px', 
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}>
                          ✓ Available
                        </span>
                      ) : (
                        <span style={{ 
                          color: '#DC2626', 
                          background: '#FEF2F2', 
                          padding: '4px 12px', 
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}>
                          ● Booked
                        </span>
                      )}
                    </div>
                    {slot.available && (
                      <button 
                        className="btn btn-danger"
                        style={{ fontSize: '14px', padding: '8px 16px', width: '100%' }}
                        onClick={() => removeSlot(slot.id)}
                      >
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
  )
}

export default Dashboard
