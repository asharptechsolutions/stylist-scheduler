import { useState, useEffect } from 'react'
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { Plus, Edit3, Trash2, X, Check, Users, Clock } from 'lucide-react'
import WeeklyHoursEditor from './WeeklyHoursEditor'

const DAY_LABELS = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
]

function formatTimeShort(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function StaffManager({ shopId }) {
  const [staff, setStaff] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingHoursId, setEditingHoursId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!shopId) return

    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'staff'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setStaff(items)
      }
    )

    return () => unsub()
  }, [shopId])

  const resetForm = () => {
    setFormData({ name: '', role: '' })
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const data = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      active: true,
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'shops', shopId, 'staff', editingId), data)
      } else {
        await addDoc(collection(db, 'shops', shopId, 'staff'), {
          ...data,
          email: '',
          createdAt: serverTimestamp(),
        })
      }
      resetForm()
    } catch (err) {
      console.error('Error saving staff member:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (member) => {
    setFormData({
      name: member.name,
      role: member.role || '',
    })
    setEditingId(member.id)
    setShowForm(true)
  }

  const softDelete = async (staffId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        active: false,
      })
    } catch (err) {
      console.error('Error deleting staff member:', err)
    }
  }

  const getHoursSummary = (weeklyHours) => {
    if (!weeklyHours) return null
    const enabledDays = DAY_LABELS.filter((d) => weeklyHours[d.key]?.enabled)
    if (enabledDays.length === 0) return null
    return enabledDays.map((d) => {
      const cfg = weeklyHours[d.key]
      return `${d.short} ${formatTimeShort(cfg.start)}–${formatTimeShort(cfg.end)}`
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Staff</h2>
          <p className="text-slate-600 text-sm mt-1">
            Manage your team — assign availability and bookings per staff member
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
            Add Staff
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {editingId ? 'Edit Staff Member' : 'New Staff Member'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Jane Smith"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role (optional)
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g. Senior Stylist"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : editingId ? 'Update Staff' : 'Add Staff'}
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

      {/* Staff List */}
      {staff.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-slate-800 font-medium mb-1">No staff members yet</p>
          <p className="text-sm text-slate-600">
            Add your team members to assign them availability and bookings
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {staff.map((member) => {
            const hoursSummary = getHoursSummary(member.weeklyHours)

            return (
              <div key={member.id}>
                <div className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{member.name}</h3>
                      {member.role && (
                        <p className="text-sm text-slate-500 mt-0.5">{member.role}</p>
                      )}
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>

                  {/* Weekly Hours Summary */}
                  {hoursSummary ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {hoursSummary.map((text, i) => (
                        <span
                          key={i}
                          className="inline-block px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium"
                        >
                          {text}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mb-3 italic">No weekly hours set</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditingHoursId(editingHoursId === member.id ? null : member.id)
                      }
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        editingHoursId === member.id
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Set Hours
                    </button>
                    <button
                      onClick={() => startEdit(member)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all border border-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => softDelete(member.id)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all border border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weekly Hours Editor (expandable) */}
                {editingHoursId === member.id && (
                  <div className="mt-2">
                    <WeeklyHoursEditor
                      shopId={shopId}
                      staffId={member.id}
                      staffName={member.name}
                      weeklyHours={member.weeklyHours}
                      onClose={() => setEditingHoursId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default StaffManager
