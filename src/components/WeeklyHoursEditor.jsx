import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Save, X, Clock, Coffee } from 'lucide-react'

const DAYS = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

const DEFAULT_DAY = {
  enabled: false,
  start: '09:00',
  end: '17:00',
  break: null,
}

function WeeklyHoursEditor({ shopId, staffId, staffName, weeklyHours, onClose }) {
  const [hours, setHours] = useState(() => {
    const initial = {}
    for (const day of DAYS) {
      const existing = weeklyHours?.[day.key]
      if (existing) {
        initial[day.key] = {
          enabled: !!existing.enabled,
          start: existing.start || '09:00',
          end: existing.end || '17:00',
          break: existing.break ? { start: existing.break.start, end: existing.break.end } : null,
        }
      } else {
        initial[day.key] = { ...DEFAULT_DAY }
      }
    }
    return initial
  })

  const [saving, setSaving] = useState(false)
  const [copySource, setCopySource] = useState(null)

  const updateDay = (dayKey, field, value) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }))
  }

  const toggleBreak = (dayKey) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        break: prev[dayKey].break ? null : { start: '12:00', end: '13:00' },
      },
    }))
  }

  const updateBreak = (dayKey, field, value) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        break: { ...prev[dayKey].break, [field]: value },
      },
    }))
  }

  const copyToAll = (sourceDayKey) => {
    const source = hours[sourceDayKey]
    setHours((prev) => {
      const updated = { ...prev }
      for (const day of DAYS) {
        if (day.key !== sourceDayKey) {
          updated[day.key] = {
            enabled: source.enabled,
            start: source.start,
            end: source.end,
            break: source.break ? { ...source.break } : null,
          }
        }
      }
      return updated
    })
    setCopySource(sourceDayKey)
    setTimeout(() => setCopySource(null), 1500)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        weeklyHours: hours,
      })
      onClose()
    } catch (err) {
      console.error('Error saving weekly hours:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Weekly Hours</h3>
          <p className="text-sm text-slate-500">{staffName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const day = hours[key]
          return (
            <div
              key={key}
              className={`rounded-xl p-4 transition-all ${
                day.enabled
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-slate-50 border border-slate-200'
              }`}
            >
              <div className="flex items-center gap-4 flex-wrap">
                {/* Toggle */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <button
                    type="button"
                    onClick={() => updateDay(key, 'enabled', !day.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      day.enabled ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        day.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span
                    className={`font-semibold text-sm ${
                      day.enabled ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>

                {day.enabled ? (
                  <>
                    {/* Time inputs */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <input
                        type="time"
                        value={day.start}
                        onChange={(e) => updateDay(key, 'start', e.target.value)}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-slate-400 text-sm">to</span>
                      <input
                        type="time"
                        value={day.end}
                        onChange={(e) => updateDay(key, 'end', e.target.value)}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Break */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBreak(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          day.break
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        {day.break ? 'Break' : '+ Break'}
                      </button>
                      {day.break && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={day.break.start}
                            onChange={(e) => updateBreak(key, 'start', e.target.value)}
                            className="px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                          <span className="text-slate-400 text-xs">–</span>
                          <input
                            type="time"
                            value={day.break.end}
                            onChange={(e) => updateBreak(key, 'end', e.target.value)}
                            className="px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Copy to all */}
                    <button
                      type="button"
                      onClick={() => copyToAll(key)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors whitespace-nowrap"
                    >
                      {copySource === key ? '✓ Copied!' : 'Copy to all'}
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-slate-400 italic">Day off</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Hours'}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  )
}

export default WeeklyHoursEditor
