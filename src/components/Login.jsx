import { useState } from 'react'
import { Lock, ArrowLeft, Lightbulb } from 'lucide-react'

function Login({ onLogin, onBack }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const success = onLogin(password)
    if (!success) {
      setError('Invalid password')
      setPassword('')
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
          <p className="text-slate-600">Enter your password to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              autoFocus
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
            >
              Login
            </button>
            <button 
              type="button" 
              onClick={onBack}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="text-slate-900 block mb-1">Demo Password:</strong>
              <code className="px-2 py-1 bg-white border border-blue-200 rounded text-blue-600 font-mono">
                admin123
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
