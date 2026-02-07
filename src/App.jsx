import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import LandingPage from './components/LandingPage'
import Register from './components/Register'
import SignIn from './components/SignIn'
import BookingPage from './components/BookingPage'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import ManageBooking from './components/ManageBooking'
import CheckWaitlist from './components/CheckWaitlist'
import QueueStatus from './components/QueueStatus'
import AdminPanel from './components/AdminPanel'

// Admin emails that can access the admin panel
const ADMIN_EMAILS = ['aaron.sharp2011@gmail.com']

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<SignIn user={user} />} />
        <Route path="/shop/:slug" element={<BookingPage />} />
        <Route path="/shop/:slug/booking/:refCode" element={<ManageBooking />} />
        <Route path="/shop/:slug/waitlist/:refCode" element={<CheckWaitlist />} />
        <Route path="/shop/:slug/queue" element={<QueueStatus />} />
        <Route path="/shop/:slug/login" element={<Login user={user} />} />
        <Route
          path="/shop/:slug/dashboard"
          element={<Dashboard user={user} />}
        />
        <Route
          path="/admin"
          element={
            user && ADMIN_EMAILS.includes(user.email?.toLowerCase())
              ? <AdminPanel user={user} />
              : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
