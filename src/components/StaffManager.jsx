import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase'
import { Plus, Edit3, Trash2, X, Check, Users, Clock, Camera, Image, Loader2 } from 'lucide-react'
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

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
  const [editingPortfolioId, setEditingPortfolioId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
  })
  const [saving, setSaving] = useState(false)

  // Bio editing state
  const [editingBioId, setEditingBioId] = useState(null)
  const [bioText, setBioText] = useState('')
  const [savingBio, setSavingBio] = useState(false)

  // Portfolio upload state
  const [uploading, setUploading] = useState(false)
  const [uploadCaption, setUploadCaption] = useState('')
  const [showCaptionInput, setShowCaptionInput] = useState(null) // staffId when showing
  const [selectedFile, setSelectedFile] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(null)
  const fileInputRef = useRef(null)

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
          bio: '',
          portfolio: [],
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

  // ── Bio handlers ──
  const startEditBio = (member) => {
    setEditingBioId(member.id)
    setBioText(member.bio || '')
  }

  const saveBio = async (staffId) => {
    setSavingBio(true)
    try {
      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        bio: bioText.trim(),
      })
      setEditingBioId(null)
      setBioText('')
    } catch (err) {
      console.error('Error saving bio:', err)
    } finally {
      setSavingBio(false)
    }
  }

  // ── Portfolio handlers ──
  const handleFileSelect = (staffId) => {
    setShowCaptionInput(staffId)
    setUploadCaption('')
    setSelectedFile(null)
    // slight delay to ensure state is set before clicking
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        fileInputRef.current.click()
      }
    }, 50)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Please select a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('File size must be under 5MB.')
      return
    }

    setSelectedFile(file)
  }

  const uploadPhoto = async (staffId) => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const timestamp = Date.now()
      const ext = selectedFile.name.split('.').pop()
      const filename = `${timestamp}.${ext}`
      const storagePath = `shops/${shopId}/staff/${staffId}/portfolio/${filename}`
      const storageRef = ref(storage, storagePath)

      await uploadBytes(storageRef, selectedFile)
      const url = await getDownloadURL(storageRef)

      const member = staff.find((s) => s.id === staffId)
      const currentPortfolio = member?.portfolio || []

      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        portfolio: [
          ...currentPortfolio,
          {
            url,
            storagePath,
            caption: uploadCaption.trim(),
            uploadedAt: new Date().toISOString(),
          },
        ],
      })

      setShowCaptionInput(null)
      setUploadCaption('')
      setSelectedFile(null)
    } catch (err) {
      console.error('Error uploading photo:', err)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (staffId, photoIndex) => {
    const member = staff.find((s) => s.id === staffId)
    if (!member) return

    const photo = member.portfolio[photoIndex]
    if (!photo) return

    setDeletingPhoto(`${staffId}-${photoIndex}`)
    try {
      // Delete from Firebase Storage
      if (photo.storagePath) {
        try {
          const storageRef = ref(storage, photo.storagePath)
          await deleteObject(storageRef)
        } catch (err) {
          // File may already be deleted; continue
          console.warn('Storage delete warning:', err)
        }
      }

      // Remove from Firestore
      const updatedPortfolio = member.portfolio.filter((_, i) => i !== photoIndex)
      await updateDoc(doc(db, 'shops', shopId, 'staff', staffId), {
        portfolio: updatedPortfolio,
      })
    } catch (err) {
      console.error('Error deleting photo:', err)
      alert('Failed to delete photo.')
    } finally {
      setDeletingPhoto(null)
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
      {/* Hidden file input for portfolio uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

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
            const portfolio = member.portfolio || []

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

                  {/* Bio display / edit */}
                  <div className="mb-3">
                    {editingBioId === member.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={bioText}
                          onChange={(e) => setBioText(e.target.value)}
                          placeholder="Write a short bio — specialties, experience, personality…"
                          rows={3}
                          maxLength={500}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveBio(member.id)}
                            disabled={savingBio}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            {savingBio ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Save Bio
                          </button>
                          <button
                            onClick={() => {
                              setEditingBioId(null)
                              setBioText('')
                            }}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all"
                          >
                            Cancel
                          </button>
                          <span className="text-xs text-slate-400 ml-auto">
                            {bioText.length}/500
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEditBio(member)}
                        className="cursor-pointer group"
                      >
                        {member.bio ? (
                          <p className="text-sm text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                            {member.bio}
                            <span className="ml-1.5 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              edit
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic group-hover:text-blue-500 transition-colors">
                            + Add a bio…
                          </p>
                        )}
                      </div>
                    )}
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

                  {/* Portfolio thumbnail preview */}
                  {portfolio.length > 0 && editingPortfolioId !== member.id && (
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {portfolio.slice(0, 4).map((photo, i) => (
                          <img
                            key={i}
                            src={photo.url}
                            alt={photo.caption || 'Portfolio'}
                            className="w-10 h-10 rounded-lg object-cover border-2 border-white shadow-sm"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {portfolio.length} photo{portfolio.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
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
                      onClick={() =>
                        setEditingPortfolioId(
                          editingPortfolioId === member.id ? null : member.id
                        )
                      }
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        editingPortfolioId === member.id
                          ? 'bg-violet-100 text-violet-700 border-violet-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Portfolio
                    </button>
                    <button
                      onClick={() => startEdit(member)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all border border-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
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

                {/* Portfolio Editor (expandable) */}
                {editingPortfolioId === member.id && (
                  <div className="mt-2 bg-white border-2 border-violet-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Image className="w-4 h-4 text-violet-600" />
                        Portfolio — {member.name}
                      </h4>
                      <button
                        onClick={() => handleFileSelect(member.id)}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        Add Photo
                      </button>
                    </div>

                    {/* Upload caption input (when file selected) */}
                    {showCaptionInput === member.id && selectedFile && (
                      <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-slate-600 font-medium mb-1 truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={uploadCaption}
                          onChange={(e) => setUploadCaption(e.target.value)}
                          placeholder="Add a caption (optional)…"
                          maxLength={200}
                          className="w-full px-3 py-2 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent mb-2"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => uploadPhoto(member.id)}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Uploading…
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Upload
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowCaptionInput(null)
                              setSelectedFile(null)
                              setUploadCaption('')
                            }}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Portfolio grid */}
                    {portfolio.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm text-slate-500">
                          No portfolio photos yet. Add some to showcase work!
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {portfolio.map((photo, index) => (
                          <div
                            key={index}
                            className="group relative bg-slate-50 rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                          >
                            <div className="aspect-square">
                              <img
                                src={photo.url}
                                alt={photo.caption || 'Portfolio photo'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {photo.caption && (
                              <div className="px-2 py-1.5">
                                <p className="text-xs text-slate-600 truncate">
                                  {photo.caption}
                                </p>
                              </div>
                            )}
                            {/* Delete overlay */}
                            <button
                              onClick={() => deletePhoto(member.id, index)}
                              disabled={deletingPhoto === `${member.id}-${index}`}
                              className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md disabled:opacity-50"
                              title="Delete photo"
                            >
                              {deletingPhoto === `${member.id}-${index}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
