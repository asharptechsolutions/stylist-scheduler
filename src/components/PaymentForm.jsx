import { useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise } from '../stripe'
import { CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1e293b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
}

function CheckoutForm({ amount, onSuccess, onCancel, clientInfo, serviceName }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [cardComplete, setCardComplete] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)

    // Create payment method
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: clientInfo.name,
        email: clientInfo.email,
        phone: clientInfo.phone,
      },
    })

    if (pmError) {
      setError(pmError.message)
      setProcessing(false)
      return
    }

    // In a real implementation, you would:
    // 1. Send paymentMethod.id to your backend
    // 2. Create a PaymentIntent on the backend with the secret key
    // 3. Confirm the payment
    
    // For now, we'll simulate success since we don't have a backend
    // The payment method was created successfully, which validates the card
    console.log('Payment method created:', paymentMethod.id)
    
    // Simulate a brief processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setProcessing(false)
    onSuccess({
      paymentMethodId: paymentMethod.id,
      last4: paymentMethod.card.last4,
      brand: paymentMethod.card.brand,
    })
  }

  const formatAmount = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount display */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm font-medium">Deposit for {serviceName}</p>
            <p className="text-3xl font-bold mt-1">{formatAmount(amount)}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Card input */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Card Details
        </label>
        <div className="p-4 border-2 border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all bg-white">
          <CardElement 
            options={CARD_ELEMENT_OPTIONS}
            onChange={(e) => {
              setCardComplete(e.complete)
              if (e.error) {
                setError(e.error.message)
              } else {
                setError(null)
              }
            }}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Security notice */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Lock className="w-3.5 h-3.5" />
        <span>Your payment is secured with 256-bit encryption</span>
      </div>

      {/* Test mode notice */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>
          <strong>Test Mode:</strong> Use card number <code className="bg-amber-100 px-1 rounded">4242 4242 4242 4242</code> with any future date and CVC.
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={processing || !stripe || !cardComplete}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay {formatAmount(amount)}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all border border-slate-200 disabled:opacity-50"
        >
          Back
        </button>
      </div>
    </form>
  )
}

function PaymentForm({ amount, onSuccess, onCancel, clientInfo, serviceName }) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm 
        amount={amount} 
        onSuccess={onSuccess} 
        onCancel={onCancel}
        clientInfo={clientInfo}
        serviceName={serviceName}
      />
    </Elements>
  )
}

export default PaymentForm
