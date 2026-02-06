const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { Resend } = require('resend')

// Initialize Firebase Admin
initializeApp()
const db = getFirestore()

// Define secrets (set these with: firebase functions:secrets:set RESEND_API_KEY)
const resendApiKey = defineSecret('RESEND_API_KEY')

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
  })
}

// Helper functions
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
      const shop = shopDoc.data()
      shop.bookingUrl = `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}`
      
      // Initialize Resend
      const resend = new Resend(resendApiKey.value())
      
      // Send confirmation email to client
      const template = booking.status === 'pending' 
        ? emailTemplates.bookingPending(booking, shop)
        : emailTemplates.bookingConfirmation(booking, shop)
      
      await resend.emails.send({
        from: 'SpotBookie <onboarding@resend.dev>',
        to: booking.clientEmail,
        subject: template.subject,
        html: template.html
      })
      console.log(`Confirmation email sent to ${booking.clientEmail}`)
      
      // Send notification to shop owner if they have an email
      if (shop.ownerEmail) {
        const ownerTemplate = emailTemplates.ownerNotification(booking, shop)
        await resend.emails.send({
          from: 'SpotBookie <onboarding@resend.dev>',
          to: shop.ownerEmail,
          subject: ownerTemplate.subject,
          html: ownerTemplate.html
        })
        console.log(`Owner notification sent to ${shop.ownerEmail}`)
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
        
        const shop = shopDoc.data()
        shop.bookingUrl = `https://asharptechsolutions.github.io/stylist-scheduler/#/shop/${shop.slug}`
        
        const resend = new Resend(resendApiKey.value())
        const template = emailTemplates.bookingConfirmation(after, shop)
        
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
