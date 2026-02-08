const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const twilio = require('twilio')

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')
const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID')
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = defineSecret('TWILIO_PHONE_NUMBER')

const db = getFirestore()

// ============================================================
// SMS PAYMENT COMPLETE - Stripe webhook for SMS booking deposits
// ============================================================

const smsPaymentComplete = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret, twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const Stripe = require('stripe')
    const stripe = new Stripe(stripeSecretKey.value())
    const sig = req.headers['stripe-signature']

    let event
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      )
    } catch (err) {
      console.error('SMS Payment webhook signature verification failed:', err.message)
      res.status(400).send(`Webhook Error: ${err.message}`)
      return
    }

    console.log(`SMS Payment webhook event: ${event.type}`)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const metadata = session.metadata || {}

      // Only handle SMS booking deposits
      if (metadata.type !== 'sms_booking_deposit') {
        res.json({ received: true, skipped: true })
        return
      }

      const customerPhone = metadata.customerPhone
      const shopId = metadata.shopId

      if (!customerPhone || !shopId) {
        console.error('Missing customerPhone or shopId in metadata')
        res.status(400).json({ error: 'Missing metadata' })
        return
      }

      try {
        // Find the conversation with pending booking
        const convRef = db.collection('smsConversations').doc(customerPhone)
        const convDoc = await convRef.get()

        if (!convDoc.exists) {
          console.error('No conversation found for phone:', customerPhone)
          res.json({ received: true, error: 'no_conversation' })
          return
        }

        const conv = convDoc.data()
        const pending = conv.pendingBooking

        if (!pending) {
          console.error('No pending booking for phone:', customerPhone)
          res.json({ received: true, error: 'no_pending_booking' })
          return
        }

        // Create confirmed booking
        const refCode = Math.random().toString(36).substring(2, 8).toUpperCase()

        await db.collection('shops').doc(shopId).collection('bookings').add({
          clientName: conv.context?.clientName || 'SMS Customer',
          clientPhone: customerPhone,
          clientEmail: session.customer_email || '',
          serviceName: pending.serviceName,
          serviceId: pending.serviceId,
          servicePrice: pending.servicePrice || 0,
          serviceDuration: pending.serviceDuration || 30,
          staffId: pending.staffId || null,
          staffName: pending.staffName || null,
          date: pending.date,
          time: pending.time,
          status: 'confirmed',
          source: 'sms',
          refCode,
          depositPaid: true,
          depositAmount: pending.depositAmount || 0,
          stripePaymentId: session.payment_intent,
          createdAt: FieldValue.serverTimestamp(),
        })

        // Reset conversation
        await convRef.update({
          state: 'idle',
          context: {},
          pendingBooking: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        // Send confirmation SMS
        const client = twilio(twilioAccountSid.value(), twilioAuthToken.value())
        const msg = `✅ Payment received! You're all set!\n\n` +
          `${pending.serviceName}${pending.staffName ? ' with ' + pending.staffName : ''}\n` +
          `${pending.date} at ${pending.time}\n` +
          `Ref: ${refCode}\n\n` +
          `Reply HELP for assistance or CANCEL to cancel.`

        await client.messages.create({
          body: msg,
          from: twilioPhoneNumber.value(),
          to: customerPhone,
        })

        console.log(`SMS booking confirmed for ${customerPhone}, ref: ${refCode}`)
        res.json({ received: true, success: true })

      } catch (error) {
        console.error('Error processing SMS payment completion:', error)
        res.status(500).json({ error: error.message })
      }

    } else {
      res.json({ received: true })
    }
  }
)

module.exports = { smsPaymentComplete }
