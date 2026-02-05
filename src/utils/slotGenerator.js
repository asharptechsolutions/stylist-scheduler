/**
 * Slot generation utilities for recurring weekly hours
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Convert "HH:MM" to minutes since midnight
 */
export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert minutes since midnight to "HH:MM"
 */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Format a date object as "YYYY-MM-DD"
 */
function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Generate time slots for a single staff member on a single date.
 *
 * @param {Object} weeklyHours - The staff member's weeklyHours config
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} serviceDuration - Duration in minutes
 * @param {number} bufferMinutes - Buffer between appointments
 * @param {string} staffId
 * @param {string} staffName
 * @returns {Array} Array of slot objects
 */
export function generateSlotsForDate(weeklyHours, dateStr, serviceDuration, bufferMinutes, staffId, staffName) {
  if (!weeklyHours) return []

  // Use noon to avoid timezone edge cases
  const date = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = date.getDay()
  const dayName = DAY_NAMES[dayOfWeek]
  const dayConfig = weeklyHours[dayName]

  if (!dayConfig || !dayConfig.enabled) return []

  const startMin = timeToMinutes(dayConfig.start)
  const endMin = timeToMinutes(dayConfig.end)
  const breakStart = dayConfig.break ? timeToMinutes(dayConfig.break.start) : null
  const breakEnd = dayConfig.break ? timeToMinutes(dayConfig.break.end) : null

  const step = serviceDuration + bufferMinutes
  const slots = []

  let current = startMin
  while (current + serviceDuration <= endMin) {
    const slotEnd = current + serviceDuration

    // Skip if slot overlaps with break
    if (breakStart !== null && breakEnd !== null) {
      if (current < breakEnd && slotEnd > breakStart) {
        current = breakEnd
        continue
      }
    }

    slots.push({
      id: `wh-${staffId}-${dateStr}-${minutesToTime(current)}`,
      date: dateStr,
      time: minutesToTime(current),
      duration: serviceDuration,
      available: true,
      staffId,
      staffName,
      generated: true,
    })

    current += step
  }

  return slots
}

/**
 * Generate slots for multiple staff members over the next N weeks.
 *
 * @param {Array} staffMembers - Array of staff objects with weeklyHours
 * @param {number} serviceDuration - Duration in minutes
 * @param {number} bufferMinutes - Buffer between appointments (default 0)
 * @param {number} weeksAhead - How many weeks to generate (default 4)
 * @returns {Array} Array of slot objects
 */
export function generateAllSlots(staffMembers, serviceDuration, bufferMinutes = 0, weeksAhead = 4) {
  const slots = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + weeksAhead * 7)

  for (const staff of staffMembers) {
    if (!staff.weeklyHours) continue

    const current = new Date(today)
    while (current < endDate) {
      const dateStr = formatDateStr(current)
      const daySlots = generateSlotsForDate(
        staff.weeklyHours,
        dateStr,
        serviceDuration,
        bufferMinutes,
        staff.id,
        staff.name
      )
      slots.push(...daySlots)
      current.setDate(current.getDate() + 1)
    }
  }

  return slots
}

/**
 * Filter out slots that conflict with existing bookings.
 * Two appointments conflict if there isn't at least `bufferMinutes` gap between them.
 *
 * @param {Array} slots - Candidate slots (generated + manual)
 * @param {Array} bookings - Existing bookings
 * @param {number} bufferMinutes - Required gap between appointments
 * @returns {Array} Slots with no booking conflicts
 */
export function filterBookedSlots(slots, bookings, bufferMinutes = 0) {
  // Only consider active bookings (pending or confirmed) for conflict detection
  const activeBookings = bookings.filter(b => !b.status || b.status === 'pending' || b.status === 'confirmed')

  return slots.filter((slot) => {
    const slotStart = timeToMinutes(slot.time)
    const slotEnd = slotStart + slot.duration

    const hasConflict = activeBookings.some((booking) => {
      // Must be same staff (or unassigned)
      if (slot.staffId && booking.staffId && booking.staffId !== slot.staffId) return false
      if (booking.date !== slot.date) return false

      const bookingStart = timeToMinutes(booking.time)
      const bookingDuration = booking.serviceDuration || booking.duration || slot.duration
      const bookingEnd = bookingStart + bookingDuration

      // No conflict if there's enough gap
      const noConflict =
        slotEnd + bufferMinutes <= bookingStart ||
        bookingEnd + bufferMinutes <= slotStart
      return !noConflict
    })

    return !hasConflict
  })
}

/**
 * Merge generated slots with manual availability slots.
 * Manual slots take priority — if a manual slot exists at the same staff+date+time,
 * the generated slot is dropped.
 *
 * @param {Array} generatedSlots
 * @param {Array} manualSlots
 * @returns {Array} Merged array
 */
export function mergeSlots(generatedSlots, manualSlots) {
  const manualKeys = new Set(
    manualSlots.map((s) => `${s.staffId || ''}-${s.date}-${s.time}`)
  )

  const uniqueGenerated = generatedSlots.filter((s) => {
    const key = `${s.staffId || ''}-${s.date}-${s.time}`
    return !manualKeys.has(key)
  })

  return [...manualSlots, ...uniqueGenerated]
}
