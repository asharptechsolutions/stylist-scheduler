# SMS Booking Feature Specification

## Overview
Allow customers to book appointments via natural text message conversation. An AI handles the back-and-forth, checks availability, and completes bookings — sending payment links when deposits are required.

## User Stories

### Customer Journey
1. Customer texts shop's booking number
2. AI greets and asks what they need
3. Customer describes desired appointment (service, date/time preferences)
4. AI checks availability, offers options
5. Customer selects time and stylist preference
6. If deposit required: AI sends Stripe Payment Link
7. Once paid (or if no deposit): Booking confirmed via text

### Example Conversation
```
Customer: Do you have any openings this Wednesday?

AI: Hi! 👋 I can help you book at [Shop Name]. 
    What service are you looking for?

Customer: Haircut

AI: Great! For a haircut on Wednesday (Feb 12), I have:
    • 3:00 PM
    • 3:30 PM  
    • 4:15 PM
    Which works best?

Customer: 3pm

AI: Perfect! Do you have a preferred stylist?
    • Bob (available at 3pm ✓)
    • Sarah (available at 3pm ✓)
    Or reply "any" for first available.

Customer: Bob

AI: Got it! Here's your booking:
    ─────────────────────
    📅 Wednesday, Feb 12
    🕐 3:00 PM
    ✂️  Haircut ($35)
    👤 with Bob
    ─────────────────────
    
    This service requires a $25 deposit.
    Complete payment here: https://pay.stripe.com/xxx
    
    Reply CANCEL anytime to cancel this booking.

[Customer pays via link]

AI: ✅ You're all set! 
    Haircut with Bob on Wed, Feb 12 at 3:00 PM.
    
    We'll send a reminder the day before.
    Reply HELP for assistance or CANCEL to cancel.
```

---

## Technical Architecture

### Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Customer      │────▶│   Twilio         │────▶│  Cloud Function │
│   (SMS)         │◀────│   (SMS Gateway)  │◀────│  smsWebhook     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  Claude API      │◀─────────────┤
                        │  (NLU + Response)│              │
                        └──────────────────┘              │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Stripe         │────▶│  Cloud Function  │────▶│   Firestore     │
│  Payment Link   │     │  paymentWebhook  │     │   (State + Data)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Firestore Collections

#### `smsConversations/{phoneNumber}`
Tracks conversation state per customer phone number.

```javascript
{
  phoneNumber: "+15551234567",
  shopId: "shop_abc123",           // Which shop they're booking with
  state: "awaiting_time_selection", // Current step in flow
  context: {
    service: { id: "svc_123", name: "Haircut", price: 35, duration: 30 },
    date: "2026-02-12",
    availableSlots: ["15:00", "15:30", "16:15"],
    selectedTime: null,
    selectedStaff: null,
    clientName: "John",            // If known from prior bookings
    clientPhone: "+15551234567"
  },
  pendingBooking: {                // Created when awaiting payment
    serviceId: "svc_123",
    staffId: "staff_bob",
    dateTime: "2026-02-12T15:00:00",
    depositAmount: 25,
    paymentLinkId: "plink_xxx",
    paymentLinkUrl: "https://pay.stripe.com/xxx"
  },
  messageHistory: [                // Last N messages for context
    { role: "customer", text: "Do you have openings Wednesday?", ts: 1707... },
    { role: "assistant", text: "Hi! I can help...", ts: 1707... }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  expiresAt: Timestamp             // Auto-cleanup after 24h inactivity
}
```

#### `smsSettings/{shopId}`
Per-shop SMS booking configuration.

```javascript
{
  enabled: true,
  twilioPhoneNumber: "+15559876543",  // If per-shop numbers
  greeting: "Hi! Welcome to Bob's Barbershop. How can I help?",
  requireDeposit: true,
  depositPercentage: 50,              // Or fixed amount
  depositFixed: null,
  allowWalkInBooking: true,           // Can book same-day
  advanceBookingDays: 30,             // How far out
  autoConfirmWithoutDeposit: false,   // Require payment always?
  businessHoursOnly: true,            // Only respond during hours
  afterHoursMessage: "We're closed! Book online anytime at {url}"
}
```

---

## Cloud Functions

