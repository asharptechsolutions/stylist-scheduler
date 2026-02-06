import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  Clock,
  CheckCircle,
  Calendar as CalendarIcon,
  ArrowLeft,
  CalendarCheck,
  Tag,
  Users,
  AlertTriangle,
  Bell,
  ListOrdered,
} from 'lucide-react'

/* ── Logo ── */
function SpotBookieMark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
        <CalendarCheck className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-sm font-extrabold tracking-tight text-slate-900">
        Spot<span className="text-amber-500">Bookie</span>
      </span>
    </Link>
  )
}

function formatTimeRange(range) {
  if (!range) return 'Any time'
  const formatT = (t) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
  }
  if (range.start === '00:00' && range.end === '23:59') return 'Any time'
  return `${formatT(range.start)} – ${formatT(range.end)}`
}

function formatDays(days) {
  if (!days || days.length === 0) return 'Any day'
  const labels = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  }
  return days.map((d) => labels[d] || d).join(', ')
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CheckWaitlist() {
  const { slug, refCode } = useParams()

  const [shop, setShop] = useState(null)
  const [shopId, setShopId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [waitlistEntry, setWaitlistEntry] = useState(null)
  const [entryNotFound, setEntryNotFound] = useState(false)
  const [position, setPosition] = useState(null)

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

  // Look up waitlist entry + compute position
  useEffect(() => {
    if (!shopId) return

    const lookupEntry = async () => {
      try {
        const q = query(
          collection(db, 'shops', shopId, 'waitlist'),
          where('refCode', '==', refCode.toUpperCase())
        )
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          setEntryNotFound(true)
          return
        }

        const entryDoc = snapshot.docs[0]
        const entry = { id: entryDoc.id, ...entryDoc.data() }
        setWaitlistEntry(entry)

        // Compute position among entries with same service that are still "waiting"
        const allQ = query(
          collection(db, 'shops', shopId, 'waitlist'),
          where('serviceId', '==', entry.serviceId),
          where('status', '==', 'waiting')
        )
        const allSnapshot = await getDocs(allQ)
        const waitingEntries = allSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

        const idx = waitingEntries.findIndex((e) => e.id === entry.id)
        if (idx >= 0) {
          setPosition(idx + 1)
        }
      } catch (err) {
        console.error('Error looking up waitlist entry:', err)
        setEntryNotFound(true)
      }
    }
    lookupEntry()
  }, [shopId, refCode])

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

  // ── Shop not found ──
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

  // ── Entry not found ──
  if (entryNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
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
                <p className="text-xs text-slate-500">Waitlist Status</p>
              </div>
            </div>
            <SpotBookieMark />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8">
          <div className="bg-white rounded-2xl p-10 shadow-lg border border-slate-200 text-center max-w-md mx-auto animate-scale-in">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Waitlist Entry Not Found
            </h2>
            <p className="text-slate-600 mb-2">
              No waitlist entry found with reference code
            </p>
            <p className="font-mono text-lg font-bold text-blue-600 mb-6">
              {refCode.toUpperCase()}
            </p>
            <Link
              to={`/shop/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              <CalendarIcon className="w-4 h-4" />
              Book an Appointment
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!waitlistEntry) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="spinner" />
          <span className="text-sm font-medium text-slate-500">
            Loading waitlist…
          </span>
        </div>
      </div>
    )
  }

  const statusConfig = {
    waiting: {
      label: 'Waiting',
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: Clock,
    },
    notified: {
      label: 'Slot Available!',
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: Bell,
    },
    booked: {
      label: 'Booked',
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      icon: CheckCircle,
    },
    expired: {
      label: 'Expired',
      color: 'bg-slate-100 text-slate-500 border-slate-200',
      icon: Clock,
    },
  }

  const sc = statusConfig[waitlistEntry.status] || statusConfig.waiting
  const StatusIcon = sc.icon

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString + 'T12:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
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
              <p className="text-xs text-slate-500">Waitlist Status</p>
            </div>
          </div>
          <SpotBookieMark />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        <div className="max-w-lg mx-auto animate-fade-in">
          {/* ─── Notified Banner ─── */}
          {waitlistEntry.status === 'notified' && (
            <div className="mb-6 animate-scale-in">
              <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-100/50 p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  A Slot Is Available!
                </h3>
                <p className="text-slate-600 mb-4">
                  A slot has opened up for {waitlistEntry.serviceName}. Book now
                  before it's taken!
                </p>
                {waitlistEntry.notifiedSlot && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium mb-4">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDate(waitlistEntry.notifiedSlot.date)} at{' '}
                    {formatTime(waitlistEntry.notifiedSlot.time)}
                    {waitlistEntry.notifiedSlot.staffName && (
                      <span className="text-emerald-600">
                        {' '}
                        with {waitlistEntry.notifiedSlot.staffName}
                      </span>
                    )}
                  </div>
                )}
                <div>
                  <Link
                    to={`/shop/${slug}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Book Now →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ─── Details Card ─── */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Waitlist Status
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Reference:{' '}
              <span className="font-mono font-bold text-blue-600">
                {(waitlistEntry.refCode || refCode).toUpperCase()}
              </span>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Status</span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border ${sc.color}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {sc.label}
              </span>
            </div>

            {/* Position */}
            {waitlistEntry.status === 'waiting' && position != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Position
                </span>
                <div className="flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-blue-500" />
                  <span className="font-bold text-slate-900 text-lg">
                    #{position}
                  </span>
                  <span className="text-sm text-slate-500">in line</span>
                </div>
              </div>
            )}

            {/* Service */}
            {waitlistEntry.serviceName && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-semibold text-slate-800">
                  {waitlistEntry.serviceName}
                </span>
              </div>
            )}

            {/* Staff */}
            {waitlistEntry.staffName && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-violet-600" />
                </div>
                <span className="font-semibold text-slate-800">
                  {waitlistEntry.staffName}
                </span>
              </div>
            )}

            {/* Preferred date */}
            {waitlistEntry.preferredDate && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-slate-600" />
                </div>
                <span className="text-sm text-slate-700">
                  Preferred: {formatDate(waitlistEntry.preferredDate)}
                </span>
              </div>
            )}

            {/* Preferred days */}
            {waitlistEntry.preferredDays &&
              waitlistEntry.preferredDays.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4 text-slate-600" />
                  </div>
                  <span className="text-sm text-slate-700">
                    Days: {formatDays(waitlistEntry.preferredDays)}
                  </span>
                </div>
              )}

            {/* Preferred time */}
            {waitlistEntry.preferredTimeRange && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <span className="text-sm text-slate-700">
                  Time: {formatTimeRange(waitlistEntry.preferredTimeRange)}
                </span>
              </div>
            )}

            {/* Joined at */}
            {waitlistEntry.createdAt && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                Joined {timeAgo(waitlistEntry.createdAt)}
              </div>
            )}
          </div>

          {/* ─── Actions ─── */}
          <div className="mt-6 text-center">
            <Link
              to={`/shop/${slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-blue-600/20 hover:shadow-lg"
            >
              <CalendarIcon className="w-4 h-4" />
              {waitlistEntry.status === 'notified'
                ? 'Book Now'
                : 'Check Available Slots'}
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-200 mt-auto">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-center">
          <span className="text-xs text-slate-400">
            Powered by{' '}
            <Link
              to="/"
              className="font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              SpotBookie
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
