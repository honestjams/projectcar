'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FeedbackForm({ guideId }: { guideId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!feedback.trim()) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/guide/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId, feedback: feedback.trim() }),
      })
      let data: Record<string, unknown> = {}
      try { data = await res.json() } catch { /* non-JSON body */ }
      if (!res.ok) throw new Error((data.error as string) || 'Regeneration failed')

      setDone(true)
      setTimeout(() => {
        router.refresh()
        setOpen(false)
        setDone(false)
        setFeedback('')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-white/25 hover:text-white/50 transition-colors underline underline-offset-2"
      >
        Something wrong with this guide?
      </button>
    )
  }

  return (
    <div className="mt-8 border border-white/10 rounded-xl p-5 bg-white/3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/70">Report an issue</h3>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
      </div>
      <p className="text-xs text-white/40 mb-3">
        Describe what was wrong — e.g. &quot;2004 350Z only has one air filter, not two&quot; — and the guide will be regenerated with your correction.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="What was incorrect or missing?"
          rows={3}
          autoFocus
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-400/60 transition-colors resize-none"
        />
        {error && (
          <p className="text-red-400 text-xs mt-2 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">{error}</p>
        )}
        {done && (
          <p className="text-green-400 text-xs mt-2">Guide regenerated! Reloading…</p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            disabled={loading || !feedback.trim() || done}
            className="bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating…
              </>
            ) : 'Regenerate Guide'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white/70 text-xs py-2 px-3 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
