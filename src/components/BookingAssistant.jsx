import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, ChevronRight } from 'lucide-react'

/* ── Typing indicator dots ── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Single chat message bubble ── */
function ChatMessage({ message, onSelectService, onQuickReply }) {
  const isBot = message.sender === 'bot'

  return (
    <div className={`flex items-end gap-2 mb-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] space-y-2`}>
        {/* Text bubble */}
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
            isBot
              ? 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md'
              : 'bg-blue-600 text-white rounded-2xl rounded-br-md'
          }`}
        >
          {message.text}
        </div>

        {/* Service cards */}
        {message.serviceCards && message.serviceCards.length > 0 && (
          <div className="space-y-1.5">
            {message.serviceCards.map((svc) => (
              <button
                key={svc.id}
                onClick={() => onSelectService(svc)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left transition-all hover:shadow-sm group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                    {svc.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDuration(svc.duration)} · {formatPrice(svc.price)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-600 whitespace-nowrap flex items-center gap-0.5">
                  Book <ChevronRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Quick reply buttons */}
        {message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(qr)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-400 rounded-full transition-all"
              >
                {qr}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helper formatters ── */
function formatPrice(price) {
  if (price == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

function formatDuration(minutes) {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs} hour${hrs > 1 ? 's' : ''}`
}

