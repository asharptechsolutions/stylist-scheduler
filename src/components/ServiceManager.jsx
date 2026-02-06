import { useState, useEffect } from 'react'
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { Plus, Edit3, Trash2, X, Check, DollarSign, Clock, Tag, CreditCard, Percent } from 'lucide-react'

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
]

const DEPOSIT_OPTIONS = [
  { value: 0, label: 'No deposit required' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
  { value: 50, label: '50%' },
  { value: 100, label: 'Full payment upfront' },
]

function ServiceManager({ shopId }) {
  const [services, setServices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    price: '',
    depositPercent: 0,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!shopId) return

    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'services'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setServices(items)
      }
    )

    return () => unsub()
  }, [shopId])

  const resetForm = () => {
    setFormData({ name: '', description: '', duration: 30, price: '', depositPercent: 0 })
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      duration: parseInt(formData.duration),
      price: parseFloat(formData.price),
      depositPercent: parseInt(formData.depositPercent) || 0,
      active: true,
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'shops', shopId, 'services', editingId), data)
      } else {
        await addDoc(collection(db, 'shops', shopId, 'services'), {
          ...data,
          createdAt: serverTimestamp(),
        })
      }
      resetForm()
    } catch (err) {
      console.error('Error saving service:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (service) => {
    setFormData({
      name: service.name,
      description: service.description || '',
      duration: service.duration,
      price: service.price.toString(),
      depositPercent: service.depositPercent || 0,
    })
    setEditingId(service.id)
    setShowForm(true)
  }

  const softDelete = async (serviceId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId, 'services', serviceId), {
        active: false,
      })
    } catch (err) {
      console.error('Error deleting service:', err)
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Services</h2>
          <p className="text-slate-600 text-sm mt-1">
            Define the services you offer — clients will pick one before booking
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
            Add Service
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {editingId ? 'Edit Service' : 'New Service'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Haircut"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Classic cut and style"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Duration *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Price (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    Deposit Required
                  </span>
                </label>
                <select
                  value={formData.depositPercent}
                  onChange={(e) => setFormData({ ...formData, depositPercent: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {DEPOSIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {formData.depositPercent > 0 && formData.price && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-800">
                  Clients will pay <strong>${((parseFloat(formData.price) || 0) * (parseInt(formData.depositPercent) / 100)).toFixed(2)}</strong> deposit at booking
                  {parseInt(formData.depositPercent) < 100 && (
                    <span> (${((parseFloat(formData.price) || 0) * (1 - parseInt(formData.depositPercent) / 100)).toFixed(2)} remaining due at appointment)</span>
                  )}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : editingId ? 'Update Service' : 'Add Service'}
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

      {/* Services List */}
      {services.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">💈</div>
          <p className="text-slate-800 font-medium mb-1">No services yet</p>
          <p className="text-sm text-slate-600">
            Add your first service so clients can choose what to book
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white border-2 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{service.description}</p>
                  )}
                </div>
                <span className="text-xl font-bold text-blue-600 whitespace-nowrap ml-3">
                  {formatPrice(service.price)}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500 mb-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatDuration(service.duration)}
                </span>
                {service.depositPercent > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <CreditCard className="w-3 h-3" />
                    {service.depositPercent}% deposit
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(service)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all border border-slate-200"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => softDelete(service.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ServiceManager
