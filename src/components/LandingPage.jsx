import { Link } from 'react-router-dom'
import { Calendar, Clock, Users, Shield } from 'lucide-react'

function LandingPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="bg-white/98 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10 max-w-3xl w-full text-center">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 shadow-lg shadow-blue-500/30">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Scheduling made simple for beauty professionals
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Let your clients book appointments online. Manage your availability, track bookings, and grow your business — all in one place.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/register"
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5 text-lg"
          >
            Get Started — It's Free
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
            <Clock className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Easy Scheduling</h3>
            <p className="text-sm text-slate-600">
              Set your hours, generate time slots, and let clients book instantly.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
            <Users className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Your Own Booking Page</h3>
            <p className="text-sm text-slate-600">
              Get a unique link to share with clients. No app downloads required.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
            <Shield className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Secure Dashboard</h3>
            <p className="text-sm text-slate-600">
              Manage bookings, cancel appointments, and control your schedule.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
