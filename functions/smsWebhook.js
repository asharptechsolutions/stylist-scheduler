const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const twilio = require('twilio')
const Anthropic = require('@anthropic-ai/sdk')

const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID')
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = defineSecret('TWILIO_PHONE_NUMBER')
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

const db = getFirestore()

// ============================================================
// FORMATTING HELPERS
// ============================================================

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
// SHOP DATA HELPERS
// ============================================================

async function findShopForPhone(phoneNumber) {
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

async function getShopData(shopId) {
  const doc = await db.collection('shops').doc(shopId).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
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
// CLAUDE AI CONVERSATION ENGINE
// ============================================================

/**
 * Build the system prompt for Claude with all shop context.
 */
function buildSystemPrompt(shop, services, staff, conversation) {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const serviceList = services.map(s => {
    let line = `- ${s.name}`
    if (s.price) line += ` ($${s.price})`
    if (s.duration) line += ` [${s.duration} min]`
    return line
  }).join('\n')

  const staffList = staff.length > 0
    ? staff.map(s => `- ${s.name}${s.role ? ' (' + s.role + ')' : ''}`).join('\n')
    : '- (No specific staff listed — bookings are with the shop)'

  const state = conversation?.state || 'idle'
  const ctx = conversation?.context || {}

  let collectedInfo = 'None yet'
  const parts = []
  if (ctx.selectedService) parts.push(`Service: ${ctx.selectedService.name} ($${ctx.selectedService.price || 0}, ${ctx.selectedService.duration || 30}min)`)
  if (ctx.selectedDate) parts.push(`Date: ${ctx.selectedDate} (${formatDateHuman(ctx.selectedDate)})`)
  if (ctx.selectedTime) parts.push(`Time: ${ctx.selectedTime} (${formatTimeHuman(ctx.selectedTime)})`)
  if (ctx.selectedStaff) parts.push(`Staff: ${ctx.selectedStaff.name}`)
  if (ctx.clientName && ctx.clientName !== 'SMS Customer') parts.push(`Customer name: ${ctx.clientName}`)
  if (parts.length > 0) collectedInfo = parts.join('\n')

  return `You are a friendly, concise SMS booking assistant for "${shop.name || 'the shop'}".

CURRENT DATE/TIME: ${todayStr} at ${timeStr}
SHOP: ${shop.name || 'Unknown'}

SERVICES OFFERED:
${serviceList || '(none configured)'}

STAFF:
${staffList}

CONVERSATION STATE: ${state}
COLLECTED INFO:
${collectedInfo}

YOUR JOB:
Help the customer book an appointment via text message. Guide them through selecting a service, date, time, and optionally a stylist. Be warm but brief — this is SMS.

RULES:
1. Keep responses SHORT. Max 3-4 lines unless listing options.
2. Use emojis sparingly for warmth (1-2 per message).
3. When listing options, number them so customers can reply with a number.
4. Always confirm the full booking details before finalizing.
5. If the customer mentions multiple things at once (e.g. "haircut tomorrow at 3pm"), extract ALL of them.
6. Handle "cancel", "stop" → cancel current flow.
7. Handle "help" → brief help message.
8. If a customer's message is unclear, ask ONE clarifying question.
9. Never invent services or staff that aren't in the lists above.
10. For dates, interpret relative to the current date shown above.

RESPOND WITH VALID JSON ONLY — no markdown, no code fences, just the raw JSON object:
{
  "reply": "Your SMS message to the customer",
  "action": "none|select_shop|select_service|select_date|select_time|select_staff|confirm_booking|cancel|help",
  "extracted": {
    "shopIndex": null,
    "serviceIndex": null,
    "serviceName": null,
    "date": null,
    "time": null,
    "staffIndex": null,
    "staffName": null,
    "clientName": null,
    "confirmed": null
  },
  "newState": "idle|awaiting_shop_selection|awaiting_service|awaiting_date|awaiting_time|awaiting_staff|confirming"
}

FIELD NOTES:
- "serviceIndex" is 0-based index into the services list. "serviceName" is fallback for fuzzy match.
- "date" should be YYYY-MM-DD format.
- "time" should be HH:MM in 24-hour format.
- "staffIndex" is 0-based index into the staff list.
- "confirmed" is true/false when customer confirms or denies the booking.
- "newState" tells us what to ask next. If you extracted everything needed, go to "confirming".
- If the customer provides service+date+time in one message, set them all and skip to "confirming" (or "awaiting_staff" if multiple staff exist).
- For "cancel" action, set newState to "idle".`
}

/**
 * Call Claude to process a customer message and return structured response.
 */
async function callClaude(systemPrompt, messageHistory, customerMessage) {
  const client = new Anthropic({ apiKey: anthropicApiKey.value() })

  // Build messages array from history + new message
  const messages = []

  // Include last 10 messages of history for context
  const recentHistory = (messageHistory || []).slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'customer' ? 'user' : 'assistant',
      content: msg.text,
    })
  }

  // Add the new customer message
  messages.push({ role: 'user', content: customerMessage })

  // If the last two messages are both "user", merge or fix
  // (Claude requires alternating roles)
  const cleaned = []
  for (const msg of messages) {
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === msg.role) {
      cleaned[cleaned.length - 1].content += '\n' + msg.content
    } else {
      cleaned.push({ ...msg })
    }
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: systemPrompt,
    messages: cleaned,
  })

  const text = response.content[0]?.text || ''

  // Parse JSON response from Claude
  try {
    // Strip any markdown fencing Claude might add despite instructions
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('Failed to parse Claude response as JSON:', text)
    // Fallback: return the raw text as reply with no actions
    return {
      reply: text.substring(0, 320), // SMS-safe length
      action: 'none',
      extracted: {},
      newState: null,
    }
  }
}

