import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Dashboard from './components/Dashboard'
import BookingPage from './components/BookingPage'
import Login from './components/Login'

function App() {
  const [view, setView] = useState('booking') // 'booking' | 'login' | 'dashboard'
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
      if (firebaseUser) {
        setView('dashboard')
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLoginSuccess = () => {
    // Auth state listener above will pick up the signed-in user
    setView('dashboard')
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
    setView('booking')
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500 text-lg">Loading…</div>
      </div>
    )
  }

  return (
    <div>
      {view === 'booking' ? (
        <BookingPage onOwnerClick={() => setView('login')} />
      ) : view === 'login' ? (
        <Login 
          onLoginSuccess={handleLoginSuccess} 
          onBack={() => setView('booking')}
        />
      ) : (
        user && (
          <Dashboard 
            onLogout={handleLogout}
            onBackToBooking={() => setView('booking')}
          />
        )
      )}
    </div>
  )
}

export default App
