import { useState, useEffect, useMemo } from 'react'
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  Plus,
  Play,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  Clock,
  Users,
  Tag,
  User,
  Timer,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { calculateAllWaitTimes, getUpcomingBookings } from '../utils/waitTimeCalculator'

function formatElapsed(startedAt) {
  if (!startedAt) return '0m'
  const started = startedAt?.toDate?.() || new Date(startedAt)
  const diff = Math.floor((Date.now() - started.getTime()) / 60000)
  if (diff < 1) return '<1m'
  if (diff < 60) return `${diff}m`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatWait(minutes) {
  if (minutes == null) return '—'
  if (minutes < 1) return 'Next up'
  if (minutes < 60) return `~${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`
}

export default function WalkInsTab({ shopId, services, staff, bookings }) {
  const [walkins, setWalkins] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    clientName: '',
    serviceId: '',
    staffId: '',
    estimatedDuration: 30,
  })

  // Listen to walkins
  useEffect(() => {
    if (!shopId) return

    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'walkins'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setWalkins(items)
      }
    )
    return () => unsub()
  }, [shopId])

  // Categorize walkins
  const waiting = useMemo(
    () =>
      walkins
        .filter((w) => w.status === 'waiting')
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [walkins]
  )

  const inProgress = useMemo(
    () =>
      walkins
        .filter((w) => w.status === 'in-progress')
        .sort((a, b) => {
          const aTime = a.startedAt?.toDate?.()?.getTime() || 0
          const bTime = b.startedAt?.toDate?.()?.getTime() || 0
          return aTime - bTime
        }),
    [walkins]
  )

  const todayStart = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])

  const completedToday = useMemo(
    () =>
      walkins
        .filter((w) => {
          if (w.status !== 'completed' && w.status !== 'no-show') return false
          const completedAt = w.completedAt?.toDate?.() || (w.completedAt ? new Date(w.completedAt) : null)
          if (!completedAt) return false
          return completedAt >= todayStart
        })
        .sort((a, b) => {
          const aTime = a.completedAt?.toDate?.()?.getTime() || 0
          const bTime = b.completedAt?.toDate?.()?.getTime() || 0
          return bTime - aTime
        }),
    [walkins, todayStart]
  )

  // Active staff count for wait time calculation
  const activeStaffCount = useMemo(() => Math.max(staff.filter((s) => s.active !== false).length, 1), [staff])

  // Upcoming online bookings
  const upcomingBookings = useMemo(() => getUpcomingBookings(bookings, 3), [bookings])

  // Calculate wait times
  const waitTimes = useMemo(
    () =>
      calculateAllWaitTimes({
        waitingQueue: waiting,
        inProgress,
        staffCount: activeStaffCount,
        upcomingBookings,
        defaultDuration: 30,
      }),
    [waiting, inProgress, activeStaffCount, upcomingBookings]
  )

  // Stats
  const stats = useMemo(() => {
    const completedTimes = completedToday
      .filter((w) => w.status === 'completed' && w.joinedAt && w.startedAt)
      .map((w) => {
        const joined = w.joinedAt?.toDate?.() || new Date(w.joinedAt)
        const started = w.startedAt?.toDate?.() || new Date(w.startedAt)
        return Math.floor((started.getTime() - joined.getTime()) / 60000)
      })
      .filter((t) => t >= 0)

    const avgWait =
      completedTimes.length > 0
        ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length)
        : 0

    return {
      waiting: waiting.length,
      avgWait,
      completedToday: completedToday.filter((w) => w.status === 'completed').length,
    }
  }, [waiting, completedToday])

  // Auto-fill duration when service changes
  const handleServiceChange = (serviceId) => {
    const service = services.find((s) => s.id === serviceId)
    setFormData((prev) => ({
      ...prev,
      serviceId,
      estimatedDuration: service?.duration || 30,
    }))
  }

  // Get next position
  const getNextPosition = () => {
    if (waiting.length === 0) return 1
    return Math.max(...waiting.map((w) => w.position || 0)) + 1
  }

  // Count walkins today for default naming
  const todayWalkinCount = useMemo(() => {
    return walkins.filter((w) => {
      const joined = w.joinedAt?.toDate?.() || (w.joinedAt ? new Date(w.joinedAt) : null)
      return joined && joined >= todayStart
    }).length
  }, [walkins, todayStart])

  const handleAddWalkin = async (e) => {
    e.preventDefault()
    setSaving(true)

    const service = services.find((s) => s.id === formData.serviceId)
    const staffMember = staff.find((s) => s.id === formData.staffId)
    const position = getNextPosition()
    const clientName =
      formData.clientName.trim() || `Walk-in #${todayWalkinCount + 1}`

    try {
      await addDoc(collection(db, 'shops', shopId, 'walkins'), {
        clientName,
        serviceId: formData.serviceId || null,
        serviceName: service?.name || null,
        staffId: formData.staffId || null,
        staffName: staffMember?.name || null,
        estimatedDuration: parseInt(formData.estimatedDuration) || 30,
        status: 'waiting',
        position,
        joinedAt: Timestamp.now(),
        startedAt: null,
        completedAt: null,
        estimatedWaitMinutes: null,
      })

      setFormData({ clientName: '', serviceId: '', staffId: '', estimatedDuration: 30 })
      setShowForm(false)
    } catch (err) {
      console.error('Error adding walk-in:', err)
    } finally {
      setSaving(false)
    }
  }

  const startService = async (walkinId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId, 'walkins', walkinId), {
        status: 'in-progress',
        startedAt: Timestamp.now(),
      })
      // Reorder remaining waiting walkins
      const remaining = waiting
        .filter((w) => w.id !== walkinId)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      for (let i = 0; i < remaining.length; i++) {
        await updateDoc(doc(db, 'shops', shopId, 'walkins', remaining[i].id), {
          position: i + 1,
        })
      }
    } catch (err) {
      console.error('Error starting service:', err)
    }
  }

  const completeService = async (walkinId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId, 'walkins', walkinId), {
        status: 'completed',
        completedAt: Timestamp.now(),
      })
    } catch (err) {
      console.error('Error completing service:', err)
    }
  }

  const markNoShow = async (walkinId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId, 'walkins', walkinId), {
        status: 'no-show',
        completedAt: Timestamp.now(),
      })
      // Reorder remaining
      const remaining = waiting
        .filter((w) => w.id !== walkinId)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      for (let i = 0; i < remaining.length; i++) {
        await updateDoc(doc(db, 'shops', shopId, 'walkins', remaining[i].id), {
          position: i + 1,
        })
      }
    } catch (err) {
      console.error('Error marking no-show:', err)
    }
  }

  const moveUp = async (walkinId) => {
    const idx = waiting.findIndex((w) => w.id === walkinId)
    if (idx <= 0) return
    const above = waiting[idx - 1]
    const current = waiting[idx]
    try {
      await updateDoc(doc(db, 'shops', shopId, 'walkins', current.id), {
        position: above.position,
      })
      await updateDoc(doc(db, 'shops', shopId, 'walkins', above.id), {
        position: current.position,
      })
    } catch (err) {
      console.error('Error reordering:', err)
    }
  }

  const moveDown = async (walkinId) => {
    const idx = waiting.findIndex((w) => w.id === walkinId)
    if (idx < 0 || idx >= waiting.length - 1) return
    const below = waiting[idx + 1]
    const current = waiting[idx]
    try {
      await updateDoc(doc(db, 'shops', shopId, 'walkins', current.id), {
        position: below.position,
      })
      await updateDoc(doc(db, 'shops', shopId, 'walkins', below.id), {
        position: current.position,
      })
    } catch (err) {
      console.error('Error reordering:', err)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Currently Waiting',
            value: stats.waiting,
            icon: Users,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Avg Wait',
            value: stats.avgWait > 0 ? `${stats.avgWait}m` : '—',
            icon: Timer,
            color: 'bg-amber-100 text-amber-600',
          },
          {
            label: 'Completed Today',
            value: stats.completedToday,
            icon: TrendingUp,
            color: 'bg-emerald-100 text-emerald-600',
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{stat.value}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Upcoming Bookings Warning ── */}
      {upcomingBookings.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              Upcoming Online Bookings
            </span>
          </div>
          <div className="space-y-1">
            {upcomingBookings.slice(0, 5).map((b) => {
              const [h, m] = (b.time || '').split(':')
              const hour = parseInt(h)
              const timeStr = `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
              return (
                <div
                  key={b.id}
                  className="text-xs text-amber-700 flex items-center gap-2"
                >
                  <Clock className="w-3 h-3" />
                  <span className="font-medium">{timeStr}</span>
                  <span>—</span>
                  <span>{b.clientName}</span>
                  {b.serviceName && (
                    <span className="text-amber-500">({b.serviceName})</span>
                  )}
                  {b.staffName && (
                    <span className="text-violet-600">with {b.staffName}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Add Walk-in ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Walk-in Queue</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Add Walk-in
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleAddWalkin} className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="text-sm font-bold text-slate-700 mb-3">New Walk-in</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, clientName: e.target.value }))
                  }
                  placeholder={`Walk-in #${todayWalkinCount + 1}`}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Service
                </label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="">No service selected</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration}min)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Staff Preference
                </label>
                <select
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, staffId: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="">Next available</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Est. Duration (min)
                </label>
                <select
                  value={formData.estimatedDuration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      estimatedDuration: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                >
                  {[15, 30, 45, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} min` : `${d / 60}h${d % 60 ? ` ${d % 60}m` : ''}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Adding…' : 'Add to Queue'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormData({ clientName: '', serviceId: '', staffId: '', estimatedDuration: 30 })
                }}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm transition-all border border-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Active Queue ── */}
        {waiting.length === 0 && inProgress.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">No walk-ins in queue</p>
            <p className="text-xs text-slate-400">
              Add a walk-in client to start the queue.
            </p>
          </div>
        ) : (
          <>
            {/* Waiting */}
            {waiting.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Waiting
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
                    {waiting.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {waiting.map((walkin, idx) => {
                    const waitMinutes = waitTimes.get(walkin.id)
                    return (
                      <div
                        key={walkin.id}
                        className="group flex items-center gap-3 border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        {/* Position */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => moveUp(walkin.id)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-700 text-sm">
                            {idx + 1}
                          </div>
                          <button
                            onClick={() => moveDown(walkin.id)}
                            disabled={idx === waiting.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-slate-900 text-sm truncate">
                              {walkin.clientName}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold rounded-md">
                              WAITING
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            {walkin.serviceName && (
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3 text-blue-400" />
                                {walkin.serviceName}
                              </span>
                            )}
                            {walkin.staffName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-violet-400" />
                                {walkin.staffName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {walkin.estimatedDuration || 30}min
                            </span>
                          </div>
                        </div>

                        {/* Wait time */}
                        <div className="text-right mr-2">
                          <div className="text-sm font-bold text-amber-600">
                            {formatWait(waitMinutes)}
                          </div>
                          <div className="text-[10px] text-slate-400">est. wait</div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startService(walkin.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-all"
                            title="Start Service"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Start</span>
                          </button>
                          <button
                            onClick={() => markNoShow(walkin.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-all"
                            title="No-show"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">No-show</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* In Progress */}
            {inProgress.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-500" />
                  In Progress
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
                    {inProgress.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {inProgress.map((walkin) => (
                    <div
                      key={walkin.id}
                      className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/50 rounded-xl p-3.5 transition-all"
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Play className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {walkin.clientName}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
                            IN PROGRESS
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {walkin.serviceName && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3 text-blue-400" />
                              {walkin.serviceName}
                            </span>
                          )}
                          {walkin.staffName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-violet-400" />
                              {walkin.staffName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right mr-2">
                        <div className="text-sm font-bold text-emerald-600">
                          {formatElapsed(walkin.startedAt)}
                        </div>
                        <div className="text-[10px] text-slate-400">elapsed</div>
                      </div>

                      <button
                        onClick={() => completeService(walkin.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-all"
                        title="Complete"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Complete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Completed Today ── */}
      {completedToday.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              Completed Today
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold rounded-full">
                {completedToday.length}
              </span>
            </h3>
            <ChevronRight
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showCompleted ? 'rotate-90' : ''
              }`}
            />
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2">
              {completedToday.map((walkin) => (
                <div
                  key={walkin.id}
                  className="flex items-center gap-3 border border-slate-100 rounded-lg p-3 bg-slate-50/50"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100">
                    {walkin.status === 'no-show' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 text-sm truncate">
                        {walkin.clientName}
                      </span>
                      <span
                        className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 border ${
                          walkin.status === 'no-show'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                      >
                        {walkin.status === 'no-show' ? 'NO-SHOW' : 'COMPLETED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {walkin.serviceName && <span>{walkin.serviceName}</span>}
                      {walkin.staffName && <span>· {walkin.staffName}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