### `smsWebhook` (HTTP)
Receives incoming SMS from Twilio.

```javascript
exports.smsWebhook = functions.https.onRequest(async (req, res) => {
  const { From, Body, To } = req.body;
  
  // 1. Validate Twilio signature
  // 2. Get or create conversation state
  // 3. Process message with AI
  // 4. Send response via Twilio
  // 5. Update conversation state
  
  res.type('text/xml').send('<Response></Response>');
});
```

### `processBookingMessage` (internal)
Core AI logic for handling conversation.

```javascript
async function processBookingMessage(conversation, incomingMessage) {
  // Build prompt with:
  // - Shop info (name, services, staff)
  // - Current date/time
  // - Conversation history
  // - Current state
  // - Available slots (if relevant)
  
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: SMS_BOOKING_SYSTEM_PROMPT,
    messages: buildMessages(conversation, incomingMessage)
  });
  
  // Parse structured response
  // - Reply text to send
  // - Actions to take (check availability, create booking, etc.)
  // - New state
  
  return { reply, actions, newState };
}
```

### `smsPaymentComplete` (Stripe webhook)
Handles payment link completion.

```javascript
exports.smsPaymentComplete = functions.https.onRequest(async (req, res) => {
  const event = stripe.webhooks.constructEvent(...);
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const phoneNumber = session.metadata.customerPhone;
    
    // 1. Find conversation with pending booking
    // 2. Create confirmed booking in Firestore
    // 3. Send confirmation SMS
    // 4. Clear conversation state
  }
});
```

---

## AI Prompt Design

### System Prompt
```
You are a friendly booking assistant for {shop.name}. Help customers book appointments via text message.

CURRENT CONTEXT:
- Today: {currentDate}
- Shop hours: {hours}
- Services: {serviceList}
- Staff: {staffList}

CONVERSATION STATE: {state}
COLLECTED INFO: {context}

RULES:
1. Be concise - this is SMS, not email
2. Use emojis sparingly for warmth
3. Offer specific options, not open-ended questions
4. Confirm details before finalizing
5. Handle "cancel", "help", "hours" as special commands

RESPOND WITH JSON:
{
  "reply": "Your message to the customer",
  "action": "check_availability|select_time|select_staff|create_booking|none",
  "data": { ...relevant extracted data... },
  "newState": "next_state_name"
}
```

### State Machine
```
START
  ↓
GREETING → (service mentioned?) → AWAITING_SERVICE
  ↓                                      ↓
  └──────────────────────────────────────┘
                    ↓
            AWAITING_DATE_TIME
                    ↓
            CHECKING_AVAILABILITY
                    ↓
            AWAITING_TIME_SELECTION
                    ↓
            AWAITING_STAFF_SELECTION (optional)
                    ↓
            CONFIRMING_DETAILS
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
  AWAITING_PAYMENT         BOOKING_COMPLETE
        ↓                       
  BOOKING_COMPLETE              
```

---

## Twilio Setup

### Option A: Shared Number ✓ (Chosen for MVP)
- One Twilio number for all shops
- **Routing logic (by phone number lookup):**
  1. Customer texts in
  2. Query Firestore: bookings where `clientPhone == incomingNumber`
  3. **One shop found** → Route automatically, greet with shop name
  4. **Multiple shops found** → "Are you booking with Bob's Barbershop or Main St Salon?"
  5. **No history** → "Which business are you looking to book with?" (list or search)

**Cost**: ~$1.15/mo + $0.0079/SMS segment

### Option B: Per-Shop Numbers
- Each shop gets dedicated Twilio number
- Cleaner UX, no routing needed
- Number shown on shop's booking page, marketing, etc.

**Cost**: ~$1.15/mo per shop + $0.0079/SMS segment

### Twilio Configuration
```javascript
// Environment variables
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+15559876543

// Webhook URL (configure in Twilio console)
https://us-central1-scheduler-65e51.cloudfunctions.net/smsWebhook
```

---

## Stripe Payment Links

