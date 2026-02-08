const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const { Resend } = require('resend')
const Stripe = require('stripe')

// Initialize Firebase Admin
initializeApp()
const db = getFirestore()

// Define secrets (set these with: firebase functions:secrets:set RESEND_API_KEY)
const resendApiKey = defineSecret('RESEND_API_KEY')
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY')
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET')

// Email templates
const emailTemplates = {
  bookingConfirmation: (booking, shop) => ({
    subject: `✅ Booking Confirmed - ${shop.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Booking Confirmed! 🎉</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Hi <strong>${booking.clientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Your appointment at <strong>${shop.name}</strong> has been confirmed!
                    </p>
                    
                    <!-- Appointment Card -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                            <strong style="color: #1e293b; font-size: 18px;">${booking.serviceName || 'Appointment'}</strong>
                            ${booking.staffName ? `<br><span style="color: #64748b; font-size: 14px;">with ${booking.staffName}</span>` : ''}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top: 12px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="color: #64748b; font-size: 14px; padding: 4px 0;">📅 Date</td>
                                <td style="color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${formatDate(booking.date)}</td>
                              </tr>
                              <tr>
                                <td style="color: #64748b; font-size: 14px; padding: 4px 0;">🕐 Time</td>
                                <td style="color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${formatTime(booking.time)}</td>
                              </tr>
                              <tr>
                                <td style="color: #64748b; font-size: 14px; padding: 4px 0;">⏱️ Duration</td>
                                <td style="color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${booking.serviceDuration || booking.duration} min</td>
                              </tr>
                              ${booking.servicePrice ? `
                              <tr>
                                <td style="color: #64748b; font-size: 14px; padding: 4px 0;">💰 Price</td>
                                <td style="color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">$${booking.servicePrice.toFixed(2)}</td>
                              </tr>
                              ` : ''}
                              ${booking.depositPaid ? `
                              <tr>
                                <td style="color: #10b981; font-size: 14px; padding: 4px 0;">✓ Deposit Paid</td>
                                <td style="color: #10b981; font-size: 14px; text-align: right; font-weight: 600;">$${booking.depositAmount.toFixed(2)}</td>
                              </tr>
                              ` : ''}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <!-- Reference Code -->
                    <div style="text-align: center; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Your reference code</p>
                      <p style="margin: 0; color: #3b82f6; font-size: 28px; font-weight: 800; letter-spacing: 2px; font-family: monospace;">${booking.refCode}</p>
                    </div>
                    
                    <!-- Manage Booking Button -->
                    <div style="text-align: center; margin-bottom: 24px;">
                      <a href="${shop.bookingUrl || '#'}/booking/${booking.refCode}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 14px;">
                        Manage Booking
                      </a>
                    </div>
                    
                    <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center;">
                      Need to reschedule or cancel? Click the button above or contact us directly.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 8px 0; color: #1e293b; font-weight: 600;">${shop.name}</p>
                    ${shop.address ? `<p style="margin: 0 0 4px 0; color: #64748b; font-size: 13px;">${shop.address}</p>` : ''}
                    ${shop.phone ? `<p style="margin: 0; color: #64748b; font-size: 13px;">${shop.phone}</p>` : ''}
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
                Powered by SpotBookie
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  bookingPending: (booking, shop) => ({
    subject: `⏳ Booking Request Received - ${shop.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Request Received ⏳</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Hi <strong>${booking.clientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Your booking request at <strong>${shop.name}</strong> has been received and is pending approval. We'll notify you once it's confirmed!
                    </p>
                    
                    <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                      <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>${booking.serviceName || 'Appointment'}</strong><br>
                        📅 ${formatDate(booking.date)} at ${formatTime(booking.time)}
                      </p>
                    </div>
                    
                    <div style="text-align: center;">
                      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Reference code</p>
                      <p style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: 800; letter-spacing: 2px; font-family: monospace;">${booking.refCode}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #1e293b; font-weight: 600;">${shop.name}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  ownerNotification: (booking, shop) => ({
    subject: `🔔 New Booking: ${booking.clientName} - ${booking.serviceName || 'Appointment'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="background: #1e293b; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px;">New Booking 🔔</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Client</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.clientName}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.clientEmail}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Phone</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.clientPhone}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Service</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.serviceName || 'N/A'}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Date</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatDate(booking.date)}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Time</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatTime(booking.time)}</td></tr>
                      <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Status</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.status === 'pending' ? '⏳ Pending Approval' : '✅ Confirmed'}</td></tr>
                      ${booking.staffName ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Staff</strong></td><td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${booking.staffName}</td></tr>` : ''}
                      ${booking.depositPaid ? `<tr><td style="padding: 8px 0; color: #10b981;"><strong>Deposit Paid</strong></td><td style="text-align: right; padding: 8px 0; color: #10b981; font-weight: bold;">$${booking.depositAmount.toFixed(2)}</td></tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }),

  reviewRequest: (booking, shop, reviewLinks) => ({
    subject: `How was your visit to ${shop.name}? ⭐`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Thanks for visiting! ⭐</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Hi <strong>${booking.clientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      We hope you enjoyed your ${booking.serviceName || 'appointment'} at <strong>${shop.name}</strong>! Your feedback helps us improve and helps others discover us.
                    </p>
                    <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      Would you take a moment to share your experience?
                    </p>
                    
                    <div style="text-align: center; margin-bottom: 24px;">
                      ${reviewLinks.google ? `
                        <a href="${reviewLinks.google}" target="_blank" style="display: inline-block; background-color: #4285f4; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 8px;">
                          ⭐ Review on Google
                        </a>
                      ` : ''}
                      ${reviewLinks.yelp ? `
                        <a href="${reviewLinks.yelp}" target="_blank" style="display: inline-block; background-color: #d32323; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 8px;">
                          ⭐ Review on Yelp
                        </a>
                      ` : ''}
                    </div>
                    
                    <p style="margin: 0; color: #94a3b8; font-size: 14px; text-align: center;">
                      Thank you for your support! 🙏
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #1e293b; font-weight: 600;">${shop.name}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  })
}

// Helper functions

// HTML escape to prevent XSS in email templates
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(dateString) {
  const date = new Date(dateString + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Sanitize booking object for safe HTML rendering
function sanitizeBooking(booking) {
  return {
    ...booking,
    clientName: escapeHtml(booking.clientName),
    clientEmail: escapeHtml(booking.clientEmail),
    clientPhone: escapeHtml(booking.clientPhone),
    serviceName: escapeHtml(booking.serviceName),
    staffName: escapeHtml(booking.staffName),
    notes: escapeHtml(booking.notes),
  }
}

// Sanitize shop object for safe HTML rendering
function sanitizeShop(shop) {
  return {
    ...shop,
    name: escapeHtml(shop.name),
    address: escapeHtml(shop.address),
    phone: escapeHtml(shop.phone),
    tagline: escapeHtml(shop.tagline),
  }
}

// Cloud Function: Send email on new booking
exports.onBookingCreated = onDocumentCreated(
  {
    document: 'shops/{shopId}/bookings/{bookingId}',
    secrets: [resendApiKey]
  },
  async (event) => {
    const booking = event.data.data()
    const shopId = event.params.shopId
    
    console.log(`New booking created: ${event.params.bookingId} for shop ${shopId}`)
    
    try {
      // Get shop details
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        console.error('Shop not found:', shopId)
        return
      }
      const shopData = shopDoc.data()
      shopData.bookingUrl = `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shopData.slug}`
      
      // Sanitize user input for HTML email templates (XSS prevention)
      const safeBooking = sanitizeBooking(booking)
      const safeShop = sanitizeShop(shopData)
      
      // Initialize Resend
      const resend = new Resend(resendApiKey.value())
      
      // Send confirmation email to client
      const template = booking.status === 'pending' 
        ? emailTemplates.bookingPending(safeBooking, safeShop)
        : emailTemplates.bookingConfirmation(safeBooking, safeShop)
      
      await resend.emails.send({
        from: 'SpotBookie <onboarding@resend.dev>',
        to: booking.clientEmail,  // Use original email for sending
        subject: template.subject,
        html: template.html
      })
      console.log(`Confirmation email sent to ${booking.clientEmail}`)
      
      // Send notification to shop owner if they have an email
      if (shopData.ownerEmail) {
        const ownerTemplate = emailTemplates.ownerNotification(safeBooking, safeShop)
        await resend.emails.send({
          from: 'SpotBookie <onboarding@resend.dev>',
          to: shopData.ownerEmail,  // Use original email for sending
          subject: ownerTemplate.subject,
          html: ownerTemplate.html
        })
        console.log(`Owner notification sent to ${shopData.ownerEmail}`)
      }
      
      // Update booking to mark email as sent
      await event.data.ref.update({
        emailSent: true,
        emailSentAt: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Error sending booking email:', error)
    }
  }
)

// Cloud Function: Send email when booking status changes to confirmed
exports.onBookingConfirmed = onDocumentUpdated(
  {
    document: 'shops/{shopId}/bookings/{bookingId}',
    secrets: [resendApiKey]
  },
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    
    // Only trigger if status changed from pending to confirmed
    if (before.status === 'pending' && after.status === 'confirmed') {
      console.log(`Booking confirmed: ${event.params.bookingId}`)
      
      try {
        const shopId = event.params.shopId
        const shopDoc = await db.collection('shops').doc(shopId).get()
        if (!shopDoc.exists) return
        
        const shopData = shopDoc.data()
        shopData.bookingUrl = `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shopData.slug}`
        
        // Sanitize for XSS prevention
        const safeBooking = sanitizeBooking(after)
        const safeShop = sanitizeShop(shopData)
        
        const resend = new Resend(resendApiKey.value())
        const template = emailTemplates.bookingConfirmation(safeBooking, safeShop)
        
        await resend.emails.send({
          from: 'SpotBookie <onboarding@resend.dev>',
          to: after.clientEmail,
          subject: '✅ Your Booking is Confirmed!',
          html: template.html
        })
        console.log(`Confirmation email sent to ${after.clientEmail}`)
        
      } catch (error) {
        console.error('Error sending confirmation email:', error)
      }
    }
  }
)

// Cloud Function: Send review request when booking is completed
exports.onBookingCompleted = onDocumentUpdated(
  {
    document: 'shops/{shopId}/bookings/{bookingId}',
    secrets: [resendApiKey]
  },
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    
    // Only trigger if status changed to completed (from any other status)
    if (before.status !== 'completed' && after.status === 'completed') {
      console.log(`Booking completed: ${event.params.bookingId}`)
      
      try {
        const shopId = event.params.shopId
        const bookingId = event.params.bookingId
        const shopDoc = await db.collection('shops').doc(shopId).get()
        if (!shopDoc.exists) return
        
        const shop = shopDoc.data()
        const reviewSettings = shop.reviewSettings || {}
        
        // Check if review requests are enabled
        if (!reviewSettings.enabled) {
          console.log('Review requests disabled for shop')
          return
        }
        
        // Check if we have at least one review platform configured
        if (!reviewSettings.googlePlaceId && !reviewSettings.yelpBusinessId) {
          console.log('No review platforms configured')
          return
        }
        
        // Check if we already sent a review request for this booking
        if (after.reviewRequestSentAt) {
          console.log('Review request already sent for this booking')
          return
        }
        
        // Build review links
        const reviewLinks = {}
        if (reviewSettings.googlePlaceId) {
          reviewLinks.google = `https://search.google.com/local/writereview?placeid=${reviewSettings.googlePlaceId}`
        }
        if (reviewSettings.yelpBusinessId) {
          reviewLinks.yelp = `https://www.yelp.com/writeareview/biz/${reviewSettings.yelpBusinessId}`
        }
        
        // Send review request email (sanitize for XSS prevention)
        const safeBooking = sanitizeBooking(after)
        const safeShop = sanitizeShop(shop)
        
        const resend = new Resend(resendApiKey.value())
        const template = emailTemplates.reviewRequest(safeBooking, safeShop, reviewLinks)
        
        await resend.emails.send({
          from: 'SpotBookie <onboarding@resend.dev>',
          to: after.clientEmail,
          subject: template.subject,
          html: template.html
        })
        
        // Mark that we sent the review request
        await db.collection('shops').doc(shopId).collection('bookings').doc(bookingId).update({
          reviewRequestSentAt: FieldValue.serverTimestamp()
        })
        
        console.log(`Review request sent to ${after.clientEmail}`)
        
      } catch (error) {
        console.error('Error sending review request:', error)
      }
    }
  }
)

