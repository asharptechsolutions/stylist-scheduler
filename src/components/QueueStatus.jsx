import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  Clock,
  Users,
  Scissors,
  ArrowLeft,
  Plus,
  Tag,
  User,
  Timer,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { calculateAllWaitTimes, calculateWaitMinutes } from '../utils/waitTimeCalculator'

/* ── Logo ── */
function BookFlowMark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
        <Scissors className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-sm font-extrabold tracking-tight text-slate-900">
        Book<span className="text-blue-600">Flow</span>
      </span>
    </Link>
  )
}

function formatWait(minutes) {
  if (minutes == null) return '—'
  if (minutes < 1) return 'Next up!'
  if (minutes < 60) return `~${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`
}

export default function QueueStatus() {
  const { slug } = useParams()

  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [walkins, setWalkins] = useState([])
  const [staff, setStaff] = useState([])
  const [services, setServices] = useState([])

  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinedName, setJoinedName] = useState('')
  const [joinedPosition, setJoinedPosition] = useState(0)
  const [formData, setFormData] = useState({ clientName: '', serviceId: '' })

  // Current time for auto-refresh of elapsed times
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Look up shop
  useEffect(() => {
    const lookupShop = async () => {
      setLoading(true)
      try {
        const q = query(collection(db, 'shops'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          setNotFound(true)
        } else {
          const shopDoc = snapshot.docs[0]
          setShop(shopDoc.data())
          setShopId(shopDoc.id)
        }
      } catch (err) {
        console.error('Error looking up shop:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    lookupShop()
  }, [slug])

  // Real-time listeners
  useEffect(() => {
    if (!shopId) return

    const unsubWalkins = onSnapshot(
      collection(db, 'shops', shopId, 'walkins'),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setWalkins(items)
      }
    )

    const unsubStaff = onSnapshot(
      collection(db, 'shops', shopId, 'staff'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
        setStaff(items)
      }
    )

    const unsubServices = onSnapshot(
      collection(db, 'shops', shopId, 'services'),
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setServices(items)
      }
    )

    return () => {
      unsubWalkins()
      unsubStaff()
      unsubServices()
    }
  }, [shopId])

  const waiting = useMemo(
    () =>
      walkins
        .filter((w) => w.status === 'waiting')
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [walkins]
  )

  const inProgress = useMemo(
    () => walkins.filter((w) => w.status === 'in-progress'),
    [walkins]
  )

  const activeStaffCount = useMemo(
    () => Math.max(staff.length, 1),
    [staff]
  )

  const waitTimes = useMemo(
    () =>
      calculateAllWaitTimes({
        waitingQueue: waiting,
        inProgress,
        staffCount: activeStaffCount,
        defaultDuration: 30,
      }),
    [waiting, inProgress, activeStaffCount]
  )

  // Next available wait time (for someone joining now)
  const nextWaitMinutes = useMemo(() => {
    return calculateWaitMinutes({
      waitingAhead: waiting,
      inProgress,
      staffCount: activeStaffCount,
      defaultDuration: 30,
    })
  }, [waiting, inProgress, activeStaffCount])

  // Today's walkin count for naming
  const todayWalkinCount = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return walkins.filter((w) => {
      const joined = w.joinedAt?.toDate?.() || (w.joinedAt ? new Date(w.joinedAt) : null)
      return joined && joined >= todayStart
    }).length
  }, [walkins])

  const handleJoinQueue = async (e) => {
    e.preventDefault()
    setJoining(true)

    const service = services.find((s) => s.id === formData.serviceId)
    const maxPosition = waiting.length > 0 ? Math.max(...waiting.map((w) => w.position || 0)) : 0
    const position = maxPosition + 1
    const clientName =
      formData.clientName.trim() || `Walk-in #${todayWalkinCount + 1}`

    try {
      await addDoc(collection(db, 'shops', shopId, 'walkins'), {
        clientName,
        serviceId: formData.serviceId || null,
        serviceName: service?.name || null,
        staffId: null,
        staffName: null,
        estimatedDuration: service?.duration || 30,
        status: 'waiting',
        position,
        joinedAt: Timestamp.now(),
        startedAt: null,
        completedAt: null,
        estimatedWaitMinutes: null,
      })

      setJoinedName(clientName)
      setJoinedPosition(position)
      setJoined(true)
      setShowJoinForm(false)
      setFormData({ clientName: '', serviceId: '' })
    } catch (err) {
      console.error('Error joining queue:', err)
    } finally {
      setJoining(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">Loading…</span>
        </div>
      </div>
    )
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-slate-200 text-center max-w-md w-full animate-scale-in">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CalendarIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Shop Not Found</h1>
          <p className="text-slate-600 mb-6">
            We couldn't find a shop with the URL "
            <span className="font-mono text-blue-600">{slug}</span>".
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      {/* ─── Header ─── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
              {(shop?.name || '')[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {shop?.name}
              </h1>
              <p className="text-xs text-slate-500">Live Queue</p>
            </div>
          </div>
          <BookFlowMark />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* ── Success Banner ── */}
        {joined && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-scale-in">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">You're in the queue!</h3>
            <p className="text-slate-600 text-sm mb-2">
              <strong>{joinedName}</strong> — Position #{joinedPosition}
            </p>
            <button
              onClick={() => setJoined(false)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Queue Summary ── */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{waiting.length}</div>
            <div className="text-sm font-medium text-slate-500 mt-1">People Waiting</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Timer className="w-6 h-6 text-amber-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">
              {formatWait(nextWaitMinutes)}
            </div>
            <div className="text-sm font-medium text-slate-500 mt-1">Est. Wait (New)</div>
          </div>
        </div>

        {/* ── Currently Being Served ── */}
        {inProgress.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-emerald-500" />
              Currently Being Served
            </h2>
            <div className="space-y-2">
              {inProgress.map((w) => (
                <div
                  key={w.id}
                  className="bg-white rounded-xl border border-emerald-200 p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{w.clientName}</div>
                    <div className="text-xs text-slate-500">
                      {w.serviceName || 'Service in progress'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Queue List ── */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Queue
          </h2>

          {waiting.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No Wait!</h3>
              <p className="text-sm text-slate-500">
                The queue is empty — you can walk right in!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {waiting.map((walkin, idx) => {
                const waitMinutes = waitTimes.get(walkin.id)
                return (
                  <div
                    key={walkin.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center font-extrabold text-blue-700 text-lg flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-lg truncate">
                        {walkin.clientName}
                      </div>
                      {walkin.serviceName && (
                        <div className="text-sm text-slate-500 flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {walkin.serviceName}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-amber-600">
                        {formatWait(waitMinutes)}
                      </div>
                      <div className="text-xs text-slate-400">est. wait</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Join Queue ── */}
        {!joined && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            {!showJoinForm ? (
              <button
                onClick={() => setShowJoinForm(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Join the Queue
              </button>
            ) : (
              <form onSubmit={handleJoinQueue}>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Join the Queue</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, clientName: e.target.value }))
                      }
                      placeholder="Optional"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
                    />
                  </div>
                  {services.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Service
                      </label>
                      <select
                        value={formData.serviceId}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, serviceId: e.target.value }))
                        }
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
                      >
                        <option value="">Select a service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.duration}min — ${Number(s.price).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={joining}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                    {joining ? 'Joining…' : 'Join Queue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinForm(false)
                      setFormData({ clientName: '', serviceId: '' })
                    }}
                    className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 mt-auto">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <Link
            to={`/shop/${slug}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <CalendarIcon className="w-4 h-4" />
            Book Online
          </Link>
          <span className="text-xs text-slate-400">
            Powered by{' '}
            <Link
              to="/"
              className="font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              BookFlow
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
