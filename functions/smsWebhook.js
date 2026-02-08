const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const twilio = require('twilio')

const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID')
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = defineSecret('TWILIO_PHONE_NUMBER')

const db = getFirestore()

// ============================================================
// CONVERSATION STATE MACHINE
// ============================================================
// States: idle, awaiting_service, awaiting_date, awaiting_time,
//         awaiting_staff, confirming, awaiting_payment, complete

// ============================================================
// SIMPLE INTENT / ENTITY EXTRACTION (keyword-based)
// TODO: Replace with Anthropic Claude API for natural language understanding
// ============================================================

function detectIntent(text) {
  const lower = text.toLowerCase().trim()

  if (/^(cancel|stop|nevermind|never mind)$/i.test(lower)) return 'cancel'
  if (/^(help|info|commands|\?)$/i.test(lower)) return 'help'
  if (/^(hours|open|close)$/i.test(lower)) return 'hours'
  if (/^(hi|hello|hey|yo|sup)$/i.test(lower)) return 'greeting'
  if (/(book|appointment|schedule|reserve)/i.test(lower)) return 'book'
  if (/^(yes|yeah|yep|y|confirm|ok|sure|correct)$/i.test(lower)) return 'confirm'
  if (/^(no|nah|nope|n|wrong)$/i.test(lower)) return 'deny'
  if (/^any$/i.test(lower)) return 'any'

  return 'unknown'
}

function extractDate(text) {
  const lower = text.toLowerCase().trim()
  const now = new Date()

  if (/today/i.test(lower)) {
    return formatDateISO(now)
  }
  if (/tomorrow/i.test(lower)) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    return formatDateISO(d)
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const d = new Date(now)
      const diff = (i - d.getDay() + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      return formatDateISO(d)
    }
  }

  // MM/DD or MM-DD
  const mdMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})/)
  if (mdMatch) {
    const month = parseInt(mdMatch[1]) - 1
    const day = parseInt(mdMatch[2])
    const d = new Date(now.getFullYear(), month, day)
    if (d < now) d.setFullYear(d.getFullYear() + 1)
    return formatDateISO(d)
  }

  return null
}

function extractTime(text) {
  const lower = text.toLowerCase().trim()

  // "3pm", "3:00pm", "3:00 pm", "15:00"
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const ampm = timeMatch[3]?.toLowerCase()

    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    // If no am/pm and hour <= 7, assume PM (business hours heuristic)
    if (!ampm && hour >= 1 && hour <= 7) hour += 12

    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  if (/morning/i.test(lower)) return '10:00'
  if (/afternoon/i.test(lower)) return '14:00'
  if (/evening/i.test(lower)) return '17:00'

  return null
}

function matchService(text, services) {
  const lower = text.toLowerCase().trim()
  // Try exact-ish match first
  for (const svc of services) {
    if (lower.includes(svc.name.toLowerCase())) return svc
  }
  // Try partial match
  for (const svc of services) {
    const words = svc.name.toLowerCase().split(/\s+/)
    if (words.some(w => w.length > 3 && lower.includes(w))) return svc
  }
  return null
}

function matchStaff(text, staffList) {
  const lower = text.toLowerCase().trim()
  for (const s of staffList) {
    if (lower.includes(s.name.toLowerCase())) return s
  }
  return null
}

// Number selection helper (user replies "1", "2", etc.)
function extractNumber(text) {
  const m = text.trim().match(/^(\d+)$/)
  return m ? parseInt(m[1]) : null
}

function formatDateISO(d) {
  return d.toISOString().split('T')[0]
}