// ============================================================
// STRIPE SUBSCRIPTION FUNCTIONS
// ============================================================

// Create a Stripe Checkout session for subscription upgrade
exports.createCheckoutSession = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId, priceId, successUrl, cancelUrl } = req.body

      if (!shopId || !priceId) {
        res.status(400).json({ error: 'Missing shopId or priceId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      // Check if shop already has a Stripe customer
      let customerId = shop.stripeCustomerId
      if (!customerId) {
        // Create a new Stripe customer
        const customer = await stripe.customers.create({
          email: shop.ownerEmail,
          metadata: {
            shopId: shopId,
            shopName: shop.name,
          },
        })
        customerId = customer.id

        // Save customer ID to shop
        await db.collection('shops').doc(shopId).update({
          stripeCustomerId: customerId,
        })
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}/dashboard?subscription=success`,
        cancel_url: cancelUrl || `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}/dashboard?subscription=canceled`,
        metadata: {
          shopId: shopId,
        },
        subscription_data: {
          metadata: {
            shopId: shopId,
          },
        },
      })

      res.json({ sessionId: session.id, url: session.url })
    } catch (error) {
      console.error('Error creating checkout session:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create a Stripe Billing Portal session
exports.createBillingPortalSession = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId, returnUrl } = req.body

      if (!shopId) {
        res.status(400).json({ error: 'Missing shopId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      if (!shop.stripeCustomerId) {
        res.status(400).json({ error: 'No Stripe customer found for this shop' })
        return
      }

      // Create billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: shop.stripeCustomerId,
        return_url: returnUrl || `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}/dashboard`,
      })

      res.json({ url: session.url })
    } catch (error) {
      console.error('Error creating billing portal session:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Stripe Webhook Handler
exports.stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret]
  },
  async (req, res) => {
    const stripe = new Stripe(stripeSecretKey.value())
    const sig = req.headers['stripe-signature']

    let event
    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      res.status(400).send(`Webhook Error: ${err.message}`)
      return
    }

    console.log(`Received Stripe event: ${event.type}`)

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          await handleCheckoutComplete(session)
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object
          await handleSubscriptionUpdate(subscription)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          await handleSubscriptionDeleted(subscription)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          await handlePaymentFailed(invoice)
          break
        }

        case 'account.updated': {
          const account = event.data.object
          await handleAccountUpdated(account)
          break
        }

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      res.json({ received: true })
    } catch (error) {
      console.error('Error handling webhook:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Helper function: Map Stripe price to tier
function priceToTier(priceId) {
  // These will be set after Stripe products are created
  const priceMap = {
    // Pro tier price IDs (test and live)
    'price_pro_monthly': 'pro',
    // Unlimited tier price IDs (test and live)
    'price_unlimited_monthly': 'unlimited',
  }
  
  // Check environment variable overrides or metadata
  // For now, we'll determine tier from the price amount
  return priceMap[priceId] || null
}

// Helper function: Handle checkout.session.completed
async function handleCheckoutComplete(session) {
  const shopId = session.metadata?.shopId
  if (!shopId) {
    console.error('No shopId in session metadata')
    return
  }

  const subscriptionId = session.subscription
  const customerId = session.customer

  console.log(`Checkout completed for shop ${shopId}, subscription ${subscriptionId}`)

  // Get subscription details to determine tier
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || stripeSecretKey.value())
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price.id
  const amount = subscription.items.data[0]?.price.unit_amount

  // Determine tier based on price amount (in cents)
  let tier = 'pro' // default
  if (amount === 7900) {
    tier = 'unlimited'
  } else if (amount === 2900) {
    tier = 'pro'
  }

  // Update shop document
  await db.collection('shops').doc(shopId).update({
    subscriptionTier: tier,
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    subscriptionUpdatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Shop ${shopId} upgraded to ${tier}`)
}

