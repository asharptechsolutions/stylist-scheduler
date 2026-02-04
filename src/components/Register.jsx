import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { UserPlus, ArrowLeft } from 'lucide-react'

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function Register() {
  const navigate = useNavigate()
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const slug = generateSlug(shopName)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!slug) {
      setError('Please enter a valid shop name')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Check slug uniqueness
      const slugQuery = query(collection(db, 'shops'), where('slug', '==', slug))
      const slugSnapshot = await getDocs(slugQuery)

      if (!slugSnapshot.empty) {
        setError('A shop with that name already exists. Please choose a different name.')
        setLoading(false)
        return
      }

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Create shop document
      await addDoc(collection(db, 'shops'), {
        name: shopName.trim(),
        slug,
        ownerUid: user.uid,
        ownerEmail: email,
        createdAt: serverTimestamp()
      })

      // Redirect to dashboard
      navigate(`/shop/${slug}/dashboard`)
    } catch (err) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('An account with this email already exists')
          break
        case 'auth/invalid-email':
          setError('Please enter a valid email address')
          break
        case 'auth/weak-password':
          setError('Password must be at least 6 characters')
          break
        default:
          setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Your Shop</h1>
          <p className="text-slate-600">Set up your booking page in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Shop Name
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value)
                setError('')
              }}
              placeholder="Jane's Salon"
              required
              autoFocus
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {slug && (
              <p className="mt-2 text-sm text-slate-500">
                Your booking page: <span className="font-mono text-blue-600">…/shop/{slug}</span>
              </p>
            )}
          </div>

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
              placeholder="At least 6 characters"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating your shop…' : 'Create Shop'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register
