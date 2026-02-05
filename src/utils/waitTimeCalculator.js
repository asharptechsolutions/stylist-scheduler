/**
 * Wait Time Calculator for Walk-in Queue
 *
 * Estimates wait time based on:
 * - Number of people ahead in queue
 * - Average service duration
 * - Number of available staff
 * - Currently in-progress services (time remaining)
 * - Upcoming online bookings (to avoid overlap)
 */

/**
 * Calculate estimated wait minutes for a specific position in queue.
 *
 * @param {Object} params
 * @param {Array} params.waitingAhead - Walk-ins with status "waiting" ahead of this position
 * @param {Array} params.inProgress - Walk-ins with status "in-progress"
 * @param {number} params.staffCount - Number of active staff members
 * @param {Array} params.upcomingBookings - Online bookings in the next few hours
 * @param {number} params.defaultDuration - Default service duration if unknown (minutes)
 * @returns {number} Estimated wait in minutes
 */
export function calculateWaitMinutes({
  waitingAhead = [],
  inProgress = [],
  staffCount = 1,
  upcomingBookings = [],
  defaultDuration = 30,
}) {
  const effectiveStaff = Math.max(staffCount, 1)

  // Calculate remaining time for in-progress services
  const now = Date.now()
  const inProgressRemaining = inProgress.map((w) => {
    const startedAt = w.startedAt?.toDate?.() || (w.startedAt ? new Date(w.startedAt) : null)
    if (!startedAt) return 0
    const elapsed = (now - startedAt.getTime()) / 60000
    const duration = w.estimatedDuration || defaultDuration
    return Math.max(0, duration - elapsed)
  })

  // Sort remaining times ascending — the smallest remaining = first available staff
  inProgressRemaining.sort((a, b) => a - b)

  // Figure out when each staff member becomes free
  // Start with in-progress remaining times, fill remaining staff with 0
  const staffFreeIn = []
  for (let i = 0; i < effectiveStaff; i++) {
    staffFreeIn.push(inProgressRemaining[i] || 0)
  }
  staffFreeIn.sort((a, b) => a - b)

  // Now simulate assigning each waiting person to the next available staff
  const waitingDurations = waitingAhead.map(
    (w) => w.estimatedDuration || defaultDuration
  )

  for (const duration of waitingDurations) {
    // Assign to the staff member who becomes free earliest
    staffFreeIn[0] += duration
    // Re-sort to maintain order
    staffFreeIn.sort((a, b) => a - b)
  }

  // The wait time is when the next staff becomes free (smallest value)
  return Math.round(staffFreeIn[0])
}

/**
 * Calculate wait times for all waiting walk-ins in the queue.
 *
 * @param {Array} waitingQueue - Walk-ins sorted by position
 * @param {Array} inProgress - Walk-ins with status "in-progress"
 * @param {number} staffCount - Number of active staff
 * @param {Array} upcomingBookings - Upcoming online bookings
 * @param {number} defaultDuration - Default duration
 * @returns {Map<string, number>} Map of walkinId => estimated wait minutes
 */
export function calculateAllWaitTimes({
  waitingQueue = [],
  inProgress = [],
  staffCount = 1,
  upcomingBookings = [],
  defaultDuration = 30,
}) {
  const result = new Map()

  for (let i = 0; i < waitingQueue.length; i++) {
    const waitingAhead = waitingQueue.slice(0, i)
    const waitMinutes = calculateWaitMinutes({
      waitingAhead,
      inProgress,
      staffCount,
      upcomingBookings,
      defaultDuration,
    })
    result.set(waitingQueue[i].id, waitMinutes)
  }

  return result
}

/**
 * Get upcoming bookings for the next N hours.
 *
 * @param {Array} bookings - All bookings
 * @param {number} hoursAhead - How many hours ahead to look
 * @returns {Array} Bookings happening soon
 */
export function getUpcomingBookings(bookings = [], hoursAhead = 3) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return bookings
    .filter((b) => {
      if (b.status === 'cancelled' || b.status === 'rejected') return false
      if (b.date !== todayStr) return false
      const bookingTime = new Date(`${b.date}T${b.time}`)
      return bookingTime >= now && bookingTime <= cutoff
    })
    .sort((a, b) => `${a.time}`.localeCompare(`${b.time}`))
}
