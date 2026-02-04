import { useState, useEffect } from 'react'
import { Calendar, Clock, Mail, Phone, User, Trash2, LogOut, Eye, Plus } from 'lucide-react'

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
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    const generatedSlots = []
    let currentMinutes = startMinutes
    
    while (currentMinutes + duration <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60)
      const mins = currentMinutes % 60
      const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      
      generatedSlots.push({
        id: Date.now() + currentMinutes,
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
    
    setNewSlots({ date: '', startTime: '09:00', endTime: '17:00', slotDuration: '60' })
  }

  const removeSlot = (id) => {
    const updated = availability.filter(slot => slot.id !== id)
    setAvailability(updated)
    localStorage.setItem('availability', JSON.stringify(updated))
  }

  const cancelBooking = (bookingId) => {
    const updatedBookings = bookings.filter(b => b.id !== bookingId)
    setBookings(updatedBookings)
    localStorage.setItem('bookings', JSON.stringify(updatedBookings))
    
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

  const slotsByDate = availability.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  return (
    <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
      <div className="flex gap-3 mb-8">
        <button 
          onClick={onBackToBooking}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
        >
          <Eye className="w-4 h-4" />
          Booking Page
        </button>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-500/30"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <div className="border-b-2 border-slate-100 pb-4 mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">Dashboard</h1>
        <p className="text-slate-600">Manage your availability and view bookings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Create Time Slots</h2>
          <form onSubmit={generateTimeSlots} className="space-y-5">
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
            Select a date, set your working hours, and choose how long each appointment should be. We'll automatically create all the slots for that day.
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Current Bookings 
            <span className="ml-2 text-blue-600">({bookings.length})</span>
          </h2>
          {bookings.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-slate-600">No bookings yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {bookings.map(booking => (
                <div key={booking.id} className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <strong className="text-lg text-slate-900">{booking.clientName}</strong>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-600 mb-3">
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
          All Time Slots
          <span className="ml-2 text-slate-500 font-normal">({availability.length} total)</span>
        </h2>
      </div>
      
      {Object.keys(slotsByDate).length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-slate-800 font-medium mb-1">No time slots created yet</p>
          <p className="text-sm text-slate-600">Use the form above to generate your availability</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(slotsByDate).sort().map(date => (
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
                    <div className="text-sm text-slate-600 mb-3">
                      Duration: {slot.duration} min
                    </div>
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
    </div>
  )
}

export default Dashboard
