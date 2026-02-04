import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function Calendar({ availableDates, selectedDate, onSelectDate }) {
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

  const isDateAvailable = (day) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return availableDates.includes(dateString)
  }

  const isDateSelected = (day) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return dateString === selectedDate
  }

  const handleDateClick = (day) => {
    if (isDateAvailable(day)) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      onSelectDate(dateString)
    }
  }

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
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
          const available = isDateAvailable(day)
          const selected = isDateSelected(day)
          const today = new Date()
          const isToday = today.getDate() === day &&
                          today.getMonth() === month &&
                          today.getFullYear() === year

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={!available}
              className={`
                relative p-2.5 sm:p-3 text-center rounded-lg text-sm font-semibold transition-all duration-200
                ${selected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : available
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer'
                    : isToday
                      ? 'text-slate-900 font-bold'
                      : 'text-slate-300 cursor-not-allowed'}
              `}
            >
              {day}
              {isToday && !selected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex gap-5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-emerald-50 border border-emerald-200 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-600 rounded" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-blue-500 rounded-full" />
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}

export default Calendar
