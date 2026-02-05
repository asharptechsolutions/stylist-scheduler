import { useMemo, useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, Users, Tag, BarChart3,
  Clock, User, Scissors, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'

// ── Helpers ──

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function pctChange(current, previous) {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return ((current - previous) / previous) * 100
}

// ── Component ──

export default function AnalyticsTab({ bookings }) {
  const [hoveredRevenueBar, setHoveredRevenueBar] = useState(null)
  const [hoveredBookingBar, setHoveredBookingBar] = useState(null)

  // Only count confirmed/pending for revenue; all statuses for booking counts unless noted
  const activeBookings = useMemo(() =>
    bookings.filter(b => b.status === 'confirmed' || b.status === 'pending' || !b.status),
    [bookings]
  )

  // ── Date boundaries ──
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayStr = useMemo(() => toDateStr(today), [today])

  const thisWeekStart = useMemo(() => getMonday(today), [today])
  const thisWeekEnd = useMemo(() => {
    const d = new Date(thisWeekStart)
    d.setDate(d.getDate() + 6)
    return d
  }, [thisWeekStart])

  const lastWeekStart = useMemo(() => {
    const d = new Date(thisWeekStart)
    d.setDate(d.getDate() - 7)
    return d
  }, [thisWeekStart])
  const lastWeekEnd = useMemo(() => {
    const d = new Date(lastWeekStart)
    d.setDate(d.getDate() + 6)
    return d
  }, [lastWeekStart])

  const thisMonthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const lastMonthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), [today])
  const lastMonthEnd = useMemo(() => {
    const d = new Date(thisMonthStart)
    d.setDate(d.getDate() - 1)
    return d
  }, [thisMonthStart])

  const yesterday = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return toDateStr(d)
  }, [today])

  // ── Revenue calculations ──
  const revenue = useMemo(() => {
    const sum = (list) => list.reduce((s, b) => s + (Number(b.servicePrice) || 0), 0)
    const inRange = (b, start, end) => b.date >= toDateStr(start) && b.date <= toDateStr(end)

    const todayRevenue = sum(activeBookings.filter(b => b.date === todayStr))
    const yesterdayRevenue = sum(activeBookings.filter(b => b.date === yesterday))

    const thisWeekRevenue = sum(activeBookings.filter(b => inRange(b, thisWeekStart, thisWeekEnd)))
    const lastWeekRevenue = sum(activeBookings.filter(b => inRange(b, lastWeekStart, lastWeekEnd)))

    const thisMonthRevenue = sum(activeBookings.filter(b => inRange(b, thisMonthStart, today)))
    const lastMonthRevenue = sum(activeBookings.filter(b => inRange(b, lastMonthStart, lastMonthEnd)))

    const allTimeRevenue = sum(activeBookings)

    return {
      today: todayRevenue,
      todayChange: pctChange(todayRevenue, yesterdayRevenue),
      week: thisWeekRevenue,
      weekChange: pctChange(thisWeekRevenue, lastWeekRevenue),
      month: thisMonthRevenue,
      monthChange: pctChange(thisMonthRevenue, lastMonthRevenue),
      allTime: allTimeRevenue,
    }
  }, [activeBookings, todayStr, yesterday, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, thisMonthStart, lastMonthEnd, today])

  // ── Last 14 days data ──
  const last14Days = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push(toDateStr(d))
    }
    return days
  }, [today])

  const dailyRevenue = useMemo(() => {
    const map = {}
    last14Days.forEach(d => { map[d] = 0 })
    activeBookings.forEach(b => {
      if (map[b.date] !== undefined) {
        map[b.date] += Number(b.servicePrice) || 0
      }
    })
    return last14Days.map(d => ({ date: d, value: map[d] }))
  }, [activeBookings, last14Days])

  const maxRevenue = useMemo(() => Math.max(...dailyRevenue.map(d => d.value), 1), [dailyRevenue])

  // ── Booking trends ──
  const dailyBookings = useMemo(() => {
    const confirmedMap = {}
    const cancelledMap = {}
    last14Days.forEach(d => { confirmedMap[d] = 0; cancelledMap[d] = 0 })

    bookings.forEach(b => {
      if (confirmedMap[b.date] !== undefined) {
        if (b.status === 'cancelled' || b.status === 'rejected') {
          cancelledMap[b.date]++
        } else {
          confirmedMap[b.date]++
        }
      }
    })

    return last14Days.map(d => ({
      date: d,
      confirmed: confirmedMap[d],
      cancelled: cancelledMap[d],
      total: confirmedMap[d] + cancelledMap[d],
    }))
  }, [bookings, last14Days])

  const maxBookingsDay = useMemo(() => Math.max(...dailyBookings.map(d => d.total), 1), [dailyBookings])

  const completionRate = useMemo(() => {
    const total = bookings.length
    if (total === 0) return 100
    const cancelled = bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected').length
    return Math.round(((total - cancelled) / total) * 100)
  }, [bookings])

  // ── Busiest times heatmap ──
  const heatmapData = useMemo(() => {
    // 7 days × 24 hours, but we'll only show hours 7-21 (7am-9pm) for relevance
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))

    activeBookings.forEach(b => {
      if (!b.date || !b.time) return
      const d = new Date(b.date + 'T12:00:00')
      const dayIdx = d.getDay() // 0=Sun
      const hour = parseInt(b.time.split(':')[0], 10)
      if (!isNaN(dayIdx) && !isNaN(hour)) {
        grid[dayIdx][hour]++
      }
    })

    // Find max for color scaling
    let max = 0
    grid.forEach(row => row.forEach(v => { if (v > max) max = v }))

    return { grid, max }
  }, [activeBookings])

  // ── Top Services ──
  const topServices = useMemo(() => {
    const map = {}
    activeBookings.forEach(b => {
      const name = b.serviceName || 'Unknown'
      if (!map[name]) map[name] = { name, count: 0, revenue: 0 }
      map[name].count++
      map[name].revenue += Number(b.servicePrice) || 0
    })
    return Object.values(map)
      .map(s => ({ ...s, avgRevenue: s.count > 0 ? s.revenue / s.count : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [activeBookings])

  // ── Staff Performance ──
  const staffPerformance = useMemo(() => {
    const map = {}
    activeBookings.forEach(b => {
      const name = b.staffName || 'Unassigned'
      if (!map[name]) map[name] = { name, count: 0, revenue: 0, clients: new Set() }
      map[name].count++
      map[name].revenue += Number(b.servicePrice) || 0
      if (b.clientEmail) map[name].clients.add(b.clientEmail.toLowerCase())
    })
    return Object.values(map)
      .map(s => ({ ...s, clientCount: s.clients.size }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [activeBookings])

  // ── Client Insights ──
  const clientInsights = useMemo(() => {
    const allEmails = activeBookings.map(b => b.clientEmail?.toLowerCase()).filter(Boolean)
    const uniqueClients = new Set(allEmails).size

    // Clients this month
    const thisMonthBookings = activeBookings.filter(b => b.date >= toDateStr(thisMonthStart) && b.date <= todayStr)
    const thisMonthEmails = new Set(thisMonthBookings.map(b => b.clientEmail?.toLowerCase()).filter(Boolean))

    // All-time emails before this month
    const beforeMonthBookings = activeBookings.filter(b => b.date < toDateStr(thisMonthStart))
    const beforeMonthEmails = new Set(beforeMonthBookings.map(b => b.clientEmail?.toLowerCase()).filter(Boolean))

    let newThisMonth = 0
    let returningThisMonth = 0
    thisMonthEmails.forEach(email => {
      if (beforeMonthEmails.has(email)) returningThisMonth++
      else newThisMonth++
    })

    // Top clients by frequency
    const freq = {}
    activeBookings.forEach(b => {
      const email = b.clientEmail?.toLowerCase()
      if (!email) return
      if (!freq[email]) freq[email] = { email, name: b.clientName || email, count: 0 }
      freq[email].count++
      // Keep the latest name
      if (b.clientName) freq[email].name = b.clientName
    })
    const topClients = Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 10)

    const avgBookingsPerClient = uniqueClients > 0 ? (activeBookings.length / uniqueClients) : 0

    return { uniqueClients, newThisMonth, returningThisMonth, topClients, avgBookingsPerClient }
  }, [activeBookings, thisMonthStart, todayStr])

  // ── Render helpers ──

  const ChangeIndicator = ({ value, suffix = 'vs prev' }) => {
    if (value === 0) return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-slate-400">
        <Minus className="w-3 h-3" /> 0% {suffix}
      </span>
    )
    const positive = value > 0
    return (
      <span className={`flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {positive ? '+' : ''}{Math.round(value)}% {suffix}
      </span>
    )
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const displayHours = Array.from({ length: 15 }, (_, i) => i + 7) // 7am–9pm

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Revenue Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: revenue.today, change: revenue.todayChange, suffix: 'vs yesterday', icon: DollarSign, color: 'bg-blue-100 text-blue-600' },
          { label: "This Week", value: revenue.week, change: revenue.weekChange, suffix: 'vs last week', icon: TrendingUp, color: 'bg-violet-100 text-violet-600' },
          { label: "This Month", value: revenue.month, change: revenue.monthChange, suffix: 'vs last month', icon: Calendar, color: 'bg-emerald-100 text-emerald-600' },
          { label: "All-time Revenue", value: revenue.allTime, change: null, icon: BarChart3, color: 'bg-amber-100 text-amber-600' },
        ].map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(card.value)}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5 mb-1">{card.label}</div>
              {card.change !== null && <ChangeIndicator value={card.change} suffix={card.suffix} />}
            </div>
          )
        })}
      </div>

      {/* ── Revenue Chart (14 days) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Revenue — Last 14 Days</h3>
        <p className="text-xs text-slate-500 mb-5">Daily revenue from confirmed & pending bookings</p>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Y-axis labels + bars */}
            <div className="flex items-end gap-0">
              {/* Y-axis */}
              <div className="flex flex-col justify-between h-48 pr-2 text-right flex-shrink-0 w-16">
                <span className="text-[10px] text-slate-400 font-medium">{formatCurrency(maxRevenue)}</span>
                <span className="text-[10px] text-slate-400 font-medium">{formatCurrency(maxRevenue / 2)}</span>
                <span className="text-[10px] text-slate-400 font-medium">$0</span>
              </div>

              {/* Bars */}
              <div className="flex-1 flex items-end gap-1 h-48 border-b border-l border-slate-200 pl-1 pb-0 relative">
                {dailyRevenue.map((d, i) => {
                  const pct = maxRevenue > 0 ? (d.value / maxRevenue) * 100 : 0
                  const isHovered = hoveredRevenueBar === i
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                      onMouseEnter={() => setHoveredRevenueBar(i)}
                      onMouseLeave={() => setHoveredRevenueBar(null)}
                      onTouchStart={() => setHoveredRevenueBar(i)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10">
                          {formatCurrency(d.value)}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
                        </div>
                      )}
                      <div
                        className="w-full rounded-t-md transition-all duration-200 cursor-pointer"
                        style={{
                          height: `${Math.max(pct, d.value > 0 ? 2 : 0)}%`,
                          background: isHovered
                            ? 'linear-gradient(to top, #2563eb, #60a5fa)'
                            : 'linear-gradient(to top, #3b82f6, #93c5fd)',
                          minHeight: d.value > 0 ? '4px' : '0px',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex ml-16 pl-1">
              {dailyRevenue.map((d) => (
                <div key={d.date} className="flex-1 text-center">
                  <div className="text-[9px] text-slate-500 font-medium mt-1.5">{formatDayName(d.date)}</div>
                  <div className="text-[9px] text-slate-400">{formatShortDate(d.date)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Booking Trends (14 days) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Booking Trends — Last 14 Days</h3>
            <p className="text-xs text-slate-500 mb-5">Daily bookings breakdown</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> Cancelled
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold">
              {completionRate}% completion
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex items-end gap-0">
              <div className="flex flex-col justify-between h-40 pr-2 text-right flex-shrink-0 w-16">
                <span className="text-[10px] text-slate-400 font-medium">{maxBookingsDay}</span>
                <span className="text-[10px] text-slate-400 font-medium">{Math.round(maxBookingsDay / 2)}</span>
                <span className="text-[10px] text-slate-400 font-medium">0</span>
              </div>

              <div className="flex-1 flex items-end gap-1 h-40 border-b border-l border-slate-200 pl-1 relative">
                {dailyBookings.map((d, i) => {
                  const confirmedPct = maxBookingsDay > 0 ? (d.confirmed / maxBookingsDay) * 100 : 0
                  const cancelledPct = maxBookingsDay > 0 ? (d.cancelled / maxBookingsDay) * 100 : 0
                  const isHovered = hoveredBookingBar === i
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center justify-end h-full relative"
                      onMouseEnter={() => setHoveredBookingBar(i)}
                      onMouseLeave={() => setHoveredBookingBar(null)}
                      onTouchStart={() => setHoveredBookingBar(i)}
                    >
                      {isHovered && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10">
                          {d.confirmed} confirmed, {d.cancelled} cancelled
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
                        </div>
                      )}
                      {/* Stacked bar: cancelled on top of confirmed */}
                      <div className="w-full flex flex-col items-stretch">
                        {d.cancelled > 0 && (
                          <div
                            className="w-full rounded-t-md bg-red-400 transition-all duration-200"
                            style={{ height: `${Math.max(cancelledPct, 2)}%` }}
                          />
                        )}
                        {d.confirmed > 0 && (
                          <div
                            className={`w-full bg-blue-500 transition-all duration-200 ${d.cancelled === 0 ? 'rounded-t-md' : ''}`}
                            style={{ height: `${Math.max(confirmedPct, 2)}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex ml-16 pl-1">
              {dailyBookings.map((d) => (
                <div key={d.date} className="flex-1 text-center">
                  <div className="text-[9px] text-slate-500 font-medium mt-1.5">{formatDayName(d.date)}</div>
                  <div className="text-[9px] text-slate-400">{formatShortDate(d.date)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Busiest Times Heatmap ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Busiest Times</h3>
        <p className="text-xs text-slate-500 mb-5">Booking density by day of week and hour</p>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12" />
                  {displayHours.map(h => (
                    <th key={h} className="text-[10px] text-slate-400 font-medium pb-2 text-center px-0.5">
                      {h % 12 || 12}{h >= 12 ? 'p' : 'a'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => (
                  <tr key={dayIdx}>
                    <td className="text-[11px] text-slate-500 font-semibold pr-2 py-0.5 text-right">
                      {dayLabels[dayIdx]}
                    </td>
                    {displayHours.map(h => {
                      const count = heatmapData.grid[dayIdx][h]
                      const max = heatmapData.max || 1
                      const intensity = count / max
                      let bg = 'bg-slate-50'
                      if (count > 0) {
                        if (intensity <= 0.2) bg = 'bg-blue-100'
                        else if (intensity <= 0.4) bg = 'bg-blue-200'
                        else if (intensity <= 0.6) bg = 'bg-blue-300'
                        else if (intensity <= 0.8) bg = 'bg-blue-500 text-white'
                        else bg = 'bg-blue-700 text-white'
                      }
                      return (
                        <td key={h} className="px-0.5 py-0.5">
                          <div
                            className={`w-full aspect-square rounded-sm ${bg} flex items-center justify-center text-[9px] font-bold transition-all hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 cursor-default`}
                            title={`${dayLabels[dayIdx]} ${h}:00 — ${count} booking${count !== 1 ? 's' : ''}`}
                          >
                            {count > 0 ? count : ''}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-[10px] text-slate-400">Less</span>
              {['bg-slate-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'].map((c, i) => (
                <div key={i} className={`w-4 h-4 rounded-sm ${c} border border-slate-200`} />
              ))}
              <span className="text-[10px] text-slate-400">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Services + Staff Performance (side by side on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Services */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Top Services</h3>
          <p className="text-xs text-slate-500 mb-4">Ranked by revenue from confirmed & pending bookings</p>

          {topServices.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No service data yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topServices.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.count} booking{s.count !== 1 ? 's' : ''} · avg {formatCurrency(s.avgRevenue)}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-blue-600 flex-shrink-0">{formatCurrency(s.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Staff Performance</h3>
          <p className="text-xs text-slate-500 mb-4">Bookings, revenue & clients per staff member</p>

          {staffPerformance.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No staff data yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staffPerformance.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.count} booking{s.count !== 1 ? 's' : ''} · {s.clientCount} client{s.clientCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-violet-600 flex-shrink-0">{formatCurrency(s.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Client Insights ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Client Insights</h3>
        <p className="text-xs text-slate-500 mb-5">Understanding your client base</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-center">
            <div className="text-2xl font-extrabold text-slate-900">{clientInsights.uniqueClients}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">Total Unique Clients</div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-center">
            <div className="text-2xl font-extrabold text-emerald-700">{clientInsights.newThisMonth}</div>
            <div className="text-xs font-medium text-emerald-600 mt-0.5">New This Month</div>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
            <div className="text-2xl font-extrabold text-blue-700">{clientInsights.returningThisMonth}</div>
            <div className="text-xs font-medium text-blue-600 mt-0.5">Returning This Month</div>
          </div>
          <div className="bg-violet-50 rounded-xl border border-violet-100 p-4 text-center">
            <div className="text-2xl font-extrabold text-violet-700">{clientInsights.avgBookingsPerClient.toFixed(1)}</div>
            <div className="text-xs font-medium text-violet-600 mt-0.5">Avg Bookings / Client</div>
          </div>
        </div>

        {/* Top Clients */}
        <h4 className="text-sm font-bold text-slate-700 mb-3">Top Clients by Frequency</h4>
        {clientInsights.topClients.length === 0 ? (
          <div className="text-center py-6">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No client data yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clientInsights.topClients.map((c, i) => (
              <div key={c.email} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 truncate">{c.email}</div>
                </div>
                <div className="flex-shrink-0 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                  {c.count} visit{c.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