/* ── Response engine — keyword-based ── */
function generateResponse(text, { services, staffMembers, shop }) {
  const msg = text.toLowerCase().trim()
  const shopName = shop?.name || 'our shop'

  // Greeting
  if (/^(hi|hello|hey|howdy|sup|yo|hiya|good\s*(morning|afternoon|evening))/.test(msg)) {
    return {
      text: `Hi! 👋 I'm here to help you book an appointment at ${shopName}. What are you looking for?`,
      quickReplies: ['View Services', 'View Staff', 'How to Book'],
    }
  }

  // How to book / booking help
  if (/how (do i|to|can i) book|help.*(book|appoint)|booking help/i.test(msg)) {
    return {
      text: "Booking is easy! Here's how:\n\n1️⃣ Choose a service\n2️⃣ Pick your stylist\n3️⃣ Select a date & time\n4️⃣ Fill in your details\n\nThat's it! Would you like to start?",
      quickReplies: ['View Services', 'View Staff'],
    }
  }

  // Service inquiry
  if (/what (services|do you offer)|menu|prices|how much|service list|your services/i.test(msg) || msg === 'view services') {
    if (!services || services.length === 0) {
      return { text: "We don't have any services listed right now. Please check back later!" }
    }
    const list = services
      .map((s) => `• ${s.name} — ${formatDuration(s.duration)} · ${formatPrice(s.price)}`)
      .join('\n')
    return {
      text: `Here are our services:\n\n${list}\n\nWould you like to book one of these? Just tap below! 👇`,
      serviceCards: services,
    }
  }

  // Specific service match (fuzzy)
  if (services && services.length > 0) {
    const matched = services.find((s) => {
      const name = s.name.toLowerCase()
      return msg.includes(name) || name.includes(msg)
    })
    if (matched && msg.length > 2) {
      return {
        text: `Great choice! Here are the details for **${matched.name}**:\n\n⏱ Duration: ${formatDuration(matched.duration)}\n💰 Price: ${formatPrice(matched.price)}${matched.description ? `\n📝 ${matched.description}` : ''}\n\nWould you like to book this service? Tap "Book" below!`,
        serviceCards: [matched],
        quickReplies: ['View All Services', 'View Staff'],
      }
    }
  }

  // Duration inquiry
  if (/how long|how much time|duration/i.test(msg)) {
    if (!services || services.length === 0) {
      return { text: 'No services are listed right now. Check back soon!' }
    }
    const list = services
      .map((s) => `• ${s.name}: ${formatDuration(s.duration)}`)
      .join('\n')
    return {
      text: `Here's how long each service takes:\n\n${list}`,
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Staff inquiry
  if (/who works|stylists?|staff|team|barber|who('s| is) (here|available)|your (team|people)/i.test(msg) || msg === 'view staff') {
    if (!staffMembers || staffMembers.length === 0) {
      return { text: "We don't have any team members listed right now." }
    }
    const list = staffMembers
      .map((s) => {
        let line = `• ${s.name}`
        if (s.role) line += ` — ${s.role}`
        if (s.bio) line += `\n  "${s.bio.slice(0, 80)}${s.bio.length > 80 ? '…' : ''}"`
        return line
      })
      .join('\n')
    return {
      text: `Meet our team! 💇\n\n${list}\n\nYou can pick your preferred stylist during booking.`,
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Availability
  if (/available|open slot|when can i|next available|free slot|any opening/i.test(msg)) {
    // Try to derive days from staff weekly hours
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const availableDays = new Set()

    if (staffMembers && staffMembers.length > 0) {
      staffMembers.forEach((s) => {
        if (s.weeklyHours) {
          Object.entries(s.weeklyHours).forEach(([day, config]) => {
            if (config && config.enabled) {
              availableDays.add(day)
            }
          })
        }
      })
    }

    const daysStr =
      availableDays.size > 0
        ? [...availableDays]
            .sort((a, b) => dayNames.indexOf(a) - dayNames.indexOf(b))
            .join(', ')
        : 'most days'

    return {
      text: `You can check available times by selecting a service and date in the booking flow above. We're generally available on ${daysStr}. 📅`,
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Business hours
  if (/hours|when are you open|business hours|open hours|what time|operating/i.test(msg)) {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const hoursMap = {}

    if (staffMembers && staffMembers.length > 0) {
      staffMembers.forEach((s) => {
        if (s.weeklyHours) {
          Object.entries(s.weeklyHours).forEach(([day, config]) => {
            if (config && config.enabled && config.start && config.end) {
              if (!hoursMap[day]) hoursMap[day] = { start: config.start, end: config.end }
              else {
                if (config.start < hoursMap[day].start) hoursMap[day].start = config.start
                if (config.end > hoursMap[day].end) hoursMap[day].end = config.end
              }
            }
          })
        }
      })
    }

    if (Object.keys(hoursMap).length > 0) {
      const formatHour = (t) => {
        const [h, m] = t.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const dh = hour % 12 || 12
        return `${dh}:${m} ${ampm}`
      }
      const lines = dayNames
        .filter((d) => hoursMap[d])
        .map((d) => `• ${d}: ${formatHour(hoursMap[d].start)} – ${formatHour(hoursMap[d].end)}`)
        .join('\n')
      return {
        text: `Here are our general hours:\n\n${lines}\n\nHours may vary by stylist. Select a service to see exact availability.`,
        quickReplies: ['View Services', 'View Staff'],
      }
    }

    return {
      text: 'Our hours vary by stylist. You can see exact availability by selecting a service above.',
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Contact / location
  if (/phone|address|contact|where|location|email|reach/i.test(msg)) {
    return {
      text: 'For contact information, please reach out to the shop directly. You can also find us through the booking confirmation email after you book! 📧',
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Cancel / reschedule
  if (/cancel|reschedule|change my (booking|appointment)|modify/i.test(msg)) {
    return {
      text: "You can manage your booking using the reference code you received. Go to your confirmation email and click 'Manage Booking' to reschedule or cancel. 🔄",
      quickReplies: ['How to Book', 'View Services'],
    }
  }

  // Waitlist
  if (/waitlist|no availability|fully booked|no slots|all booked|sold out/i.test(msg)) {
    return {
      text: "If there are no available slots, you can join our waitlist and we'll notify you when something opens up! Look for the 'Join Waitlist' button when viewing available times. 🔔",
      quickReplies: ['View Services', 'How to Book'],
    }
  }

  // Thanks
  if (/^(thanks?|thank you|thx|ty|cheers|appreciate)/i.test(msg)) {
    return {
      text: "You're welcome! 😊 Let me know if you need anything else.",
      quickReplies: ['View Services', 'View Staff', 'How to Book'],
    }
  }

  // Default
  return {
    text: "I'm not sure about that. You can browse our services above, or try asking about our services, staff, or availability! 🤔",
    quickReplies: ['View Services', 'View Staff', 'How to Book'],
  }
}

/* ═══════════════════════════════════════
   BookingAssistant — main component
   ═══════════════════════════════════════ */
export default function BookingAssistant({ services, staffMembers, shop, onSelectService }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewDismissed, setPreviewDismissed] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const shopName = shop?.name || 'our shop'

  // Scroll to bottom when messages change or typing starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Auto-show preview bubble after 3s, auto-open after 5s (once per session)
  useEffect(() => {
    const previewTimer = setTimeout(() => {
      if (!isOpen && !previewDismissed) {
        setShowPreview(true)
      }
    }, 3000)

    const autoOpenTimer = setTimeout(() => {
      if (!hasAutoOpened) {
        setHasAutoOpened(true)
        setShowPreview(false)
        setIsOpen(true)
        setMessages([
          {
            id: 'welcome',
            sender: 'bot',
            text: `Hi! 👋 Welcome to ${shopName}. I can help you find the right service and book an appointment. What are you looking for?`,
            quickReplies: ['View Services', 'View Staff', 'How to Book'],
          },
        ])
      }
    }, 5000)

    return () => {
      clearTimeout(previewTimer)
      clearTimeout(autoOpenTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleOpen = useCallback(() => {
    setShowPreview(false)
    setPreviewDismissed(true)
    setIsOpen(true)

    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `Hi! 👋 Welcome to ${shopName}. I can help you find the right service and book an appointment. What are you looking for?`,
          quickReplies: ['View Services', 'View Staff', 'How to Book'],
        },
      ])
    }
  }, [messages.length, shopName])

  const addBotResponse = useCallback(
    (userText) => {
      setIsTyping(true)
      const delay = 400 + Math.random() * 600

      setTimeout(() => {
        const response = generateResponse(userText, { services, staffMembers, shop })
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: response.text,
            serviceCards: response.serviceCards || null,
            quickReplies: response.quickReplies || null,
          },
        ])
        setIsTyping(false)
      }, delay)
    },
    [services, staffMembers, shop]
  )

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text },
    ])
    setInputValue('')
    addBotResponse(text)
  }, [inputValue, addBotResponse])

  const handleQuickReply = useCallback(
    (text) => {
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, sender: 'user', text },
      ])
      addBotResponse(text)
    },
    [addBotResponse]
  )

  const handleServiceSelect = useCallback(
    (service) => {
      if (onSelectService) {
        onSelectService(service)
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: `Great! I've selected "${service.name}" for you. You can now pick your stylist and time above. 🎉`,
          },
        ])
        // Minimize after short delay so user sees the main flow
        setTimeout(() => setIsOpen(false), 1500)
      }
    },
    [onSelectService]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* ── Preview bubble ── */}
      {showPreview && !isOpen && (
        <div className="fixed bottom-24 right-5 z-50 animate-fade-in">
          <button
            onClick={handleOpen}
            className="bg-white border border-slate-200 shadow-lg rounded-2xl rounded-br-md px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all max-w-[220px]"
          >
            Need help booking? 💬
          </button>
          <button
            onClick={() => {
              setShowPreview(false)
              setPreviewDismissed(true)
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Chat window ── */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-in
                     w-[calc(100vw-2.5rem)] max-w-[380px] h-[min(500px,calc(100vh-7rem))]
                     sm:w-[380px] sm:right-5 sm:bottom-20"
          style={{ transformOrigin: 'bottom right' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">BookFlow Assistant</h3>
                <p className="text-[11px] text-blue-100">Ask me anything about booking</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 bg-slate-50/50">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onSelectService={handleServiceSelect}
                onQuickReply={handleQuickReply}
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 bg-white flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white disabled:text-slate-400 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating chat bubble ── */}
      <button
        onClick={() => {
          if (isOpen) {
            setIsOpen(false)
          } else {
            handleOpen()
          }
        }}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-xl ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800'
            : 'bg-blue-600 hover:bg-blue-700 chat-bubble-pulse'
        }`}
        aria-label={isOpen ? 'Close chat assistant' : 'Open chat assistant'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  )
}
