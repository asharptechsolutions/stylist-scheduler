import { useState, useEffect } from 'react'
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { Plus, Edit3, Trash2, X, Check, Clock, Coffee, Save, Calendar, Copy } from 'lucide-react'

const DAY_LABELS = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' },
]

const DEFAULT_PRESETS = [
  {
    name: 'Full-time 9-5',
    description: 'Monday to Friday, 9am to 5pm with lunch break',
    days: {
      monday: { enabled: true, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { enabled: true, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { enabled: true, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { enabled: true, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { enabled: true, start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      saturday: { enabled: false, start: '09:00', end: '17:00', breaks: [] },
      sunday: { enabled: false, start: '09:00', end: '17:00', breaks: [] },
    },
    isDefault: true,
  },
  {
    name: 'Part-time Mornings',
    description: 'Monday to Friday, 9am to 1pm',
    days: {
      monday: { enabled: true, start: '09:00', end: '13:00', breaks: [] },
      tuesday: { enabled: true, start: '09:00', end: '13:00', breaks: [] },
      wednesday: { enabled: true, start: '09:00', end: '13:00', breaks: [] },
      thursday: { enabled: true, start: '09:00', end: '13:00', breaks: [] },
      friday: { enabled: true, start: '09:00', end: '13:00', breaks: [] },
      saturday: { enabled: false, start: '09:00', end: '13:00', breaks: [] },
      sunday: { enabled: false, start: '09:00', end: '13:00', breaks: [] },
    },
    isDefault: true,
  },
  {
    name: 'Weekends Only',
    description: 'Saturday and Sunday, 10am to 6pm',
    days: {
      monday: { enabled: false, start: '10:00', end: '18:00', breaks: [] },
      tuesday: { enabled: false, start: '10:00', end: '18:00', breaks: [] },
      wednesday: { enabled: false, start: '10:00', end: '18:00', breaks: [] },
      thursday: { enabled: false, start: '10:00', end: '18:00', breaks: [] },
      friday: { enabled: false, start: '10:00', end: '18:00', breaks: [] },
      saturday: { enabled: true, start: '10:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      sunday: { enabled: true, start: '10:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
    },
    isDefault: true,
  },
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

function SchedulePresets({ shopId }) {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPreset, setEditingPreset] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    days: {},
  })

  // Initialize form data with default days
  useEffect(() => {
    resetForm()
  }, [])

  // Listen to presets collection
  useEffect(() => {
    if (!shopId) return

    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'schedulePresets'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            // Default presets first, then by name
            if (a.isDefault && !b.isDefault) return -1
            if (!a.isDefault && b.isDefault) return 1
            return (a.name || '').localeCompare(b.name || '')
          })
        setPresets(items)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [shopId])

  const resetForm = () => {
    const defaultDays = {}
    DAY_LABELS.forEach((d) => {
      defaultDays[d.key] = { ...DEFAULT_DAY, breaks: [] }
    })
    setFormData({ name: '', description: '', days: defaultDays })
    setEditingPreset(null)
    setShowForm(false)
  }

  const initializeDefaultPresets = async () => {
    try {
      for (const preset of DEFAULT_PRESETS) {
        await addDoc(collection(db, 'shops', shopId, 'schedulePresets'), {
          ...preset,
          createdAt: serverTimestamp(),
        })
      }
    } catch (err) {
      console.error('Error initializing default presets:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        days: formData.days,
        isDefault: false,
        updatedAt: serverTimestamp(),
      }

      if (editingPreset) {
        await updateDoc(doc(db, 'shops', shopId, 'schedulePresets', editingPreset.id), data)
      } else {
        await addDoc(collection(db, 'shops', shopId, 'schedulePresets'), {
          ...data,
          createdAt: serverTimestamp(),
        })
      }
      resetForm()
    } catch (err) {
      console.error('Error saving preset:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (preset) => {
    // Ensure all days exist with proper structure
    const days = {}
    DAY_LABELS.forEach((d) => {
      const existing = preset.days?.[d.key]
      if (existing) {
        days[d.key] = {
          enabled: !!existing.enabled,
          start: existing.start || '09:00',
          end: existing.end || '17:00',
          breaks: existing.breaks || (existing.break ? [existing.break] : []),
        }
      } else {
        days[d.key] = { ...DEFAULT_DAY, breaks: [] }
      }
    })

    setFormData({
      name: preset.name,
      description: preset.description || '',
      days,
    })
    setEditingPreset(preset)
    setShowForm(true)
  }

  const deletePreset = async (presetId) => {
    if (!confirm('Delete this schedule preset?')) return
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'schedulePresets', presetId))
    } catch (err) {
      console.error('Error deleting preset:', err)
    }
  }

  const duplicatePreset = (preset) => {
    const days = {}
    DAY_LABELS.forEach((d) => {
      const existing = preset.days?.[d.key]
      if (existing) {
        days[d.key] = {
          enabled: !!existing.enabled,
          start: existing.start || '09:00',
          end: existing.end || '17:00',
          breaks: [...(existing.breaks || (existing.break ? [existing.break] : []))],
        }
      } else {
        days[d.key] = { ...DEFAULT_DAY, breaks: [] }
      }
    })

    setFormData({
      name: `${preset.name} (Copy)`,
      description: preset.description || '',
      days,
    })
    setEditingPreset(null)
    setShowForm(true)
  }

  const updateDay = (dayKey, field, value) => {
    setFormData((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: { ...prev.days[dayKey], [field]: value },
      },
    }))
  }

  const addBreak = (dayKey) => {
    setFormData((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: {
          ...prev.days[dayKey],
          breaks: [...(prev.days[dayKey].breaks || []), { start: '12:00', end: '13:00' }],
        },
      },
    }))
  }

  const updateBreak = (dayKey, breakIndex, field, value) => {
    setFormData((prev) => {
      const newBreaks = [...(prev.days[dayKey].breaks || [])]
      newBreaks[breakIndex] = { ...newBreaks[breakIndex], [field]: value }
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: { ...prev.days[dayKey], breaks: newBreaks },
        },
      }
    })
  }

  const removeBreak = (dayKey, breakIndex) => {
    setFormData((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [dayKey]: {
          ...prev.days[dayKey],
          breaks: prev.days[dayKey].breaks.filter((_, i) => i !== breakIndex),
        },
      },
    }))
  }

  const copyDayToAll = (sourceDayKey) => {
    const source = formData.days[sourceDayKey]
    setFormData((prev) => {
      const newDays = { ...prev.days }
      DAY_LABELS.forEach((d) => {
        if (d.key !== sourceDayKey) {
          newDays[d.key] = {
            enabled: source.enabled,
            start: source.start,
            end: source.end,
            breaks: source.breaks.map((b) => ({ ...b })),
          }
        }
      })
      return { ...prev, days: newDays }
    })
  }

  const getPresetSummary = (preset) => {
    if (!preset.days) return 'No schedule configured'
    const enabledDays = DAY_LABELS.filter((d) => preset.days[d.key]?.enabled)
    if (enabledDays.length === 0) return 'No working days'

    const dayTexts = enabledDays.map((d) => {
      const cfg = preset.days[d.key]
      const breaks = cfg.breaks || (cfg.break ? [cfg.break] : [])
      const breakText = breaks.length > 0 ? ` (${breaks.length} break${breaks.length > 1 ? 's' : ''})` : ''
      return `${d.short} ${formatTimeShort(cfg.start)}–${formatTimeShort(cfg.end)}${breakText}`
    })

    return dayTexts.join(' · ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Schedule Presets</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create reusable schedule templates with breaks to quickly apply to staff
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            New Preset
          </button>
        )}
      </div>

      {/* Initialize defaults button if no presets */}
      {presets.length === 0 && !showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center mb-6">
          <Calendar className="w-10 h-10 text-blue-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 mb-2">Get started with presets</h3>
          <p className="text-sm text-slate-600 mb-4">
            Add common schedule templates like "Full-time 9-5" or "Weekends Only"
          </p>
          <button
            onClick={initializeDefaultPresets}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Default Presets
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">
              {editingPreset ? 'Edit Preset' : 'New Schedule Preset'}
            </h3>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Preset Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Full-time 9-5"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Standard work week with lunch break"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Days */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                Weekly Schedule
              </label>
              {DAY_LABELS.map(({ key, label }) => {
                const day = formData.days[key] || DEFAULT_DAY
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
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold transition-all"
                          >
                            <Coffee className="w-3.5 h-3.5" />
                            + Break
                          </button>

                          {/* Copy to all */}
                          <button
                            type="button"
                            onClick={() => copyDayToAll(key)}
                            className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors whitespace-nowrap"
                          >
                            Copy to all
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400 italic">Day off</span>
                      )}
                    </div>

                    {/* Breaks */}
                    {day.enabled && day.breaks && day.breaks.length > 0 && (
                      <div className="mt-3 ml-[140px] space-y-2">
                        {day.breaks.map((brk, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Coffee className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs text-slate-500">Break:</span>
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

            {/* Submit buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : editingPreset ? 'Update Preset' : 'Save Preset'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Presets list */}
      {presets.length > 0 && (
        <div className="space-y-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-slate-900">{preset.name}</h3>
                    {preset.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  {preset.description && (
                    <p className="text-sm text-slate-500 mb-2">{preset.description}</p>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed">{getPresetSummary(preset)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => duplicatePreset(preset)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Duplicate preset"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(preset)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Edit preset"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {!preset.isDefault && (
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete preset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SchedulePresets
