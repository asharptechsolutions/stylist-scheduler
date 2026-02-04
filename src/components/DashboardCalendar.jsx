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
    // Toggle: click same date again to deselect
    if (dateStr === selectedDate) {
      onSelectDate(null)
    } else {
      onSelectDate(dateStr)
    }
  }

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Compute today at midnight for comparisons
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-lg font-bold text-slate-900">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map(day => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-slate-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
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

          // Check for recurring hours on this day of the week
          const cellDate = new Date(year, month, day)
          const dayOfWeek = cellDate.getDay()
          const hasRecurring = recurringDayFlags[dayOfWeek] && cellDate >= todayDate

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`
                relative p-2 text-center rounded-lg text-sm font-semibold transition-all min-h-[60px] flex flex-col items-center justify-start
                ${selected
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                  : hasData || hasRecurring
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 hover:scale-105 cursor-pointer'
                    : isToday
                      ? 'bg-slate-100 text-slate-900 border border-slate-300'
                      : 'text-slate-400 hover:bg-slate-50 cursor-pointer'}
              `}
            >
              <span className={`text-sm ${isToday && !selected ? 'underline decoration-2 underline-offset-2' : ''}`}>
                {day}
              </span>
              {(hasData || hasRecurring) && (
                <div className="flex gap-1 mt-1 flex-wrap justify-center">
                  {hasRecurring && (
                    <span className={`text-[10px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/25 text-white'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      R
                    </span>
                  )}
                  {availableCount > 0 && (
                    <span className={`text-[10px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/25 text-white'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {availableCount}
                    </span>
                  )}
                  {bookedCount > 0 && (
                    <span className={`text-[10px] font-bold px-1 rounded ${
                      selected
                        ? 'bg-white/25 text-white'
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

      <div className="mt-5 p-3 bg-slate-50 rounded-lg">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {Object.keys(recurringDayFlags).length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded flex items-center justify-center text-[8px] font-bold text-purple-700">R</div>
              <span>Recurring hours</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
            <span>Available slots</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardCalendar
