import { Link } from 'react-router-dom'
import { Calendar, Clock, Users, Shield, CalendarCheck, ArrowRight, Star, CheckCircle, Sparkles, Globe, Zap } from 'lucide-react'

function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
        <CalendarCheck className="w-[18px] h-[18px] text-white" />
      </div>
      <span className="text-xl font-extrabold tracking-tight text-slate-900">
        Spot<span className="text-amber-500">Bookie</span>
      </span>
    </Link>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navigation ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-600/25 hover:-translate-y-0.5"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register"
              className="sm:hidden px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-50 rounded-full blur-3xl opacity-50 translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm font-medium text-blue-700 mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Free for beauty professionals
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
                Online booking
                <br />
                <span className="text-blue-600">made effortless</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                Let clients book 24/7. Manage your team, services, and schedule from one beautiful dashboard. No more phone tag.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-base shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all hover:-translate-y-0.5"
                >
                  Start for Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-base border border-slate-200 transition-all"
                >
                  See How It Works
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-5 text-sm text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Free to use</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Setup in 2 min</span>
                </div>
              </div>
            </div>

            {/* Right: Mockup */}
            <div className="relative animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono">
                      bookflow.app/shop/janes-salon
                    </div>
                  </div>
                </div>

                {/* Mockup content */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">
                      J
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Jane's Salon</div>
                      <div className="text-xs text-slate-500">Book your next appointment</div>
                    </div>
                  </div>

                  {/* Service cards */}
                  <div className="space-y-2.5">
                    {[
                      { name: 'Haircut & Style', price: '$45', time: '45 min', color: 'bg-blue-500' },
                      { name: 'Color Treatment', price: '$120', time: '2 hours', color: 'bg-violet-500' },
                      { name: 'Blowout', price: '$35', time: '30 min', color: 'bg-emerald-500' },
                    ].map((s) => (
                      <div key={s.name} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-default">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 ${s.color} rounded-full`} />
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.time}</div>
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{s.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg shadow-slate-200/60 border border-slate-100 px-4 py-3 flex items-center gap-3 animate-float">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Booking confirmed</div>
                  <div className="text-sm font-semibold text-slate-800">Tomorrow at 2:00 PM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof Bar ─── */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">500+</div>
              <div className="text-sm text-slate-500 font-medium">Businesses trust SpotBookie</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-200" />
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">10,000+</div>
              <div className="text-sm text-slate-500 font-medium">Appointments booked</div>
            </div>
            <div className="hidden sm:block w-px h-10 bg-slate-200" />
            <div>
              <div className="flex items-center justify-center gap-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
                4.9 <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              </div>
              <div className="text-sm text-slate-500 font-medium">Average rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Everything you need to run your bookings
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Built specifically for beauty professionals, salons, and service businesses. Simple, powerful, and free.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {[
              {
                icon: <Calendar className="w-6 h-6" />,
                title: 'Smart Scheduling',
                desc: 'Set weekly hours with breaks. Slots auto-generate so your calendar is always up to date.',
                color: 'bg-blue-100 text-blue-600',
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: 'Multi-Staff Support',
                desc: 'Add your whole team. Each member gets their own schedule, hours, and bookings.',
                color: 'bg-violet-100 text-violet-600',
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: 'Instant Booking',
                desc: 'Clients pick a service, choose a stylist, and book — all in under a minute.',
                color: 'bg-amber-100 text-amber-600',
              },
              {
                icon: <Globe className="w-6 h-6" />,
                title: 'Your Own Booking Page',
                desc: 'Get a unique link to share anywhere. No app downloads needed for your clients.',
                color: 'bg-emerald-100 text-emerald-600',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-7 border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Up and running in minutes
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Three simple steps to start accepting online bookings today.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-14 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-blue-200 via-violet-200 to-emerald-200" />

            {[
              {
                step: '1',
                title: 'Create your account',
                desc: 'Sign up free in 30 seconds. Name your shop and you\'re in.',
                color: 'from-blue-500 to-blue-600',
                shadow: 'shadow-blue-500/30',
              },
              {
                step: '2',
                title: 'Set up your shop',
                desc: 'Add your services, team, and weekly hours. SpotBookie handles the rest.',
                color: 'from-violet-500 to-violet-600',
                shadow: 'shadow-violet-500/30',
              },
              {
                step: '3',
                title: 'Share your link',
                desc: 'Send your booking page to clients. They book, you get notified.',
                color: 'from-emerald-500 to-emerald-600',
                shadow: 'shadow-emerald-500/30',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-xl font-extrabold shadow-lg ${item.shadow} relative z-10`}>
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Loved by professionals
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              See why salons and stylists are switching to SpotBookie.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "SpotBookie replaced our paper appointment book. Clients love being able to book online anytime.",
                name: 'Maria Santos',
                role: 'Salon Owner',
                initials: 'MS',
                color: 'bg-blue-100 text-blue-700',
              },
              {
                quote: "Setting up was incredibly easy. I had my booking page live and shared with clients in under 10 minutes.",
                name: 'David Chen',
                role: 'Barber',
                initials: 'DC',
                color: 'bg-violet-100 text-violet-700',
              },
              {
                quote: "The multi-staff feature is perfect. Each stylist manages their own schedule and clients can pick who they want.",
                name: 'Lisa Park',
                role: 'Studio Manager',
                initials: 'LP',
                color: 'bg-emerald-100 text-emerald-700',
              },
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-7 border border-slate-200/80 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-sm font-bold`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            Ready to streamline your bookings?
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
            Join hundreds of professionals who have ditched the old appointment book. Set up in minutes, free forever.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-xl font-bold text-lg transition-all hover:shadow-xl hover:shadow-white/10 hover:-translate-y-0.5"
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo />
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link to="/register" className="hover:text-slate-900 transition-colors">Sign Up</Link>
              <span className="text-slate-200">·</span>
              <Link to="/login" className="hover:text-slate-900 transition-colors">Sign In</Link>
              <span className="text-slate-200">·</span>
              <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
            </div>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} SpotBookie. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
