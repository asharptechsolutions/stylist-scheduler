import { useState, useEffect } from 'react'
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { Save, X, Clock, Coffee, Calendar, ChevronDown, Check } from 'lucide-react'

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
  breaks: [],
}

function formatTimeShort(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function WeeklyHoursEditor({ shopId, staffId, staffName, weeklyHours, onClose }) {
  const [hours, setHours] = useState(() => {
    const initial = {}
    for (const day of DAYS) {
      const existing = weeklyHours?.[day.key]
      if (existing) {
        // Support both old single break and new breaks array
        const breaks = existing.breaks || (existing.break ? [existing.break] : [])
        initial[day.key] = {
          enabled: !!existing.enabled,
          start: existing.start || '09:00',
          end: existing.end || '17:00',
          breaks,
        }
      } else {
        initial[day.key] = { ...DEFAULT_DAY, breaks: [] }
      }
    }
    return initial
  })

  const [saving, setSaving] = useState(false)
  const [copySource, setCopySource] = useState(null)
  const [presets, setPresets] = useState([])
  const [showPresetDropdown, setShowPresetDropdown] = useState(false)
  const [presetApplied, setPresetApplied] = useState(null)

  // Listen to presets
  useEffect(() => {
    if (!shopId) return
    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'schedulePresets'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1
            if (!a.isDefault && b.isDefault) return 1
            return (a.name || '').localeCompare(b.name || '')
          })
        setPresets(items)
      }
    )
    return () => unsub()
  }, [shopId])

  const updateDay = (dayKey, field, value) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }))
    setPresetApplied(null)
  }

  const addBreak = (dayKey) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        breaks: [...(prev[dayKey].breaks || []), { start: '12:00', end: '13:00' }],
      },
    }))
    setPresetApplied(null)
  }

  const updateBreak = (dayKey, breakIndex, field, value) => {
    setHours((prev) => {
      const newBreaks = [...(prev[dayKey].breaks || [])]
      newBreaks[breakIndex] = { ...newBreaks[breakIndex], [field]: value }
      return {
        ...prev,
        [dayKey]: { ...prev[dayKey], breaks: newBreaks },
      }
    })
    setPresetApplied(null)
  }

  const removeBreak = (dayKey, breakIndex) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        breaks: prev[dayKey].breaks.filter((_, i) => i !== breakIndex),
      },
    }))
    setPresetApplied(null)
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
            breaks: source.breaks.map((b) => ({ ...b })),
          }
        }
      }
      return updated
    })
    setCopySource(sourceDayKey)
    setPresetApplied(null)
    setTimeout(() => setCopySource(null), 1500)
  }

  const applyPreset = (preset) => {
    if (!preset.days) return

    const newHours = {}
    for (const day of DAYS) {
      const presetDay = preset.days[day.key]
      if (presetDay) {
        const breaks = presetDay.breaks || (presetDay.break ? [presetDay.break] : [])
        newHours[day.key] = {
          enabled: !!presetDay.enabled,
          start: presetDay.start || '09:00',
          end: presetDay.end || '17:00',
          breaks: breaks.map((b) => ({ ...b })),
        }
      } else {
        newHours[day.key] = { ...DEFAULT_DAY, breaks: [] }
      }
    }

    setHours(newHours)
    setShowPresetDropdown(false)
    setPresetApplied(preset.name)
    setTimeout(() => setPresetApplied(null), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert breaks array to also maintain backward compatibility with single break
      const dataToSave = {}
      for (const day of DAYS) {
        const dayData = hours[day.key]
        dataToSave[day.key] = {
          enabled: dayData.enabled,
          start: dayData.start,
          end: dayData.end,
          breaks: dayData.breaks || [],
          // Keep single break field for backward compatibility
          break: dayData.breaks && dayData.breaks.length > 0 ? dayData.breaks[0] : null,
        }
      }

      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        weeklyHours: dataToSave,
      })
      onClose()
    } catch (err) {
      console.error('Error saving weekly hours:', err)
    } finally {
      setSaving(false)
    }
  }

  const getBreakSummary = (breaks) => {
    if (!breaks || breaks.length === 0) return ''
    return breaks.map((b) => `${formatTimeShort(b.start)}–${formatTimeShort(b.end)}`).join(', ')
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Weekly Hours</h3>
          <p className="text-sm text-slate-500">{staffName}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Preset dropdown */}
          {presets.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-sm font-semibold transition-all"
              >
                <Calendar className="w-4 h-4" />
                Apply Preset
                <ChevronDown className={`w-4 h-4 transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showPresetDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowPresetDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 max-h-80 overflow-y-auto">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{preset.name}</span>
                          {preset.isDefault && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {preset.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Preset applied notification */}
      {presetApplied && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-sm text-green-700 font-medium animate-fade-in">
          <Check className="w-4 h-4" />
          Applied "{presetApplied}" preset — click Save to keep changes
        </div>
      )}

      <div className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const day = hours[key]
          const breaks = day.breaks || []
          
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

                    {/* Add break button */}
                    <button
                      type="button"
                      onClick={() => addBreak(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        breaks.length > 0
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                      }`}
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      {breaks.length > 0 ? `${breaks.length} Break${breaks.length > 1 ? 's' : ''}` : '+ Break'}
                    </button>

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

              {/* Breaks list */}
              {day.enabled && breaks.length > 0 && (
                <div className="mt-3 ml-[140px] space-y-2">
                  {breaks.map((brk, idx) => (
                    <div key={idx} className="flex items-center gap-2 animate-fade-in">
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-slate-500">Break {idx + 1}:</span>
                      <input
                        type="time"
                        value={brk.start}
                        onChange={(e) => updateBreak(key, idx, 'start', e.target.value)}
                        className="px-2 py-1 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      />
                      <span className="text-slate-400 text-xs">–</span>
                      <input
                        type="time"
                        value={brk.end}
                        onChange={(e) => updateBreak(key, idx, 'end', e.target.value)}
                        className="px-2 py-1 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeBreak(key, idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Remove break"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
