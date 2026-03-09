'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Guide } from '@/lib/supabase'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 40 }, (_, i) => CURRENT_YEAR - i)

const POPULAR_MAKES = [
  'Acura', 'Audi', 'BMW', 'Chevrolet', 'Dodge', 'Ford', 'Honda',
  'Hyundai', 'Jeep', 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz',
  'Mitsubishi', 'Nissan', 'Porsche', 'Subaru', 'Toyota', 'Volkswagen', 'Volvo',
]

const POPULAR_TASKS = [
  'Oil change', 'Brake pad replacement', 'Coolant flush', 'Spark plug replacement',
  'Air filter replacement', 'Timing belt replacement', 'Replace radiator',
  'Replace water pump', 'Transmission fluid change', 'Replace alternator',
  'Replace battery', 'Replace brake rotors', 'Replace CV axle',
  'Replace serpentine belt', 'Replace thermostat',
]

const DIFFICULTY_STYLES: Record<string, { label: string; color: string }> = {
  Beginner: { label: 'Beginner', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  Intermediate: { label: 'Intermediate', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  Advanced: { label: 'Advanced', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  Professional: { label: 'Professional', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export default function Home() {
  const router = useRouter()
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentGuides, setRecentGuides] = useState<Guide[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    fetch('/api/guides/recent')
      .then(r => r.json())
      .then(d => setRecentGuides(d.guides || []))
      .catch(() => {})
      .finally(() => setLoadingRecent(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!make || !model || !task) {
      setError('Please fill in your vehicle make, model, and what you want to do.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make, model, year: parseInt(year), task }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      router.push(`/guide/${data.guide.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <span className="text-xl font-bold text-orange-400">ProjectCar</span>
          <span className="text-sm text-white/40 ml-2">DIY Maintenance Guides</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Fix your car.<br />
            <span className="text-orange-400">Step by step.</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            AI-powered repair guides with factory torque specs, tool lists, and detailed instructions.
            Shared by the community, built for everyone.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-12">
          <h2 className="text-lg font-semibold mb-5 text-white/80">What are you working on?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Year */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Year</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400/60 transition-colors"
              >
                {YEARS.map(y => (
                  <option key={y} value={y} className="bg-[#1a1a1a]">{y}</option>
                ))}
              </select>
            </div>

            {/* Make */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Make</label>
              <input
                type="text"
                list="makes-list"
                value={make}
                onChange={e => setMake(e.target.value)}
                placeholder="e.g. Nissan"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-400/60 transition-colors"
              />
              <datalist id="makes-list">
                {POPULAR_MAKES.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. 350Z"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-400/60 transition-colors"
              />
            </div>
          </div>

          {/* Task */}
          <div className="mb-2">
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">What do you want to do?</label>
            <input
              type="text"
              list="tasks-list"
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="e.g. Replace radiator, Oil change, Brake pad replacement…"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-400/60 transition-colors"
            />
            <datalist id="tasks-list">
              {POPULAR_TASKS.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating your guide…
              </>
            ) : (
              <>
                <span>🔍</span>
                Find or Create Guide
              </>
            )}
          </button>

          {loading && (
            <p className="text-center text-white/40 text-xs mt-3">
              Searching factory service manuals and generating your step-by-step guide. This may take 15–30 seconds…
            </p>
          )}
        </form>

        {/* Recent Guides */}
        <div>
          <h2 className="text-lg font-semibold text-white/70 mb-4">Community Guides</h2>
          {loadingRecent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentGuides.length === 0 ? (
            <p className="text-white/30 text-sm py-8 text-center">
              No guides yet — be the first to create one above!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentGuides.map(guide => {
                const car = guide.pc_cars
                const diff = DIFFICULTY_STYLES[guide.difficulty] || DIFFICULTY_STYLES.Beginner
                return (
                  <a
                    key={guide.id}
                    href={`/guide/${guide.id}`}
                    className="group bg-white/5 border border-white/10 hover:border-orange-400/30 hover:bg-white/8 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${diff.color} shrink-0`}>
                        {diff.label}
                      </span>
                      {guide.estimated_time && (
                        <span className="text-xs text-white/30 shrink-0">⏱ {guide.estimated_time}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-white/90 group-hover:text-orange-300 transition-colors mb-1 line-clamp-2">
                      {guide.task}
                    </h3>
                    {car && (
                      <p className="text-xs text-white/40">{car.year} {car.make} {car.model}</p>
                    )}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 mt-16 py-8 px-6 text-center text-white/25 text-sm">
        ProjectCar — Community-powered car maintenance guides
      </footer>
    </div>
  )
}
