import { useState } from 'react'

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
    <div style={{ 
      background: 'white', 
      border: '1px solid #E2E8F0', 
      borderRadius: '12px', 
      padding: '24px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <button 
          onClick={previousMonth}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          ←
        </button>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0F172A' }}>
          {monthNames[month]} {year}
        </h3>
        <button 
          onClick={nextMonth}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          →
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px',
        marginBottom: '8px'
      }}>
        {dayNames.map(day => (
          <div 
            key={day} 
            style={{ 
              textAlign: 'center', 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#64748B',
              padding: '8px 0'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px' 
      }}>
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
            <div
              key={day}
              onClick={() => handleDateClick(day)}
              style={{
                padding: '12px',
                textAlign: 'center',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: available ? 'pointer' : 'default',
                background: selected ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' :
                           available ? '#F0FDF4' :
                           isToday ? '#F1F5F9' : 'transparent',
                color: selected ? 'white' :
                       available ? '#16A34A' :
                       isToday ? '#0F172A' : '#94A3B8',
                border: selected ? 'none' :
                       available ? '1px solid #BBF7D0' :
                       isToday ? '1px solid #CBD5E1' : '1px solid transparent',
                transition: 'all 0.2s',
                transform: selected ? 'scale(1.05)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (available && !selected) {
                  e.target.style.background = '#DCFCE7'
                  e.target.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (available && !selected) {
                  e.target.style.background = '#F0FDF4'
                  e.target.style.transform = 'scale(1)'
                }
              }}
            >
              {day}
            </div>
          )
        })}
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '12px', 
        background: '#F8FAFC', 
        borderRadius: '8px',
        fontSize: '13px',
        color: '#475569'
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              background: '#F0FDF4', 
              border: '1px solid #BBF7D0',
              borderRadius: '4px' 
            }} />
            <span>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '16px', 
              height: '16px', 
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              borderRadius: '4px' 
            }} />
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Calendar