// Helper function: Handle customer.subscription.updated
async function handleSubscriptionUpdate(subscription) {
  const shopId = subscription.metadata?.shopId
  if (!shopId) {
    // Try to find shop by subscription ID
    const shopsSnapshot = await db.collection('shops')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get()

    if (shopsSnapshot.empty) {
      console.error('No shop found for subscription:', subscription.id)
      return
    }

    const shopDoc = shopsSnapshot.docs[0]
    await updateShopSubscription(shopDoc.id, subscription)
    return
  }

  await updateShopSubscription(shopId, subscription)
}

async function updateShopSubscription(shopId, subscription) {
  const status = subscription.status // active, past_due, canceled, etc.
  const cancelAtPeriodEnd = subscription.cancel_at_period_end
  const currentPeriodEnd = subscription.current_period_end
  const amount = subscription.items.data[0]?.price.unit_amount

  // Determine tier based on price amount
  let tier = 'pro'
  if (amount === 7900) {
    tier = 'unlimited'
  } else if (amount === 2900) {
    tier = 'pro'
  }

  const updateData = {
    subscriptionStatus: status,
    subscriptionTier: tier,
    subscriptionUpdatedAt: FieldValue.serverTimestamp(),
  }

  // If subscription is set to cancel at period end, record when it ends
  if (cancelAtPeriodEnd && currentPeriodEnd) {
    updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000)
  } else {
    updateData.subscriptionEndsAt = null
  }

  await db.collection('shops').doc(shopId).update(updateData)
  console.log(`Shop ${shopId} subscription updated: ${status}, tier: ${tier}`)
}

