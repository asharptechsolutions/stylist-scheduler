import { useState } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Clock, CheckCircle, ListPlus } from 'lucide-react'

const DAY_OPTIONS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const TIME_RANGES = [
  { key: 'morning', label: 'Morning (9AM–12PM)', start: '09:00', end: '12:00' },
  { key: 'afternoon', label: 'Afternoon (12PM–5PM)', start: '12:00', end: '17:00' },
  { key: 'evening', label: 'Evening (5PM–9PM)', start: '17:00', end: '21:00' },
  { key: 'any', label: 'Any time', start: '00:00', end: '23:59' },
]

function generateWaitlistRefCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'WL'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function WaitlistForm({
  shopId,
  slug,
  selectedService,
  selectedStaff,
  staffMembers,
  preferredDate,
  onSuccess,
  onCancel,
}) {
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' })
  const [preferredDays, setPreferredDays] = useState([])
  const [selectedTimeRange, setSelectedTimeRange] = useState('any')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [refCode, setRefCode] = useState('')

  const toggleDay = (day) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const code = generateWaitlistRefCode()
      const timeRange = TIME_RANGES.find((t) => t.key === selectedTimeRange)

      const staffId = selectedStaff && selectedStaff !== 'any' ? selectedStaff.id : 'any'
      const staffName =
        selectedStaff && selectedStaff !== 'any' ? selectedStaff.name : 'Any Available'

      const waitlistData = {
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        serviceId: selectedService?.id || null,
        serviceName: selectedService?.name || 'Any Service',
        staffId,
        staffName,
        preferredDate: preferredDate || null,
        preferredDays: preferredDays.length > 0 ? preferredDays : null,
        preferredTimeRange: timeRange
          ? { start: timeRange.start, end: timeRange.end }
          : null,
        status: 'waiting',
        refCode: code,
        createdAt: new Date().toISOString(),
        notifiedAt: null,
        notifiedSlot: null,
      }

      await addDoc(collection(db, 'shops', shopId, 'waitlist'), waitlistData)

      setRefCode(code)
      setSubmitted(true)
      if (onSuccess) onSuccess(code)
    } catch (err) {
      console.error('Waitlist error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-blue-200 shadow-lg shadow-blue-100/50 p-8 text-center animate-scale-in">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">You're on the Waitlist!</h3>
        <p className="text-slate-600 mb-4">
          We'll notify you when a slot opens up
          {selectedService ? ` for ${selectedService.name}` : ''}.
        </p>
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-1">Your waitlist reference</p>
          <p className="text-2xl font-mono font-extrabold text-blue-600 tracking-wider">
            {refCode}
          </p>
        </div>
        <a
          href={`#/shop/${slug}/waitlist/${refCode}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-600/20 hover:shadow-lg"
        >
          <Clock className="w-4 h-4" />
          Check Waitlist Status
        </a>
        <p className="text-xs text-slate-400 mt-2">
          Save this link to check your position and get notified
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-lg p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <ListPlus className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Join the Waitlist</h3>
          <p className="text-sm text-slate-500">
            We'll notify you when a slot opens up
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={clientInfo.name}
            onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
            required
            placeholder="John Doe"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={clientInfo.email}
            onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
            required
            placeholder="john@example.com"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Phone Number
          </label>
          <input
            type="tel"
            value={clientInfo.phone}
            onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
            required
            placeholder="(555) 123-4567"
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Preferred days */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Preferred Days <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleDay(day.key)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  preferredDays.includes(day.key)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred time range */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Preferred Time
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => setSelectedTimeRange(range.key)}
                className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all border text-left ${
                  selectedTimeRange === range.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {submitting ? (
              <>
                <div className="spinner-sm border-white/30 border-t-white" />
                Joining…
              </>
            ) : (
              <>
                <ListPlus className="w-4 h-4" />
                Join Waitlist
              </>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
            >
              Back
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
