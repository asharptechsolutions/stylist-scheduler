import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Lock, ArrowLeft } from 'lucide-react'

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
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Owner Login</h1>
          <p className="text-slate-600">Enter your credentials to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
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
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
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
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
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

          <div className="flex gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
            <Link
              to={`/shop/${slug}`}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </form>

        <div className="mt-6 p-4 bg-slate-50 border-l-4 border-slate-300 rounded-lg">
          <p className="text-sm text-slate-600">
            🔒 <strong>Owner access only.</strong> If you need an account,{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              register here
            </Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
