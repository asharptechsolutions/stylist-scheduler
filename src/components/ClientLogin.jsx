import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { CalendarCheck } from 'lucide-react'
import PhoneAuth from './PhoneAuth'

function ClientLogin({ onLogin }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.phoneNumber) {
        // User is signed in with phone, check for client profile
        const clientDoc = await getDoc(doc(db, 'clients', user.uid))
        if (clientDoc.exists()) {
          onLogin({ user, client: { id: user.uid, ...clientDoc.data() } })
          navigate('/client/dashboard')
        }
      }
      setChecking(false)
    })

    return () => unsubscribe()
  }, [navigate, onLogin])

  const handleVerified = ({ user, client }) => {
    onLogin({ user, client })
    navigate('/client/dashboard')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
            <CalendarCheck className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">
            Spot<span className="text-amber-500">Bookie</span>
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8">
            <PhoneAuth
              onVerified={handleVerified}
              onCancel={() => navigate('/')}
            />
          </div>
          
          <p className="text-center text-sm text-slate-500 mt-6">
            View and manage your appointments across all businesses
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-xs text-slate-400">
          By continuing, you agree to our{' '}
          <Link to="/terms.html" className="text-blue-600 hover:underline">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy-policy.html" className="text-blue-600 hover:underline">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  )
}

export default ClientLogin
