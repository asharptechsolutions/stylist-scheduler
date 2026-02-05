import { useState, useMemo, useEffect, useCallback } from 'react'
import { collection, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  User, Mail, Phone, Calendar, Tag, Users, DollarSign, Clock,
  AlertTriangle, Send, Copy, Check, ChevronDown, ChevronUp,
  Search, Filter, ArrowUpDown, X, MessageSquare, Star, StickyNote,
  Heart, Thermometer, Snowflake, Ghost
} from 'lucide-react'

// ── Helpers ──

function daysBetween(dateStr, now) {
  const d = new Date(dateStr + 'T12:00:00')
  const diff = now.getTime() - d.getTime()
  return Math.floor(diff / 86400000)
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function getClientStatus(daysSinceLastVisit, warningDays, inactiveDays) {
  if (daysSinceLastVisit > 90) return 'lost'
  if (daysSinceLastVisit > inactiveDays) return 'at-risk'
  if (daysSinceLastVisit > warningDays) return 'getting-cold'
  return 'active'
}

const STATUS_CONFIG = {
  'active': { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: Heart, iconColor: 'text-emerald-500' },
  'getting-cold': { label: 'Getting Cold', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Thermometer, iconColor: 'text-amber-500' },
  'at-risk': { label: 'At Risk', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle, iconColor: 'text-orange-500' },
  'lost': { label: 'Lost', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: Ghost, iconColor: 'text-red-500' },
}

// ── Main Component ──

export default function ClientsTab({ shopId, bookings, shop, slug }) {
  const [clientNotes, setClientNotes] = useState({}) // { encodedEmail: { notes, contacted, contactedAt, tags } }
  const [expandedClient, setExpandedClient] = useState(null)
  const [editingNotes, setEditingNotes] = useState(null)
  const [notesText, setNotesText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilterVal, setStatusFilterVal] = useState('all')
  const [sortBy, setSortBy] = useState('lastVisit') // lastVisit, totalVisits, totalSpent
  const [sortDir, setSortDir] = useState('asc') // for lastVisit asc = oldest first (most at-risk); for visits/spent desc = highest first
  const [copiedEmail, setCopiedEmail] = useState(null)
  const [winbackOpen, setWinbackOpen] = useState(false)
  const [messageTemplate, setMessageTemplate] = useState(null) // { email, message }
  const [savingNote, setSavingNote] = useState(false)
  const [markingContacted, setMarkingContacted] = useState(null)

  const warningDays = shop?.winbackSettings?.warningDays || 30
  const inactiveDays = shop?.winbackSettings?.inactiveDays || 60
  const winbackEnabled = shop?.winbackSettings?.enabled !== false

  // Encode email for Firestore doc ID (replace dots and @ with safe chars)
  const encodeEmail = (email) => email.toLowerCase().replace(/\./g, '_dot_').replace(/@/g, '_at_')

  // ── Listen to clientNotes ──
  useEffect(() => {
    if (!shopId) return
    const unsub = onSnapshot(
      collection(db, 'shops', shopId, 'clientNotes'),
      (snapshot) => {
        const notes = {}
        snapshot.docs.forEach(d => {
          notes[d.id] = d.data()
        })
        setClientNotes(notes)
      }
    )
    return () => unsub()
  }, [shopId])

  // ── Compute client data from bookings ──
  const now = useMemo(() => new Date(), [])

  const activeBookings = useMemo(() =>
    bookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || !b.status),
    [bookings]
  )

  const clients = useMemo(() => {
    const map = {}

    activeBookings.forEach(b => {
      const email = b.clientEmail?.toLowerCase()
      if (!email) return

      if (!map[email]) {
        map[email] = {
          email,
          name: b.clientName || email,
          phone: b.clientPhone || '',
          totalVisits: 0,
          totalSpent: 0,
          lastVisitDate: null,
          firstVisitDate: null,
          bookings: [],
          serviceFrequency: {},
          staffFrequency: {},
        }
      }

      const client = map[email]
      if (b.clientName) client.name = b.clientName
      if (b.clientPhone) client.phone = b.clientPhone
      client.totalVisits++
      client.totalSpent += Number(b.servicePrice) || 0
      client.bookings.push(b)

      if (!client.lastVisitDate || b.date > client.lastVisitDate) {
        client.lastVisitDate = b.date
      }
      if (!client.firstVisitDate || b.date < client.firstVisitDate) {
        client.firstVisitDate = b.date
      }

      // Service frequency
      if (b.serviceName) {
        client.serviceFrequency[b.serviceName] = (client.serviceFrequency[b.serviceName] || 0) + 1
      }
      // Staff frequency
      if (b.staffName) {
        client.staffFrequency[b.staffName] = (client.staffFrequency[b.staffName] || 0) + 1
      }
    })

    // Enrich with computed fields
    return Object.values(map).map(client => {
      const daysSince = client.lastVisitDate ? daysBetween(client.lastVisitDate, now) : 999
      const status = getClientStatus(daysSince, warningDays, inactiveDays)
      const favoriteService = Object.entries(client.serviceFrequency)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
      const favoriteStaff = Object.entries(client.staffFrequency)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
      const avgSpending = client.totalVisits > 0 ? client.totalSpent / client.totalVisits : 0
      const encodedEmail = encodeEmail(client.email)
      const noteData = clientNotes[encodedEmail]

      return {
        ...client,
        daysSinceLastVisit: daysSince,
        status,
        favoriteService,
        favoriteStaff,
        avgSpending,
        encodedEmail,
        notes: noteData?.notes || '',
        contacted: noteData?.contacted || false,
        contactedAt: noteData?.contactedAt || null,
        tags: noteData?.tags || [],
      }
    })
  }, [activeBookings, now, warningDays, inactiveDays, clientNotes])

  // ── Status counts ──
  const statusCounts = useMemo(() => {
    const counts = { all: clients.length, active: 0, 'getting-cold': 0, 'at-risk': 0, lost: 0 }
    clients.forEach(c => { counts[c.status]++ })
    return counts
  }, [clients])

  // ── At-risk clients (for win-back alerts) ──
  const atRiskClients = useMemo(() =>
    clients.filter(c => (c.status === 'at-risk' || c.status === 'lost') && !c.contacted),
    [clients]
  )

  // ── Filtered + sorted client list ──
  const filteredClients = useMemo(() => {
    let result = clients

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        c.phone.includes(q)
      )
    }

    // Status filter
    if (statusFilterVal !== 'all') {
      result = result.filter(c => c.status === statusFilterVal)
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'lastVisit') {
        // asc = oldest last visit first (most at-risk on top)
        const comparison = (a.lastVisitDate || '').localeCompare(b.lastVisitDate || '')
        return sortDir === 'asc' ? comparison : -comparison
      }
      if (sortBy === 'totalVisits') {
        return sortDir === 'desc' ? b.totalVisits - a.totalVisits : a.totalVisits - b.totalVisits
      }
      if (sortBy === 'totalSpent') {
        return sortDir === 'desc' ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent
      }
      return 0
    })

    return result
  }, [clients, searchQuery, statusFilterVal, sortBy, sortDir])

  // ── Handlers ──
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir(field === 'lastVisit' ? 'asc' : 'desc')
    }
  }

  const generateWinbackMessage = useCallback((client) => {
    const shopName = shop?.name || 'our shop'
    const bookingLink = `${window.location.origin}${window.location.pathname}#/shop/${slug}`
    const message = `Hi ${client.name.split(' ')[0]}, we miss you at ${shopName}! It's been ${client.daysSinceLastVisit} days since your last visit.${client.favoriteService ? ` Book your next ${client.favoriteService} today:` : ' Book your next appointment:'} ${bookingLink}`
    return message
  }, [shop, slug])

  const openWinbackMessage = (client) => {
    const message = generateWinbackMessage(client)
    setMessageTemplate({ email: client.email, encodedEmail: client.encodedEmail, name: client.name, message })
  }

  const copyToClipboard = async (text, email) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedEmail(email)
      setTimeout(() => setCopiedEmail(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const markAsContacted = async (encodedEmail) => {
    setMarkingContacted(encodedEmail)
    try {
      const ref = doc(db, 'shops', shopId, 'clientNotes', encodedEmail)
      const existing = await getDoc(ref)
      const data = existing.exists() ? existing.data() : {}
      await setDoc(ref, {
        ...data,
        contacted: true,
        contactedAt: new Date().toISOString(),
      })
      setMessageTemplate(null)
    } catch (err) {
      console.error('Error marking as contacted:', err)
    } finally {
      setMarkingContacted(null)
    }
  }

  const resetContacted = async (encodedEmail) => {
    try {
      const ref = doc(db, 'shops', shopId, 'clientNotes', encodedEmail)
      const existing = await getDoc(ref)
      const data = existing.exists() ? existing.data() : {}
      await setDoc(ref, { ...data, contacted: false, contactedAt: null })
    } catch (err) {
      console.error('Error resetting contacted status:', err)
    }
  }

  const saveNotes = async (encodedEmail) => {
    setSavingNote(true)
    try {
      const ref = doc(db, 'shops', shopId, 'clientNotes', encodedEmail)
      const existing = await getDoc(ref)
      const data = existing.exists() ? existing.data() : {}
      await setDoc(ref, { ...data, notes: notesText })
      setEditingNotes(null)
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSavingNote(false)
    }
  }

  // ── Render ──
  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Win-back Alerts Section ── */}
      {winbackEnabled && atRiskClients.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setWinbackOpen(!winbackOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {atRiskClients.length} client{atRiskClients.length !== 1 ? 's' : ''} need{atRiskClients.length === 1 ? 's' : ''} attention
                </h3>
                <p className="text-xs text-slate-500">
                  Haven't visited in over {inactiveDays} days — send a win-back message to re-engage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold rounded-lg">
                {atRiskClients.length}
              </span>
              {winbackOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>

          {winbackOpen && (
            <div className="mt-4 space-y-2.5">
              {atRiskClients
                .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
                .map(client => (
                  <div key={client.email} className="bg-white rounded-xl border border-orange-100 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm truncate">{client.name}</span>
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${STATUS_CONFIG[client.status].bg} ${STATUS_CONFIG[client.status].text} ${STATUS_CONFIG[client.status].border}`}>
                            {client.daysSinceLastVisit} days ago
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                          <span>Last: {formatDate(client.lastVisitDate)}</span>
                          {client.favoriteService && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-blue-600">Loves {client.favoriteService}</span>
                            </>
                          )}
                          <span className="text-slate-300">·</span>
                          <span>{client.totalVisits} visit{client.totalVisits !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openWinbackMessage(client) }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Win-back
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Win-back Message Modal ── */}
      {messageTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Win-back Message</h3>
                <p className="text-sm text-slate-500">Send to {messageTemplate.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
              <textarea
                value={messageTemplate.message}
                onChange={(e) => setMessageTemplate({ ...messageTemplate, message: e.target.value })}
                rows={4}
                className="w-full bg-transparent text-sm text-slate-700 resize-none focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  copyToClipboard(messageTemplate.message, messageTemplate.email)
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-600/20"
              >
                {copiedEmail === messageTemplate.email ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>
              <button
                onClick={() => markAsContacted(messageTemplate.encodedEmail)}
                disabled={markingContacted === messageTemplate.encodedEmail}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Mark Contacted
              </button>
              <button
                onClick={() => setMessageTemplate(null)}
                className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm transition-all border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: statusCounts.all, icon: Users, color: 'bg-blue-100 text-blue-600' },
          { label: 'Active', value: statusCounts.active, icon: Heart, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Getting Cold', value: statusCounts['getting-cold'], icon: Thermometer, color: 'bg-amber-100 text-amber-600' },
          { label: 'At Risk / Lost', value: statusCounts['at-risk'] + statusCounts.lost, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{card.value}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{card.label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Client List ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">All Clients</h2>
            <p className="text-xs text-slate-500">Derived from booking history</p>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
            {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search + Filter bar */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'getting-cold', label: 'Cold' },
              { key: 'at-risk', label: 'At Risk' },
              { key: 'lost', label: 'Lost' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilterVal(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilterVal === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                  statusFilterVal === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {statusCounts[tab.key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Sort buttons */}
          <div className="flex items-center gap-1">
            {[
              { key: 'lastVisit', label: 'Last Visit' },
              { key: 'totalVisits', label: 'Visits' },
              { key: 'totalSpent', label: 'Spent' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => handleSort(s.key)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  sortBy === s.key
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s.label}
                {sortBy === s.key && (
                  <ArrowUpDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Client rows */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">No clients found</p>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Try a different search term' : 'Client data will appear as bookings come in'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map(client => {
              const isExpanded = expandedClient === client.email
              const statusConfig = STATUS_CONFIG[client.status]
              const StatusIcon = statusConfig.icon

              return (
                <div key={client.email} className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all">
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50/50 transition-all"
                    onClick={() => setExpandedClient(isExpanded ? null : client.email)}
                  >
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm truncate">{client.name}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {client.contacted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md border bg-blue-50 text-blue-600 border-blue-200">
                            <Send className="w-2.5 h-2.5" />
                            Contacted
                          </span>
                        )}
                        {client.notes && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md border bg-violet-50 text-violet-600 border-violet-200">
                            <StickyNote className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </span>
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-900">{client.totalVisits}</div>
                        <div className="text-[10px] text-slate-400">visits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-blue-600">{formatCurrency(client.totalSpent)}</div>
                        <div className="text-[10px] text-slate-400">spent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-slate-700">{formatDate(client.lastVisitDate)}</div>
                        <div className="text-[10px] text-slate-400">last visit</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(client.status === 'at-risk' || client.status === 'lost') && !client.contacted && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openWinbackMessage(client) }}
                          className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-all"
                          title="Send win-back message"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded detail view */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-5">
                      {/* Mobile stats row */}
                      <div className="sm:hidden grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg border border-slate-100 p-3 text-center">
                          <div className="text-lg font-bold text-slate-900">{client.totalVisits}</div>
                          <div className="text-[10px] text-slate-400">visits</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-3 text-center">
                          <div className="text-lg font-bold text-blue-600">{formatCurrency(client.totalSpent)}</div>
                          <div className="text-[10px] text-slate-400">spent</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-3 text-center">
                          <div className="text-sm font-bold text-slate-700">{formatDate(client.lastVisitDate)}</div>
                          <div className="text-[10px] text-slate-400">last visit</div>
                        </div>
                      </div>

                      {/* Quick stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg border border-slate-100 p-3">
                          <div className="text-xs text-slate-500 mb-0.5">Avg per Visit</div>
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(client.avgSpending)}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-3">
                          <div className="text-xs text-slate-500 mb-0.5">First Visit</div>
                          <div className="text-sm font-bold text-slate-900">{formatDate(client.firstVisitDate)}</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-3">
                          <div className="text-xs text-slate-500 mb-0.5">Days Since Last Visit</div>
                          <div className="text-sm font-bold text-slate-900">{client.daysSinceLastVisit}d</div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-3">
                          <div className="text-xs text-slate-500 mb-0.5">Favorite Service</div>
                          <div className="text-sm font-bold text-blue-600 truncate">{client.favoriteService || '—'}</div>
                        </div>
                      </div>

                      {/* Services Used */}
                      <div className="bg-white rounded-lg border border-slate-100 p-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-500" />
                          Services Used
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(client.serviceFrequency)
                            .sort((a, b) => b[1] - a[1])
                            .map(([service, count]) => (
                              <span key={service} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium">
                                {service}
                                <span className="bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{count}×</span>
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Staff Seen */}
                      {Object.keys(client.staffFrequency).length > 0 && (
                        <div className="bg-white rounded-lg border border-slate-100 p-4">
                          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-violet-500" />
                            Staff Members Seen
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(client.staffFrequency)
                              .sort((a, b) => b[1] - a[1])
                              .map(([staffName, count]) => (
                                <span key={staffName} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-medium">
                                  {staffName}
                                  <span className="bg-violet-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{count}×</span>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Booking History */}
                      <div className="bg-white rounded-lg border border-slate-100 p-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                          Booking History
                          <span className="text-xs font-medium text-slate-400">({client.bookings.length})</span>
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {client.bookings
                            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
                            .map((booking, idx) => (
                              <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">{formatDate(booking.date)}</span>
                                  <span className="text-slate-400">{booking.time}</span>
                                  {booking.serviceName && (
                                    <span className="text-blue-600">{booking.serviceName}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {booking.staffName && (
                                    <span className="text-violet-600">{booking.staffName}</span>
                                  )}
                                  {booking.servicePrice != null && (
                                    <span className="font-semibold text-slate-900">{formatCurrency(booking.servicePrice)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="bg-white rounded-lg border border-slate-100 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                            Notes
                          </h4>
                          {editingNotes !== client.encodedEmail && (
                            <button
                              onClick={() => {
                                setEditingNotes(client.encodedEmail)
                                setNotesText(client.notes || '')
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              {client.notes ? 'Edit' : 'Add Notes'}
                            </button>
                          )}
                        </div>

                        {editingNotes === client.encodedEmail ? (
                          <div className="space-y-2">
                            <textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder="Add notes about this client (e.g., preferences, allergies, favorite styles...)"
                              rows={3}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveNotes(client.encodedEmail)}
                                disabled={savingNote}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                {savingNote ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingNotes(null)}
                                className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {client.notes || 'No notes yet. Click "Add Notes" to save preferences, allergies, or anything useful.'}
                          </p>
                        )}
                      </div>

                      {/* Contact status actions */}
                      {client.contacted && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <Check className="w-4 h-4" />
                            <span className="font-medium">
                              Contacted{client.contactedAt ? ` on ${new Date(client.contactedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                            </span>
                          </div>
                          <button
                            onClick={() => resetContacted(client.encodedEmail)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Reset
                          </button>
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
    </div>
  )
}
