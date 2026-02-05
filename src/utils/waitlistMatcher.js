/**
 * Waitlist matching utilities.
 * Used when a booking is cancelled or rejected to find matching waitlist entries.
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Convert "HH:MM" to minutes since midnight
 */
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Check if a waitlist entry matches a freed slot.
 *
 * @param {Object} entry - Waitlist entry
 * @param {Object} freedSlot - { date, time, staffId, serviceId }
 * @returns {boolean}
 */
export function doesEntryMatchSlot(entry, freedSlot) {
  // Must be in "waiting" status
  if (entry.status !== 'waiting') return false

  // Service match: entry's serviceId must match or be null (any service)
  if (entry.serviceId && freedSlot.serviceId && entry.serviceId !== freedSlot.serviceId) {
    return false
  }

  // Staff match: entry's staffId must match or be "any"
  if (entry.staffId && entry.staffId !== 'any' && freedSlot.staffId) {
    if (entry.staffId !== freedSlot.staffId) return false
  }

  // Date match
  if (freedSlot.date) {
    // If entry has a specific preferred date, it must match
    if (entry.preferredDate && entry.preferredDate !== freedSlot.date) {
      return false
    }

    // If entry has preferred days, check if the freed slot's day matches
    if (entry.preferredDays && entry.preferredDays.length > 0) {
      const slotDate = new Date(freedSlot.date + 'T12:00:00')
      const dayName = DAY_NAMES[slotDate.getDay()]
      if (!entry.preferredDays.includes(dayName)) {
        return false
      }
    }
  }

  // Time match
  if (freedSlot.time && entry.preferredTimeRange) {
    const slotMinutes = timeToMinutes(freedSlot.time)
    const rangeStart = timeToMinutes(entry.preferredTimeRange.start)
    const rangeEnd = timeToMinutes(entry.preferredTimeRange.end)

    // Special case: "any time" range
    if (!(entry.preferredTimeRange.start === '00:00' && entry.preferredTimeRange.end === '23:59')) {
      if (slotMinutes < rangeStart || slotMinutes > rangeEnd) {
        return false
      }
    }
  }

  return true
}

/**
 * Find all matching waitlist entries for a freed slot.
 *
 * @param {Array} waitlistEntries - All waitlist entries
 * @param {Object} freedSlot - { date, time, staffId, serviceId }
 * @returns {Array} Matching entries, sorted by createdAt (oldest first)
 */
export function findMatchingEntries(waitlistEntries, freedSlot) {
  return waitlistEntries
    .filter((entry) => doesEntryMatchSlot(entry, freedSlot))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}