### Creating Payment Link for Deposit
```javascript
const paymentLink = await stripe.paymentLinks.create({
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: {
        name: `Deposit: ${service.name} with ${staff.name}`,
        description: `${shop.name} - ${formattedDateTime}`
      },
      unit_amount: depositAmount * 100
    },
    quantity: 1
  }],
  metadata: {
    shopId: shop.id,
    customerPhone: phoneNumber,
    serviceId: service.id,
    staffId: staff.id,
    dateTime: isoDateTime,
    type: 'sms_booking_deposit'
  },
  after_completion: {
    type: 'redirect',
    redirect: { url: `${baseUrl}/booking-confirmed` }
  }
}, {
  stripeAccount: shop.stripeAccountId  // Connect account
});
```

---

## Edge Cases & Error Handling

### Handled Scenarios
| Scenario | Response |
|----------|----------|
| No availability on requested date | Offer next available dates |
| Service not found | List available services |
| Staff not available at time | Offer available staff or other times |
| Payment link expires (24h) | Send new link if customer returns |
| Customer says "cancel" | Cancel pending booking, confirm |
| Customer says "help" | List commands and shop contact |
| Gibberish/unclear message | Ask clarifying question |
| After hours message | Polite message with online booking link |
| Existing customer | Greet by name, pre-fill known info |

### Timeout Handling
- Conversation expires after 24 hours of inactivity
- Pending (unpaid) bookings expire after 30 minutes
- Send reminder: "Still there? Your 3pm slot is held for 15 more minutes."

---

## Security Considerations

1. **Twilio Signature Validation** - Verify webhook requests are from Twilio
2. **Rate Limiting** - Max 20 messages per phone number per hour
3. **Phone Number Validation** - Only valid phone formats
4. **No PII in Logs** - Redact phone numbers in logging
5. **Conversation Encryption** - Encrypt messageHistory at rest
6. **Payment Link Expiry** - Short-lived links (1 hour)

---

## Cost Estimate

### Per Conversation (avg 8 messages round-trip)
| Component | Cost |
|-----------|------|
| Twilio SMS (8 segments) | $0.063 |
| Claude Sonnet (4 calls) | $0.012 |
| Stripe (if $25 deposit) | $1.03 |
| **Total per booking** | ~$1.10 |

### Monthly Fixed
| Component | Cost |
|-----------|------|
| Twilio Phone Number | $1.15 |
| Firebase Functions | Included in plan |
| Claude API | Pay per use |

---

## Implementation Phases

### Phase 1: Basic Flow (MVP)
- [ ] Twilio account setup
- [ ] `smsWebhook` Cloud Function
- [ ] Basic conversation state machine
- [ ] Claude integration for NLU
- [ ] Check availability logic
- [ ] Create booking from SMS
- [ ] Payment link generation
- [ ] Payment completion webhook

### Phase 2: Polish
- [ ] Existing customer recognition
- [ ] Multi-service bookings
- [ ] Reschedule via SMS
- [ ] Cancel via SMS
- [ ] Appointment reminders → reply to confirm

### Phase 3: Advanced
- [ ] Per-shop phone numbers (premium feature)
- [ ] Custom AI personality per shop
- [ ] Spanish/multi-language support
- [ ] Group booking ("book for me and my wife")
- [ ] Waitlist via SMS

---

## Files to Create/Modify

### New Files
- `functions/smsWebhook.js` - Main webhook handler
- `functions/smsAI.js` - Claude integration & prompts
- `functions/smsPayment.js` - Payment link logic
- `src/components/SMSSettings.jsx` - Shop settings UI
- `src/components/AdminSMSPanel.jsx` - Platform admin view

### Modified Files
- `functions/index.js` - Export new functions
- `functions/package.json` - Add Twilio, Anthropic SDKs
- `firestore.rules` - Add smsConversations rules
- Shop settings schema - Add SMS config fields

---

## Open Questions

1. **Shared vs per-shop numbers?** 
   - Recommend: Shared for MVP, per-shop as paid add-on

2. **Deposit handling?**
   - Use shop's existing deposit settings
   - Payment link expires in 1 hour

3. **New customer info collection?**
   - Ask for name if not recognized
   - Email optional (for receipts)

4. **Booking conflicts?**
   - Hold slot for 10 min while awaiting payment
   - Release if not paid, notify customer

5. **Which Claude model?**
   - Sonnet for cost efficiency
   - Haiku for simple responses (greeting, confirmations)