function formatDateHuman(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTimeHuman(time24) {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

// ============================================================
// SHOP ROUTING
// ============================================================

async function findShopForPhone(phoneNumber) {
  // Search across all shops' bookings for this phone number
  const shopsSnap = await db.collection('shops').get()
  const matchedShops = []

  for (const shopDoc of shopsSnap.docs) {
    const bookingsSnap = await shopDoc.ref.collection('bookings')
      .where('clientPhone', '==', phoneNumber)
      .limit(1)
      .get()
    if (!bookingsSnap.empty) {
      matchedShops.push({ id: shopDoc.id, ...shopDoc.data() })
    }
  }

  return matchedShops
}

async function getShopServices(shopId) {
  const snap = await db.collection('shops').doc(shopId).collection('services').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function getShopStaff(shopId) {
  const snap = await db.collection('shops').doc(shopId).collection('staff').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ============================================================
// SEND SMS
// ============================================================

async function sendSMS(to, body) {
  const client = twilio(twilioAccountSid.value(), twilioAuthToken.value())
  await client.messages.create({
    body,
    from: twilioPhoneNumber.value(),
    to,
  })
}

// ============================================================
// CONVERSATION PROCESSOR
// ============================================================

async function processMessage(phoneNumber, messageText) {
  // Get or create conversation
  const convRef = db.collection('smsConversations').doc(phoneNumber)
  const convDoc = await convRef.get()
  let conv = convDoc.exists ? convDoc.data() : null

  const intent = detectIntent(messageText)

  // Global commands
  if (intent === 'cancel') {
    await convRef.set({
      phoneNumber,
      state: 'idle',
      context: {},
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return "✅ Cancelled. Text anytime to book a new appointment!"
  }

  if (intent === 'help') {
    return "📱 SMS Booking Help:\n• Text \"book\" to start booking\n• Text \"cancel\" to cancel\n• Text \"hours\" for business hours\n\nJust describe what you need and we'll help!"
  }

  // No conversation yet or idle
  if (!conv || conv.state === 'idle') {
    return await handleIdle(convRef, phoneNumber, messageText, intent)
  }

  // Route based on state
  switch (conv.state) {
    case 'awaiting_shop_selection':
      return await handleShopSelection(convRef, conv, messageText)
    case 'awaiting_service':
      return await handleServiceSelection(convRef, conv, messageText)
    case 'awaiting_date':
      return await handleDateSelection(convRef, conv, messageText)
    case 'awaiting_time':
      return await handleTimeSelection(convRef, conv, messageText)
    case 'awaiting_staff':
      return await handleStaffSelection(convRef, conv, messageText)
    case 'confirming':
      return await handleConfirmation(convRef, conv, messageText, intent)
    case 'awaiting_payment':
      return "⏳ We're waiting for your deposit payment. Check the link we sent!\n\nReply CANCEL to cancel."
    default:
      // Reset
      await convRef.update({ state: 'idle', context: {} })
      return "Something went wrong. Text \"book\" to start over!"
  }
}

async function handleIdle(convRef, phoneNumber, messageText, intent) {
  // Try to find which shop(s) this customer has visited
  const shops = await findShopForPhone(phoneNumber)

  if (intent === 'greeting' || intent === 'book' || intent === 'unknown') {
    if (shops.length === 1) {
      // Auto-route to their shop
      const shop = shops[0]
      const services = await getShopServices(shop.id)

      await convRef.set({
        phoneNumber,
        shopId: shop.id,
        state: 'awaiting_service',
        context: { shopName: shop.name, services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })) },
        messageHistory: [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      const serviceList = services.map((s, i) => `${i + 1}. ${s.name} ($${s.price || 0})`).join('\n')
      return `👋 Hi! Let's book at ${shop.name}.\n\nWhat service would you like?\n${serviceList}\n\nReply with a number or service name.`

    } else if (shops.length > 1) {
      const shopList = shops.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
      await convRef.set({
        phoneNumber,
        state: 'awaiting_shop_selection',
        context: { shops: shops.map(s => ({ id: s.id, name: s.name })) },
        messageHistory: [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return `👋 Hi! Which shop are you booking with?\n${shopList}\n\nReply with a number.`

    } else {
      // No history - for now, try to find shop by name in message
      // TODO: Implement shop search or provide web link
      const allShops = await db.collection('shops').get()
      if (allShops.size <= 5) {
        const shopList = allShops.docs.map((d, i) => `${i + 1}. ${d.data().name}`).join('\n')
        await convRef.set({
          phoneNumber,
          state: 'awaiting_shop_selection',
          context: { shops: allShops.docs.map(d => ({ id: d.id, name: d.data().name })) },
          messageHistory: [],
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
        return `👋 Welcome! Which shop would you like to book with?\n${shopList}\n\nReply with a number.`
      } else {
        return "👋 Welcome! Please tell us the name of the shop you'd like to book with."
      }
    }
  }

  return "👋 Hi! Text \"book\" to schedule an appointment, or \"help\" for more options."
}

async function handleShopSelection(convRef, conv, messageText) {
  const shops = conv.context.shops || []
  const num = extractNumber(messageText)
  let selectedShop = null

  if (num && num >= 1 && num <= shops.length) {
    selectedShop = shops[num - 1]
  } else {
    // Try name match
    const lower = messageText.toLowerCase()
    selectedShop = shops.find(s => s.name.toLowerCase().includes(lower))
  }

  if (!selectedShop) {
    const shopList = shops.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    return `Sorry, I didn't get that. Please reply with a number:\n${shopList}`
  }

  const services = await getShopServices(selectedShop.id)
  await convRef.update({
    shopId: selectedShop.id,
    state: 'awaiting_service',
    context: {
      shopName: selectedShop.name,
      services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
    },
    updatedAt: FieldValue.serverTimestamp(),
  })

  const serviceList = services.map((s, i) => `${i + 1}. ${s.name} ($${s.price || 0})`).join('\n')
  return `Great! Booking at ${selectedShop.name}.\n\nWhat service would you like?\n${serviceList}\n\nReply with a number or service name.`
}

async function handleServiceSelection(convRef, conv, messageText) {
  const services = conv.context.services || []
  const num = extractNumber(messageText)
  let selected = null

  if (num && num >= 1 && num <= services.length) {
    selected = services[num - 1]
  } else {
    selected = matchService(messageText, services)
  }

  if (!selected) {
    const serviceList = services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    return `I didn't find that service. Please pick from:\n${serviceList}\n\nReply with a number.`
  }

  await convRef.update({
    state: 'awaiting_date',
    'context.selectedService': selected,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return `✂️ ${selected.name} — got it!\n\nWhat date works for you?\n(e.g., "tomorrow", "Wednesday", "2/15")`
}

async function handleDateSelection(convRef, conv, messageText) {
  const date = extractDate(messageText)
  if (!date) {
    return "I didn't catch the date. Try:\n• \"tomorrow\"\n• A day name like \"Wednesday\"\n• A date like \"2/15\""
  }

  await convRef.update({
    state: 'awaiting_time',
    'context.selectedDate': date,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // TODO: Check actual availability and show real open slots
  return `📅 ${formatDateHuman(date)} — great!\n\nWhat time would you prefer?\n(e.g., "3pm", "10:30am", "afternoon")`
}

async function handleTimeSelection(convRef, conv, messageText) {
  const time = extractTime(messageText)
  if (!time) {
    return "I didn't catch the time. Try:\n• \"3pm\" or \"3:30pm\"\n• \"morning\" / \"afternoon\" / \"evening\""
  }

  // Get staff for this shop
  const staff = await getShopStaff(conv.shopId)

  if (staff.length > 1) {
    const staffList = staff.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    await convRef.update({
      state: 'awaiting_staff',
      'context.selectedTime': time,
      'context.staff': staff.map(s => ({ id: s.id, name: s.name })),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return `🕐 ${formatTimeHuman(time)} — perfect!\n\nDo you have a preferred stylist?\n${staffList}\n\nReply with a number, name, or \"any\".`
  }

  // Single or no staff — skip staff selection
  const selectedStaff = staff.length === 1 ? { id: staff[0].id, name: staff[0].name } : null

  await convRef.update({
    state: 'confirming',
    'context.selectedTime': time,
    'context.selectedStaff': selectedStaff,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return buildConfirmationMessage(conv.context, time, selectedStaff)
}

async function handleStaffSelection(convRef, conv, messageText) {
  const staffList = conv.context.staff || []
  const intent = detectIntent(messageText)
  let selected = null

  if (intent === 'any') {
    selected = staffList[0] // first available
  } else {
    const num = extractNumber(messageText)
    if (num && num >= 1 && num <= staffList.length) {
      selected = staffList[num - 1]
    } else {
      selected = matchStaff(messageText, staffList)
    }
  }

  if (!selected) {
    const list = staffList.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    return `I didn't catch that. Pick a stylist:\n${list}\n\nOr reply \"any\".`
  }

  await convRef.update({
    state: 'confirming',
    'context.selectedStaff': selected,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return buildConfirmationMessage(conv.context, conv.context.selectedTime, selected)
}

function buildConfirmationMessage(ctx, time, staff) {
  const svc = ctx.selectedService
  let msg = `Here's your booking:\n─────────────────\n`
  msg += `📅 ${formatDateHuman(ctx.selectedDate)}\n`
  msg += `🕐 ${formatTimeHuman(time)}\n`
  msg += `✂️  ${svc.name} ($${svc.price || 0})\n`
  if (staff) msg += `👤 with ${staff.name}\n`
  msg += `─────────────────\n\n`
  msg += `Reply YES to confirm or NO to start over.`
  return msg
}

async function handleConfirmation(convRef, conv, messageText, intent) {
  if (intent === 'confirm' || intent === 'unknown' && /yes/i.test(messageText)) {
    // TODO: Check if deposit is required and send Stripe payment link
    // TODO: Actually create the booking in the shop's bookings collection
    // For now, create the booking directly

    const ctx = conv.context
    const svc = ctx.selectedService
    const staff = ctx.selectedStaff

    try {
      // Generate ref code
      const refCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Create booking
      await db.collection('shops').doc(conv.shopId).collection('bookings').add({
        clientName: 'SMS Customer', // TODO: Ask for name or look up
        clientPhone: conv.phoneNumber,
        clientEmail: '',
        serviceName: svc.name,
        serviceId: svc.id,
        servicePrice: svc.price || 0,
        serviceDuration: svc.duration || 30,
        staffId: staff?.id || null,
        staffName: staff?.name || null,
        date: ctx.selectedDate,
        time: ctx.selectedTime,
        status: 'confirmed',
        source: 'sms',
        refCode,
        depositPaid: false,
        depositAmount: 0,
        createdAt: FieldValue.serverTimestamp(),
      })

      // Reset conversation
      await convRef.update({
        state: 'idle',
        context: {},
        updatedAt: FieldValue.serverTimestamp(),
      })

      let msg = `✅ You're all set!\n`
      msg += `${svc.name}${staff ? ' with ' + staff.name : ''}\n`
      msg += `${formatDateHuman(ctx.selectedDate)} at ${formatTimeHuman(ctx.selectedTime)}\n`
      msg += `Ref: ${refCode}\n\n`
      msg += `Reply CANCEL to cancel or HELP for assistance.`
      return msg

    } catch (err) {
      console.error('Error creating booking:', err)
      return "Sorry, something went wrong creating your booking. Please try again or book online."
    }

  } else if (intent === 'deny') {
    await convRef.update({
      state: 'idle',
      context: {},
      updatedAt: FieldValue.serverTimestamp(),
    })
    return "No problem! Text \"book\" whenever you're ready to try again."
  }

  return "Reply YES to confirm or NO to cancel."
}

// ============================================================
// HTTP WEBHOOK ENDPOINT
// ============================================================

const smsWebhook = onRequest(
  {
    secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    // Validate Twilio signature
    const signature = req.headers['x-twilio-signature']
    const url = `https://us-central1-scheduler-65e51.cloudfunctions.net/smsWebhook`
    const isValid = twilio.validateRequest(
      twilioAuthToken.value(),
      signature,
      url,
      req.body
    )

    if (!isValid) {
      console.warn('Invalid Twilio signature')
      // In development, you might want to skip this check
      // For production, uncomment the next line:
      // res.status(403).send('Forbidden'); return;
    }

    const from = req.body.From  // Customer phone number
    const body = req.body.Body  // Message text
    const to = req.body.To      // Our Twilio number

    if (!from || !body) {
      res.status(400).send('Missing From or Body')
      return
    }

    console.log(`SMS from ${from}: ${body.substring(0, 100)}`)

    try {
      // Process the message and get response
      const reply = await processMessage(from, body.trim())

      // Log message history
      const convRef = db.collection('smsConversations').doc(from)
      await convRef.update({
        messageHistory: FieldValue.arrayUnion(
          { role: 'customer', text: body.trim(), ts: Date.now() },
          { role: 'assistant', text: reply, ts: Date.now() }
        ),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {}) // Ignore if doc doesn't exist yet

      // Send reply via Twilio
      await sendSMS(from, reply)

      // Return empty TwiML (we send reply via API, not TwiML)
      res.type('text/xml').send('<Response></Response>')

    } catch (error) {
      console.error('Error processing SMS:', error)
      // Try to send error message
      try {
        await sendSMS(from, "Sorry, something went wrong. Please try again in a moment.")
      } catch (e) {
        console.error('Failed to send error SMS:', e)
      }
      res.type('text/xml').send('<Response></Response>')
    }
  }
)

module.exports = { smsWebhook, twilioAccountSid, twilioAuthToken, twilioPhoneNumber }
