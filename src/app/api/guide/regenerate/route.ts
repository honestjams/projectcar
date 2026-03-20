import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase, Guide, GuideStep, Tool, Part, Spec } from '@/lib/supabase'
import { updateGuide } from '@/lib/guides'
import { buildPrompt } from '../route'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonError('Invalid JSON', 400)
    }

    const guideId  = typeof body.guideId   === 'string' ? body.guideId.trim()  : ''
    const feedback = typeof body.feedback  === 'string' ? body.feedback.trim() : ''

    if (!guideId)  return jsonError('Missing guideId', 400)
    if (!feedback) return jsonError('Please describe what was wrong with the guide', 400)
    if (!process.env.ANTHROPIC_API_KEY) return jsonError('Anthropic API key not configured', 500)

    // Fetch guide + car
    const { data: existing, error: fetchError } = await supabase
      .from('pc_guides')
      .select('*, pc_cars(*)')
      .eq('id', guideId)
      .single()

    if (fetchError || !existing) return jsonError('Guide not found', 404)

    const car = existing.pc_cars
    if (!car) return jsonError('Car record not found', 404)

    const { year, make, model } = car
    const task = existing.task

    // Regenerate with feedback context
    const prompt = buildPrompt(year, make, model, task, feedback)

    let guideJson: string
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      })
      const textBlock = [...response.content].reverse().find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') return jsonError('AI returned no text', 500)
      guideJson = textBlock.text.trim()
    } catch (e) {
      console.error('[/api/guide/regenerate] AI error:', e)
      return jsonError('AI call failed — please try again', 500)
    }

    // Strip markdown fences
    const fenceMatch = guideJson.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) guideJson = fenceMatch[1].trim()
    if (!guideJson.startsWith('{')) {
      const objMatch = guideJson.match(/\{[\s\S]*\}/)
      if (objMatch) guideJson = objMatch[0]
    }

    let guideData: {
      task: string
      overview: string
      difficulty: string
      estimated_time: string
      tools_needed: Tool[]
      parts_needed: Part[]
      safety_notes: string[]
      steps: Array<{
        step_number: number
        title: string
        description: string
        specs: Spec[]
        tips: string[]
        image_search_query: string
      }>
    }

    try {
      guideData = JSON.parse(guideJson)
    } catch {
      console.error('[/api/guide/regenerate] JSON parse failed, raw (500 chars):', guideJson.slice(0, 500))
      return jsonError('AI returned malformed JSON — please try again', 500)
    }

    const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Professional'] as const
    type Difficulty = typeof VALID_DIFFICULTIES[number]
    const difficulty: Difficulty = (VALID_DIFFICULTIES as readonly string[]).includes(guideData.difficulty)
      ? guideData.difficulty as Difficulty
      : 'Intermediate'

    const steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[] =
      (Array.isArray(guideData.steps) ? guideData.steps : []).map(s => ({
        step_number:        s.step_number ?? 0,
        title:              s.title ?? '',
        description:        s.description ?? '',
        specs:              Array.isArray(s.specs) ? s.specs : [],
        tips:               Array.isArray(s.tips) ? s.tips : [],
        image_search_query: s.image_search_query ?? null,
      }))

    const updated = await updateGuide(
      guideId,
      {
        overview:       guideData.overview ?? '',
        difficulty,
        estimated_time: guideData.estimated_time ?? '',
        tools_needed:   Array.isArray(guideData.tools_needed) ? guideData.tools_needed : [],
        parts_needed:   Array.isArray(guideData.parts_needed) ? guideData.parts_needed : [],
        safety_notes:   Array.isArray(guideData.safety_notes) ? guideData.safety_notes : [],
      },
      steps,
    )

    if (!updated) return jsonError('Failed to save regenerated guide', 500)

    return NextResponse.json({ guide: updated })
  } catch (err) {
    console.error('[/api/guide/regenerate] Unhandled error:', err)
    return jsonError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 500)
  }
}
