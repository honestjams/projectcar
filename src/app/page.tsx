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

const INPUT_CLS = 'w-full bg-white/5 border border-white/15 rounded-lg px-3 py-3 text-white text-base focus:outline-none focus:border-orange-400/60 transition-colors'
const SELECT_CLS = INPUT_CLS + ' appearance-none'

export default function Home() {
  const router = useRouter()
  const [makeSelect, setMakeSelect] = useState('')
  const [makeCustom, setMakeCustom] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [taskSelect, setTaskSelect] = useState('')
  const [taskCustom, setTaskCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentGuides, setRecentGuides] = useState<Guide[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const make = makeSelect === 'other' ? makeCustom.trim() : makeSelect
  const task = taskSelect === 'other' ? taskCustom.trim() : taskSelect

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
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        // Response was not valid JSON (e.g. server timeout or gateway error)
      }
      if (!res.ok) throw new Error((data.error as string) || 'Something went wrong')
      router.push(`/guide/${(data.guide as { id: string }).id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <span className="text-xl font-bold text-orange-400">ProjectCar</span>
          <span className="text-sm text-white/40 ml-2 hidden sm:inline">DIY Maintenance Guides</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Fix your car.<br />
            <span className="text-orange-400">Step by step.</span>
          </h1>
          <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
            AI-powered repair guides with factory torque specs, tool lists, and detailed instructions.
            Shared by the community, built for everyone.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 sm:mb-12">
          <h2 className="text-lg font-semibold mb-5 text-white/80">What are you working on?</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Year */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Year</label>
              <div className="relative">
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className={SELECT_CLS}
                >
                  {YEARS.map(y => (
                    <option key={y} value={y} className="bg-[#1a1a1a]">{y}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">▼</span>
              </div>
            </div>

            {/* Make */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Make</label>
              <div className="relative">
                <select
                  value={makeSelect}
                  onChange={e => setMakeSelect(e.target.value)}
                  className={SELECT_CLS + (makeSelect === '' ? ' text-white/25' : '')}
                >
                  <option value="" disabled className="bg-[#1a1a1a] text-white/50">e.g. Nissan</option>
                  {POPULAR_MAKES.map(m => (
                    <option key={m} value={m} className="bg-[#1a1a1a] text-white">{m}</option>
                  ))}
                  <option value="other" className="bg-[#1a1a1a] text-white">Other…</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">▼</span>
              </div>
              {makeSelect === 'other' && (
                <input
                  type="text"
                  value={makeCustom}
                  onChange={e => setMakeCustom(e.target.value)}
                  placeholder="Enter make"
                  autoFocus
                  className={INPUT_CLS + ' mt-2 placeholder:text-white/25'}
                />
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. 350Z"
                className={INPUT_CLS + ' placeholder:text-white/25'}
              />
            </div>
          </div>

          {/* Task */}
          <div className="mb-2">
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">What do you want to do?</label>
            <div className="relative">
              <select
                value={taskSelect}
                onChange={e => setTaskSelect(e.target.value)}
                className={SELECT_CLS + (taskSelect === '' ? ' text-white/25' : '')}
              >
                <option value="" disabled className="bg-[#1a1a1a] text-white/50">e.g. Oil change, Brake pad replacement…</option>
                {POPULAR_TASKS.map(t => (
                  <option key={t} value={t} className="bg-[#1a1a1a] text-white">{t}</option>
                ))}
                <option value="other" className="bg-[#1a1a1a] text-white">Other / type your own…</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">▼</span>
            </div>
            {taskSelect === 'other' && (
              <input
                type="text"
                value={taskCustom}
                onChange={e => setTaskCustom(e.target.value)}
                placeholder="Describe the job, e.g. Replace radiator"
                autoFocus
                className={INPUT_CLS + ' mt-2 placeholder:text-white/25'}
              />
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:bg-orange-500/40 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentGuides.map(guide => {
                const car = guide.pc_cars
                const diff = DIFFICULTY_STYLES[guide.difficulty] || DIFFICULTY_STYLES.Beginner
                return (
                  <a
                    key={guide.id}
                    href={`/guide/${guide.id}`}
                    className="group bg-white/5 border border-white/10 hover:border-orange-400/30 active:bg-white/10 rounded-xl p-4 transition-all"
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

      <footer className="border-t border-white/10 mt-16 py-8 px-4 text-center text-white/25 text-sm">
        ProjectCar — Community-powered car maintenance guides
        <div className="mt-2">
          <a
            href="https://www.paypal.me/joshbe2802"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400/60 hover:text-orange-400 transition-colors"
          >
            Support this project ☕
          </a>
        </div>
      </footer>
    </div>
  )
}