// Helper function: Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription) {
  const shopId = subscription.metadata?.shopId
  
  let targetShopId = shopId
  if (!targetShopId) {
    // Try to find shop by subscription ID
    const shopsSnapshot = await db.collection('shops')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get()

    if (shopsSnapshot.empty) {
      console.error('No shop found for deleted subscription:', subscription.id)
      return
    }

    targetShopId = shopsSnapshot.docs[0].id
  }

  // Downgrade to free tier
  await db.collection('shops').doc(targetShopId).update({
    subscriptionTier: 'free',
    subscriptionStatus: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionEndsAt: null,
    subscriptionUpdatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Shop ${targetShopId} downgraded to free tier`)
}

// Helper function: Handle invoice.payment_failed
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  // Find shop by subscription ID
  const shopsSnapshot = await db.collection('shops')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get()

  if (shopsSnapshot.empty) {
    console.error('No shop found for failed payment, subscription:', subscriptionId)
    return
  }

  const shopDoc = shopsSnapshot.docs[0]
  
  await db.collection('shops').doc(shopDoc.id).update({
    subscriptionStatus: 'past_due',
    subscriptionUpdatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Shop ${shopDoc.id} marked as past_due due to failed payment`)
}

// ============================================================
// STRIPE CONNECT FUNCTIONS
// ============================================================