// ============================================================
// MAIN CONVERSATION PROCESSOR
// ============================================================

async function processMessage(phoneNumber, messageText) {
  const convRef = db.collection('smsConversations').doc(phoneNumber)
  const convDoc = await convRef.get()
  let conv = convDoc.exists ? convDoc.data() : null

  // Quick check for global cancel/help (bypass AI for speed)
  const lower = messageText.toLowerCase().trim()
  if (/^(cancel|stop|quit)$/i.test(lower)) {
    await convRef.set({
      phoneNumber,
      state: 'idle',
      context: {},
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return "✅ Cancelled. Text anytime to book a new appointment!"
  }

  // If waiting for payment, don't burn AI tokens
  if (conv?.state === 'awaiting_payment') {
    if (/^(cancel|stop)$/i.test(lower)) {
      await convRef.update({ state: 'idle', context: {}, updatedAt: FieldValue.serverTimestamp() })
      return "✅ Cancelled. Text anytime to book again!"
    }
    return "⏳ We're waiting for your deposit payment. Check the link we sent!\n\nReply CANCEL to cancel."
  }

  // ── SHOP ROUTING (before AI, since we need shop context for the prompt) ──

  // If no conversation or idle, resolve which shop first
  if (!conv || conv.state === 'idle' || !conv.shopId) {
    const result = await resolveShop(convRef, phoneNumber, conv, messageText)
    if (result.needsInput) {
      return result.reply // Asked customer to pick a shop
    }
    // Shop resolved — reload conv
    conv = (await convRef.get()).data()
  }

  // ── SHOP SELECTION STATE (keyword fallback — cheap, no AI needed) ──
  if (conv.state === 'awaiting_shop_selection') {
    const result = await handleShopSelection(convRef, conv, messageText)
    if (result.needsInput) return result.reply
    // Shop resolved — reload conv
    conv = (await convRef.get()).data()
  }

  // ── LOAD SHOP CONTEXT ──
  const shop = await getShopData(conv.shopId)
  if (!shop) {
    await convRef.update({ state: 'idle', context: {}, shopId: FieldValue.delete() })
    return "Sorry, we couldn't find that shop. Please try again."
  }

  const services = await getShopServices(conv.shopId)
  const staff = await getShopStaff(conv.shopId)

  // ── CALL CLAUDE ──
  const systemPrompt = buildSystemPrompt(shop, services, staff, conv)
  const aiResponse = await callClaude(systemPrompt, conv.messageHistory, messageText)

  // ── PROCESS AI RESPONSE ──
  const extracted = aiResponse.extracted || {}
  const newState = aiResponse.newState || conv.state
  const action = aiResponse.action || 'none'
  const ctx = { ...(conv.context || {}) }

  // Apply extracted entities to context
  if (extracted.serviceIndex != null && services[extracted.serviceIndex]) {
    const s = services[extracted.serviceIndex]
    ctx.selectedService = { id: s.id, name: s.name, price: s.price, duration: s.duration }
  } else if (extracted.serviceName) {
    const match = services.find(s => s.name.toLowerCase().includes(extracted.serviceName.toLowerCase()))
    if (match) ctx.selectedService = { id: match.id, name: match.name, price: match.price, duration: match.duration }
  }

  if (extracted.date) ctx.selectedDate = extracted.date
  if (extracted.time) ctx.selectedTime = extracted.time

  if (extracted.staffIndex != null && staff[extracted.staffIndex]) {
    const s = staff[extracted.staffIndex]
    ctx.selectedStaff = { id: s.id, name: s.name }
  } else if (extracted.staffName) {
    const match = staff.find(s => s.name.toLowerCase().includes(extracted.staffName.toLowerCase()))
    if (match) ctx.selectedStaff = { id: match.id, name: match.name }
  }

  if (extracted.clientName) ctx.clientName = extracted.clientName

  // Store services/staff refs in context for subsequent turns
  ctx.shopName = shop.name
  ctx.services = services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration }))
  ctx.staff = staff.map(s => ({ id: s.id, name: s.name }))

  // ── HANDLE BOOKING CONFIRMATION ──
  if (action === 'confirm_booking' && extracted.confirmed === true) {
    return await createBooking(convRef, conv, ctx)
  }

  // ── HANDLE CANCEL ──
  if (action === 'cancel') {
    await convRef.update({
      state: 'idle',
      context: {},
      updatedAt: FieldValue.serverTimestamp(),
    })
    return aiResponse.reply || "✅ Cancelled. Text anytime to book again!"
  }

  // ── UPDATE CONVERSATION STATE ──
  await convRef.update({
    state: newState,
    context: ctx,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return aiResponse.reply
}

// ============================================================
// SHOP RESOLUTION (pre-AI, no tokens burned)
// ============================================================

async function resolveShop(convRef, phoneNumber, conv, messageText) {
  const shops = await findShopForPhone(phoneNumber)

  if (shops.length === 1) {
    const shop = shops[0]
    const services = await getShopServices(shop.id)
    await convRef.set({
      phoneNumber,
      shopId: shop.id,
      state: 'awaiting_service',
      context: {
        shopName: shop.name,
        services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
      },
      messageHistory: [],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return { needsInput: false }

  } else if (shops.length > 1) {
    const shopList = shops.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    await convRef.set({
      phoneNumber,
      state: 'awaiting_shop_selection',
      context: { shops: shops.map(s => ({ id: s.id, name: s.name })) },
      messageHistory: [],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return {
      needsInput: true,
      reply: `👋 Hi! Which shop are you booking with?\n${shopList}\n\nReply with a number.`
    }

  } else {
    // New customer — list shops
    const allShops = await db.collection('shops').get()
    if (allShops.size === 0) {
      return { needsInput: true, reply: "Sorry, no shops are available for SMS booking right now." }
    }
    if (allShops.size === 1) {
      const shopDoc = allShops.docs[0]
      const services = await getShopServices(shopDoc.id)
      await convRef.set({
        phoneNumber,
        shopId: shopDoc.id,
        state: 'awaiting_service',
        context: {
          shopName: shopDoc.data().name,
          services: services.map(s => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
        },
        messageHistory: [],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return { needsInput: false }
    }

    const shopList = allShops.docs.map((d, i) => `${i + 1}. ${d.data().name}`).join('\n')
    await convRef.set({
      phoneNumber,
      state: 'awaiting_shop_selection',
      context: { shops: allShops.docs.map(d => ({ id: d.id, name: d.data().name })) },
      messageHistory: [],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return {
      needsInput: true,
      reply: `👋 Welcome! Which shop would you like to book with?\n${shopList}\n\nReply with a number.`
    }
  }
}

async function handleShopSelection(convRef, conv, messageText) {
  const shops = conv.context?.shops || []
  const num = messageText.trim().match(/^(\d+)$/)
  let selectedShop = null

  if (num && parseInt(num[1]) >= 1 && parseInt(num[1]) <= shops.length) {
    selectedShop = shops[parseInt(num[1]) - 1]
  } else {
    const lower = messageText.toLowerCase()
    selectedShop = shops.find(s => s.name.toLowerCase().includes(lower))
  }

  if (!selectedShop) {
    const shopList = shops.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
    return {
      needsInput: true,
      reply: `Sorry, I didn't catch that. Please reply with a number:\n${shopList}`
    }
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

  return { needsInput: false }
}

// ============================================================
// BOOKING CREATION
// ============================================================

async function createBooking(convRef, conv, ctx) {
  const svc = ctx.selectedService
  const staff = ctx.selectedStaff

  if (!svc || !ctx.selectedDate || !ctx.selectedTime) {
    // AI jumped the gun — shouldn't happen but guard against it
    return "Hmm, I'm missing some details. What service, date, and time would you like?"
  }

  try {
    const refCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    await db.collection('shops').doc(conv.shopId).collection('bookings').add({
      clientName: ctx.clientName || 'SMS Customer',
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
    msg += `We'll send a reminder before your appointment.\nReply CANCEL to cancel or HELP for assistance.`
    return msg

  } catch (err) {
    console.error('Error creating booking:', err)
    return "Sorry, something went wrong creating your booking. Please try again or book online."
  }
}

// ============================================================
// HTTP WEBHOOK ENDPOINT
// ============================================================

const smsWebhook = onRequest(
  {
    secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber, anthropicApiKey],
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
      // For production, uncomment:
      // res.status(403).send('Forbidden'); return;
    }

    const from = req.body.From
    const body = req.body.Body
    const to = req.body.To

    if (!from || !body) {
      res.status(400).send('Missing From or Body')
      return
    }

    console.log(`SMS from ${from}: ${body.substring(0, 100)}`)

    try {
      const reply = await processMessage(from, body.trim())

      // Log message history
      const convRef = db.collection('smsConversations').doc(from)
      await convRef.update({
        messageHistory: FieldValue.arrayUnion(
          { role: 'customer', text: body.trim(), ts: Date.now() },
          { role: 'assistant', text: reply, ts: Date.now() }
        ),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {})

      // Send reply via Twilio
      await sendSMS(from, reply)

      res.type('text/xml').send('<Response></Response>')

    } catch (error) {
      console.error('Error processing SMS:', error)
      try {
        await sendSMS(from, "Sorry, something went wrong. Please try again in a moment.")
      } catch (e) {
        console.error('Failed to send error SMS:', e)
      }
      res.type('text/xml').send('<Response></Response>')
    }
  }
)

module.exports = { smsWebhook, twilioAccountSid, twilioAuthToken, twilioPhoneNumber, anthropicApiKey }
