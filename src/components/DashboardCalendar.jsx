import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function DashboardCalendar({ slotsByDate, bookingsByDate, selectedDate, onSelectDate, recurringDayFlags = {} }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const getDateString = (day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getDayStats = (day) => {
    const dateStr = getDateString(day)
    const slots = slotsByDate[dateStr] || []
    const bookings = bookingsByDate[dateStr] || []
    const availableCount = slots.filter(s => s.available).length
    const bookedCount = bookings.length
    return { availableCount, bookedCount, hasData: slots.length > 0 || bookings.length > 0 }
  }

  const handleDateClick = (day) => {
    const dateStr = getDateString(day)
    if (dateStr === selectedDate) {
      onSelectDate(null)
    } else {
      onSelectDate(dateStr)
    }
  }

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-base font-bold text-slate-900">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {dayNames.map(day => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-slate-400 py-2 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = getDateString(day)
          const { availableCount, bookedCount, hasData } = getDayStats(day)
          const selected = dateStr === selectedDate
          const today = new Date()
          const isToday = today.getDate() === day &&
                          today.getMonth() === month &&
                          today.getFullYear() === year

          const cellDate = new Date(year, month, day)
          const dayOfWeek = cellDate.getDay()
          const hasRecurring = recurringDayFlags[dayOfWeek] && cellDate >= todayDate

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`
                relative p-2 text-center rounded-lg text-sm font-semibold transition-all duration-200 min-h-[56px] flex flex-col items-center justify-start cursor-pointer
                ${selected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : hasData || hasRecurring
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 hover:border-slate-300'
                    : isToday
                      ? 'text-slate-900 font-bold hover:bg-slate-50'
                      : 'text-slate-400 hover:bg-slate-50'}
              `}
            >
              <span className={`text-sm ${isToday && !selected ? 'relative' : ''}`}>
                {day}
                {isToday && !selected && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
                )}
              </span>
              {(hasData || hasRecurring) && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {hasRecurring && (
                    <span className={`text-[9px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/20 text-white'
                        : 'bg-violet-100 text-violet-700'
                    }`}>
                      R
                    </span>
                  )}
                  {availableCount > 0 && (
                    <span className={`text-[9px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {availableCount}
                    </span>
                  )}
                  {bookedCount > 0 && (
                    <span className={`text-[9px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {bookedCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        {Object.keys(recurringDayFlags).length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-violet-100 border border-violet-200 rounded flex items-center justify-center text-[7px] font-bold text-violet-700">R</div>
            <span>Recurring</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-200 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-blue-100 border border-blue-200 rounded" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-blue-600 rounded" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  )
}

export default DashboardCalendar