// Create a Stripe Connect Express account for a shop
exports.createConnectAccount = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId, email, businessName, returnUrl, refreshUrl } = req.body

      if (!shopId) {
        res.status(400).json({ error: 'Missing shopId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      // Check if shop already has a Connect account
      if (shop.stripeAccountId) {
        // Return existing account
        res.json({ 
          accountId: shop.stripeAccountId,
          alreadyExists: true
        })
        return
      }

      // Create Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || shop.ownerEmail,
        business_profile: {
          name: businessName || shop.name,
          url: `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}`,
        },
        metadata: {
          shopId: shopId,
          shopName: shop.name,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      // Save account ID to shop
      await db.collection('shops').doc(shopId).update({
        stripeAccountId: account.id,
        stripeAccountStatus: 'pending',
        stripeOnboardingComplete: false,
        payoutsEnabled: false,
        connectCreatedAt: FieldValue.serverTimestamp(),
      })

      console.log(`Created Connect account ${account.id} for shop ${shopId}`)

      res.json({ 
        accountId: account.id,
        alreadyExists: false
      })
    } catch (error) {
      console.error('Error creating Connect account:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create an account link for onboarding
exports.createAccountLink = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId, returnUrl, refreshUrl } = req.body

      if (!shopId) {
        res.status(400).json({ error: 'Missing shopId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      if (!shop.stripeAccountId) {
        res.status(400).json({ error: 'No Connect account found. Create one first.' })
        return
      }

      // Create account link
      const accountLink = await stripe.accountLinks.create({
        account: shop.stripeAccountId,
        refresh_url: refreshUrl || `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}/dashboard?connect=refresh`,
        return_url: returnUrl || `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}/dashboard?connect=return`,
        type: 'account_onboarding',
      })

      console.log(`Created account link for ${shop.stripeAccountId}`)

      res.json({ url: accountLink.url })
    } catch (error) {
      console.error('Error creating account link:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Get Stripe Express Dashboard login link
exports.getConnectDashboardLink = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId } = req.body

      if (!shopId) {
        res.status(400).json({ error: 'Missing shopId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      if (!shop.stripeAccountId) {
        res.status(400).json({ error: 'No Connect account found' })
        return
      }

      // Create login link to Express dashboard
      const loginLink = await stripe.accounts.createLoginLink(shop.stripeAccountId)

      res.json({ url: loginLink.url })
    } catch (error) {
      console.error('Error creating dashboard link:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Create PaymentIntent for deposit with Connect transfer
exports.createDepositPaymentIntent = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { 
        shopId, 
        amount, // in cents
        serviceName,
        clientName,
        clientEmail,
        bookingRefCode,
        paymentMethodId 
      } = req.body

      if (!shopId || !amount) {
        res.status(400).json({ error: 'Missing shopId or amount' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      // Check if shop has a connected account
      if (!shop.stripeAccountId) {
        res.status(400).json({ 
          error: 'Shop has not connected Stripe yet',
          needsConnect: true
        })
        return
      }

      // Check if connected account can receive payments
      if (!shop.payoutsEnabled) {
        res.status(400).json({ 
          error: 'Shop Stripe account is not fully set up',
          needsOnboarding: true
        })
        return
      }

      // Calculate platform fee based on tier
      // Free tier: 5% platform fee
      // Pro/Unlimited: 0% platform fee
      const tier = shop.subscriptionTier || 'free'
      const platformFeePercent = tier === 'free' ? 5 : 0
      const applicationFeeAmount = Math.round(amount * (platformFeePercent / 100))

      // Create PaymentIntent with transfer to connected account
      const paymentIntentParams = {
        amount: amount,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        transfer_data: {
          destination: shop.stripeAccountId,
        },
        metadata: {
          shopId: shopId,
          shopName: shop.name,
          serviceName: serviceName || '',
          clientName: clientName || '',
          clientEmail: clientEmail || '',
          bookingRefCode: bookingRefCode || '',
          platformFeePercent: platformFeePercent.toString(),
        },
        description: `Deposit for ${serviceName || 'appointment'} at ${shop.name}`,
      }

      // Add application fee if applicable
      if (applicationFeeAmount > 0) {
        paymentIntentParams.application_fee_amount = applicationFeeAmount
      }

      // Add receipt email if provided
      if (clientEmail) {
        paymentIntentParams.receipt_email = clientEmail
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

      console.log(`Created PaymentIntent ${paymentIntent.id} for shop ${shopId}, fee: ${applicationFeeAmount}`)

      res.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: amount,
        applicationFee: applicationFeeAmount,
      })
    } catch (error) {
      console.error('Error creating payment intent:', error)
      
      // Handle specific Stripe errors
      if (error.type === 'StripeCardError') {
        res.status(400).json({ error: error.message, code: error.code })
      } else {
        res.status(500).json({ error: error.message })
      }
    }
  }
)

// Get Connect account balance/earnings
exports.getConnectBalance = onRequest(
  {
    cors: true,
    secrets: [stripeSecretKey]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    try {
      const { shopId } = req.body

      if (!shopId) {
        res.status(400).json({ error: 'Missing shopId' })
        return
      }

      const stripe = new Stripe(stripeSecretKey.value())

      // Get shop data
      const shopDoc = await db.collection('shops').doc(shopId).get()
      if (!shopDoc.exists) {
        res.status(404).json({ error: 'Shop not found' })
        return
      }
      const shop = shopDoc.data()

      if (!shop.stripeAccountId) {
        res.status(400).json({ error: 'No Connect account found' })
        return
      }

      // Get account balance
      const balance = await stripe.balance.retrieve({
        stripeAccount: shop.stripeAccountId,
      })

      // Get recent payouts
      const payouts = await stripe.payouts.list({
        limit: 10,
      }, {
        stripeAccount: shop.stripeAccountId,
      })

      // Get recent charges (payments received)
      const charges = await stripe.charges.list({
        limit: 20,
      }, {
        stripeAccount: shop.stripeAccountId,
      })

      res.json({
        balance: {
          available: balance.available,
          pending: balance.pending,
        },
        recentPayouts: payouts.data.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrivalDate: p.arrival_date,
          created: p.created,
        })),
        recentCharges: charges.data.map(c => ({
          id: c.id,
          amount: c.amount,
          currency: c.currency,
          status: c.status,
          description: c.description,
          created: c.created,
          metadata: c.metadata,
        })),
      })
    } catch (error) {
      console.error('Error getting Connect balance:', error)
      res.status(500).json({ error: error.message })
    }
  }
)

// Helper function: Handle account.updated webhook
async function handleAccountUpdated(account) {
  const shopId = account.metadata?.shopId

  let targetShopId = shopId
  if (!targetShopId) {
    // Try to find shop by account ID
    const shopsSnapshot = await db.collection('shops')
      .where('stripeAccountId', '==', account.id)
      .limit(1)
      .get()

    if (shopsSnapshot.empty) {
      console.error('No shop found for Connect account:', account.id)
      return
    }

    targetShopId = shopsSnapshot.docs[0].id
  }

  // Determine account status
  let status = 'pending'
  if (account.details_submitted && account.charges_enabled) {
    status = 'active'
  } else if (account.requirements?.disabled_reason) {
    status = 'restricted'
  }

  // Update shop document
  await db.collection('shops').doc(targetShopId).update({
    stripeAccountStatus: status,
    stripeOnboardingComplete: account.details_submitted || false,
    payoutsEnabled: account.payouts_enabled || false,
    chargesEnabled: account.charges_enabled || false,
    connectUpdatedAt: FieldValue.serverTimestamp(),
  })

  console.log(`Updated Connect status for shop ${targetShopId}: ${status}, payouts: ${account.payouts_enabled}`)
}


// ============================================================
// SMS BOOKING FUNCTIONS
// ============================================================
const { smsWebhook } = require('./smsWebhook')
const { smsPaymentComplete } = require('./smsPayment')
exports.smsWebhook = smsWebhook
exports.smsPaymentComplete = smsPaymentComplete

// Admin-only: Delete a user account
const ADMIN_EMAILS = ["aaron.sharp2011@gmail.com"]

exports.adminDeleteUser = onCall(async (request) => {
  // Check if caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in")
  }

  // Check if caller is admin
  const callerEmail = request.auth.token.email
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new HttpsError("permission-denied", "Admin access required")
  }

  const { userId, deleteShops } = request.data
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required")
  }

  const auth = getAuth()
  const results = { userId, shopsDeleted: 0, errors: [] }

  try {
    // Get user info before deletion
    let userRecord
    try {
      userRecord = await auth.getUser(userId)
    } catch (e) {
      throw new HttpsError("not-found", "User not found in Firebase Auth")
    }

    // Delete shops owned by this user if requested
    if (deleteShops) {
      const shopsSnapshot = await db.collection("shops")
        .where("ownerId", "==", userId)
        .get()

      for (const shopDoc of shopsSnapshot.docs) {
        try {
          // Delete subcollections
          const subcollections = ["staff", "bookings", "availability", "waitlist", "schedulePresets", "services", "walkins", "clientNotes"]
          for (const subcol of subcollections) {
            const subcolSnapshot = await shopDoc.ref.collection(subcol).get()
            const batch = db.batch()
            subcolSnapshot.docs.forEach(doc => batch.delete(doc.ref))
            if (subcolSnapshot.docs.length > 0) {
              await batch.commit()
            }
          }
          // Delete shop document
          await shopDoc.ref.delete()
          results.shopsDeleted++
        } catch (e) {
          results.errors.push(`Failed to delete shop ${shopDoc.id}: ${e.message}`)
        }
      }
    }

    // Delete user document from Firestore
    try {
      await db.collection("users").doc(userId).delete()
    } catch (e) {
      results.errors.push(`Failed to delete user document: ${e.message}`)
    }

    // Delete user from Firebase Auth
    await auth.deleteUser(userId)

    return {
      success: true,
      message: `User ${userRecord.email || userId} deleted`,
      ...results
    }
  } catch (error) {
    console.error("Error deleting user:", error)
    throw new HttpsError("internal", error.message)
  }
})
