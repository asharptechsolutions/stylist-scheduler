import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Lock, ArrowLeft, CalendarCheck } from 'lucide-react'

function Login({ user }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If already logged in, check ownership and redirect
  useEffect(() => {
    if (!user) return

    const checkOwnership = async () => {
      const q = query(collection(db, 'shops'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const shopData = snapshot.docs[0].data()
        if (shopData.ownerUid === user.uid) {
          navigate(`/shop/${slug}/dashboard`, { replace: true })
        }
      }
    }
    checkOwnership()
  }, [user, slug, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const signedInUser = userCredential.user

      // Verify user owns this shop
      const q = query(collection(db, 'shops'), where('slug', '==', slug))
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        setError('Shop not found')
        setLoading(false)
        return
      }

      const shopData = snapshot.docs[0].data()
      if (shopData.ownerUid !== signedInUser.uid) {
        setError('You are not the owner of this shop')
        await auth.signOut()
        setLoading(false)
        return
      }

      navigate(`/shop/${slug}/dashboard`, { replace: true })
    } catch (err) {
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          setError('Invalid email or password')
          break
        case 'auth/invalid-email':
          setError('Please enter a valid email address')
          break
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.')
          break
        default:
          setError('Login failed. Please try again.')
      }
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Spot<span className="text-amber-500">Bookie</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-200/50 border border-slate-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
            <p className="text-sm text-slate-500">Sign in to manage your shop</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="Enter password"
                required
                className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm ${
                  error
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-slate-200 focus:ring-blue-500 focus:border-transparent'
                }`}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm"
            >
              {loading ? (
                <>
                  <div className="spinner-sm border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            to={`/shop/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to booking page
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
