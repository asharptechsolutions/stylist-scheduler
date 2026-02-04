import { useState } from 'react'

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
    <div className="auth-form container">
      <h1 style={{ textAlign: 'center', marginBottom: '12px' }}>🔐 Owner Login</h1>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '32px', fontSize: '15px' }}>
        Enter your password to access the dashboard
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Password</label>
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
          />
          {error && (
            <div style={{ color: '#ef4444', fontSize: '14px', marginTop: '5px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" className="btn btn-primary">
            Login
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back to Booking
          </button>
        </div>
      </form>

      <div style={{ 
        marginTop: '32px', 
        padding: '16px', 
        background: '#F0F9FF', 
        borderRadius: '10px', 
        fontSize: '14px',
        color: '#475569'
      }}>
        <strong style={{ color: '#0F172A' }}>💡 Demo Password:</strong> admin123
      </div>
    </div>
  )
}

export default Login
