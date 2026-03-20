import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Guide, GuideStep } from '@/lib/supabase'
import Link from 'next/link'
import FeedbackForm from './FeedbackForm'

async function getGuide(id: string): Promise<Guide | null> {
  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*), pc_guide_steps(*)')
    .eq('id', id)
    .single()

  if (error || !data) return null
  if (data.pc_guide_steps) {
    data.pc_guide_steps.sort((a: GuideStep, b: GuideStep) => a.step_number - b.step_number)
  }
  return data
}

const DIFFICULTY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  Beginner: { label: 'Beginner', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  Intermediate: { label: 'Intermediate', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  Advanced: { label: 'Advanced', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  Professional: { label: 'Professional', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
}

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guide = await getGuide(id)
  if (!guide) notFound()

  const car = guide.pc_cars
  const steps = guide.pc_guide_steps || []
  const diff = DIFFICULTY_STYLES[guide.difficulty] || DIFFICULTY_STYLES.Beginner

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-4 sticky top-0 bg-[#0f0f0f]/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors shrink-0">
            <span>←</span>
            <span className="text-xl font-bold">ProjectCar</span>
          </Link>
          {car && (
            <span className="text-sm text-white/40 truncate">{car.year} {car.make} {car.model}</span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Guide Header */}
        <div className="mb-8">
          {car && (
            <p className="text-sm text-white/40 mb-2">{car.year} {car.make} {car.model}</p>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">{guide.task}</h1>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className={`text-sm px-3 py-1 rounded-full border ${diff.bg} ${diff.color} font-medium`}>
              {diff.label}
            </span>
            {guide.estimated_time && (
              <span className="text-sm text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                ⏱ {guide.estimated_time}
              </span>
            )}
            <span className="text-sm text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              {steps.length} steps
            </span>
          </div>

          {guide.overview && (
            <p className="text-white/60 text-base leading-relaxed bg-white/3 border border-white/10 rounded-xl p-4">
              {guide.overview}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
          {/* Tools Needed */}
          {guide.tools_needed && guide.tools_needed.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h2 className="font-semibold text-sm text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>🔩</span> Tools Needed
              </h2>
              <ul className="space-y-2">
                {guide.tools_needed.map((tool, i) => (
                  <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>
                      {tool.name}
                      {tool.size && <span className="text-white/40 ml-1">({tool.size})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parts Needed */}
          {guide.parts_needed && guide.parts_needed.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h2 className="font-semibold text-sm text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>📦</span> Parts Needed
              </h2>
              <ul className="space-y-2">
                {guide.parts_needed.map((part, i) => (
                  <li key={i} className="text-sm text-white/80">
                    <div className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span>
                      <div>
                        <span>{part.name}</span>
                        {part.quantity && part.quantity > 1 && (
                          <span className="text-white/40 ml-1">×{part.quantity}</span>
                        )}
                        {part.part_number && (
                          <div className="text-xs text-white/30 font-mono">{part.part_number}</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety Notes */}
          {guide.safety_notes && guide.safety_notes.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
              <h2 className="font-semibold text-sm text-red-400/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>⚠️</span> Safety Notes
              </h2>
              <ul className="space-y-2">
                {guide.safety_notes.map((note, i) => (
                  <li key={i} className="text-sm text-red-300/70 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">!</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Steps */}
        <div>
          <h2 className="text-xl font-bold mb-6 text-white/90">Step-by-Step Instructions</h2>
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <StepCard key={step.id} step={step} isLast={idx === steps.length - 1} />
            ))}
          </div>
        </div>

        {/* Feedback */}
        <FeedbackForm guideId={guide.id} />

        {/* Footer CTA */}
        <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white/50 text-sm">Need a guide for a different task?</p>
            <a
              href="https://www.paypal.me/joshbe2802"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400/60 hover:text-orange-400 transition-colors mt-1 inline-block"
            >
              Support this project ☕
            </a>
          </div>
          <Link
            href="/"
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm"
          >
            Create Another Guide →
          </Link>
        </div>
      </main>
    </div>
  )
}

function StepCard({ step, isLast }: { step: GuideStep; isLast: boolean }) {
  return (
    <div className={`flex gap-5 pb-8 ${!isLast ? 'step-connector' : ''}`}>
      {/* Step number circle */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center relative z-10">
        <span className="text-orange-400 font-bold text-sm">{step.step_number}</span>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-5 mb-2">
        <h3 className="font-semibold text-white text-base mb-2">{step.title}</h3>
        <p className="text-white/65 text-sm leading-relaxed mb-4">{step.description}</p>

        {/* Specs */}
        {step.specs && step.specs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {step.specs.map((spec, i) => (
              <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
                <span className="text-xs text-blue-300/70">{spec.label}: </span>
                <span className="text-sm font-mono font-bold text-blue-300">
                  {spec.value}{spec.unit && <span className="text-xs ml-0.5">{spec.unit}</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        {step.tips && step.tips.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-lg p-3">
            <p className="text-xs text-yellow-400/60 uppercase tracking-wider mb-1.5 font-semibold">Pro Tips</p>
            <ul className="space-y-1">
              {step.tips.map((tip, i) => (
                <li key={i} className="text-xs text-yellow-200/60 flex items-start gap-1.5">
                  <span className="text-yellow-400/60 mt-0.5 shrink-0">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Image search hint */}
        {step.image_search_query && (
          <div className="mt-3">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(step.image_search_query)}&tbm=isch`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1"
            >
              <span>🖼</span>
              <span>Search for reference images</span>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
