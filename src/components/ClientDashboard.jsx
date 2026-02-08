import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { Calendar, Clock, MapPin, Phone, LogOut, User, CalendarCheck, ChevronRight, Star } from 'lucide-react'

function ClientDashboard({ user, client }) {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !client) {
      navigate('/client/login')
      return
    }

    fetchBookings()
  }, [user, client])

  const fetchBookings = async () => {
    setLoading(true)
    try {
      // Get all shops first
      const shopsSnapshot = await getDocs(collection(db, 'shops'))
      const allBookings = []

      // For each shop, query bookings by client phone
      for (const shopDoc of shopsSnapshot.docs) {
        const shopData = shopDoc.data()
        const bookingsRef = collection(db, 'shops', shopDoc.id, 'bookings')
        
        // Query by phone number
        const q = query(
          bookingsRef,
          where('clientPhone', '==', client.phone)
        )
        
        const bookingsSnapshot = await getDocs(q)
        bookingsSnapshot.docs.forEach(doc => {
          allBookings.push({
            id: doc.id,
            shopId: shopDoc.id,
            shopName: shopData.name,
            shopSlug: shopData.slug,
            ...doc.data()
          })
        })
      }

      // Sort by date descending
      allBookings.sort((a, b) => {
        const dateA = `${a.date}T${a.time}`
        const dateB = `${b.date}T${b.time}`
        return dateB.localeCompare(dateA)
      })

      setBookings(allBookings)
    } catch (err) {
      console.error('Error fetching bookings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/')
  }

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'pending':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmed'
      case 'pending': return 'Pending'
      case 'completed': return 'Completed'
      case 'in_progress': return 'In Progress'
      case 'cancelled': return 'Cancelled'
      case 'rejected': return 'Rejected'
      default: return 'Confirmed'
    }
  }

  // Separate upcoming and past bookings
  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => 
    b.date >= today && 
    !['cancelled', 'rejected', 'completed'].includes(b.status)
  )
  const pastBookings = bookings.filter(b => 
    b.date < today || 
    ['cancelled', 'rejected', 'completed'].includes(b.status)
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500">Loading your bookings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{client?.name || 'My Account'}</h1>
              <p className="text-xs text-slate-500">{client?.phone}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Upcoming Bookings */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Upcoming Appointments
          </h2>
          
          {upcomingBookings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No upcoming appointments</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
              >
                Book an Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={`${booking.shopId}-${booking.id}`}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{booking.serviceName || 'Appointment'}</h3>
                      <p className="text-sm text-slate-500">{booking.shopName}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${getStatusStyle(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {formatDate(booking.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {formatTime(booking.time)}
                    </span>
                  </div>
                  {booking.refCode && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <Link
                        to={`/shop/${booking.shopSlug}/booking/${booking.refCode}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        Manage Booking
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Past Appointments
            </h2>
            <div className="space-y-3">
              {pastBookings.slice(0, 10).map((booking) => (
                <div
                  key={`${booking.shopId}-${booking.id}`}
                  className="bg-white rounded-xl border border-slate-200 p-4 opacity-75"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-slate-700">{booking.serviceName || 'Appointment'}</h3>
                      <p className="text-sm text-slate-500">{booking.shopName}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${getStatusStyle(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>{formatDate(booking.date)}</span>
                    <span>{formatTime(booking.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* SpotBookie Branding */}
      <footer className="text-center py-6">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          Powered by <span className="font-semibold">SpotBookie</span>
        </Link>
      </footer>
    </div>
  )
}

export default ClientDashboard
