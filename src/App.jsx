import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import BookingPage from './components/BookingPage'
import Login from './components/Login'

function App() {
  const [view, setView] = useState('booking') // 'booking' or 'dashboard'
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('stylist_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (password) => {
    // Simple password check - in production, use proper auth
    if (password === 'admin123') {
      localStorage.setItem('stylist_auth', 'true')
      setIsAuthenticated(true)
      setView('dashboard')
      return true
    }
    return false
  }

  const handleLogout = () => {
    localStorage.removeItem('stylist_auth')
    setIsAuthenticated(false)
    setView('booking')
  }

  return (
    <div>
      {view === 'booking' ? (
        <BookingPage onOwnerClick={() => setView('login')} />
      ) : view === 'login' ? (
        <Login 
          onLogin={handleLogin} 
          onBack={() => setView('booking')}
        />
      ) : (
        isAuthenticated && (
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
