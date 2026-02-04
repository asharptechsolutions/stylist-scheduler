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
                p-3 text-center rounded-lg text-sm font-semibold transition-all
                ${selected 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                  : available 
                    ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:scale-105 cursor-pointer' 
                    : isToday 
                      ? 'bg-slate-100 text-slate-900 border border-slate-200' 
                      : 'text-slate-300 cursor-not-allowed'}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mt-5 p-3 bg-slate-50 rounded-lg">
        <div className="flex gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>Available</span>
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

export default Calendar
