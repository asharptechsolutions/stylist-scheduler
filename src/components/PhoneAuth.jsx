import { useState, useEffect } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Phone, ArrowRight, Shield, Loader2, CheckCircle, RefreshCw } from 'lucide-react'

function PhoneAuth({ onVerified, onCancel, initialPhone = '', shopId = null }) {
  const [step, setStep] = useState('phone') // 'phone' | 'otp' | 'verified'
  const [phone, setPhone] = useState(initialPhone)
  const [countryCode, setCountryCode] = useState('+1')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [resendTimer, setResendTimer] = useState(0)

  // Format phone for display
  const formatPhoneDisplay = (value) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 3) return cleaned
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }

  // Clean phone for Firebase
  const getFullPhoneNumber = () => {
    const cleaned = phone.replace(/\D/g, '')
    return `${countryCode}${cleaned}`
  }

  // Setup reCAPTCHA
  useEffect(() => {
    if (step === 'phone' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.')
        }
      })
    }
    
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    }
  }, [step])

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const sendOtp = async () => {
    const fullPhone = getFullPhoneNumber()
    
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    setLoading(true)
    setError('')

    try {
      const confirmation = await signInWithPhoneNumber(
        auth,
        fullPhone,
        window.recaptchaVerifier
      )
      setConfirmationResult(confirmation)
      setStep('otp')
      setResendTimer(60)
    } catch (err) {
      console.error('Error sending OTP:', err)
      if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to send verification code. Please try again.')
      }
      // Reset reCAPTCHA on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await confirmationResult.confirm(otp)
      const user = result.user
      const fullPhone = getFullPhoneNumber()

      // Check if client profile exists, create if not
      const clientRef = doc(db, 'clients', user.uid)
      const clientDoc = await getDoc(clientRef)

      let clientData
      if (!clientDoc.exists()) {
        // Create new client profile
        clientData = {
          uid: user.uid,
          phone: fullPhone,
          phoneVerified: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        await setDoc(clientRef, clientData)
      } else {
        clientData = clientDoc.data()
        // Update last login
        await setDoc(clientRef, { 
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        }, { merge: true })
      }

      setStep('verified')
      
      // Callback with user and client data
      setTimeout(() => {
        onVerified({ user, client: { id: user.uid, ...clientData } })
      }, 1000)

    } catch (err) {
      console.error('Error verifying OTP:', err)
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid code. Please check and try again.')
      } else if (err.code === 'auth/code-expired') {
        setError('Code expired. Please request a new one.')
      } else {
        setError('Verification failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    if (resendTimer > 0) return
    
    // Reset reCAPTCHA
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear()
      window.recaptchaVerifier = null
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible'
    })
    
    await sendOtp()
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container"></div>

      {step === 'phone' && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Enter your phone number</h2>
            <p className="text-sm text-slate-500 mt-1">We'll send you a verification code</p>
          </div>

          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            >
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+91">🇮🇳 +91</option>
              <option value="+81">🇯🇵 +81</option>
              <option value="+49">🇩🇪 +49</option>
              <option value="+33">🇫🇷 +33</option>
              <option value="+52">🇲🇽 +52</option>
              <option value="+55">🇧🇷 +55</option>
            </select>
            <input
              type="tel"
              value={formatPhoneDisplay(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="(555) 123-4567"
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg tracking-wide"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={sendOtp}
            disabled={loading || phone.replace(/\D/g, '').length < 10}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full px-6 py-3 text-slate-600 hover:text-slate-900 font-medium transition-all"
            >
              Cancel
            </button>
          )}

          <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Your number is only used for verification
          </p>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Enter verification code</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sent to {countryCode} {formatPhoneDisplay(phone)}
            </p>
          </div>

          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl text-center tracking-[0.5em] font-mono"
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={verifyOtp}
            disabled={loading || otp.length !== 6}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Verify
              </>
            )}
          </button>

          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setStep('phone')
                setOtp('')
                setError('')
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Change number
            </button>
            <button
              onClick={resendOtp}
              disabled={resendTimer > 0}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {step === 'verified' && (
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Verified!</h2>
          <p className="text-sm text-slate-500 mt-1">Redirecting...</p>
        </div>
      )}
    </div>
  )
}

export default PhoneAuth
