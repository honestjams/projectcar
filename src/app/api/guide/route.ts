import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { findOrCreateCar, findGuide, saveGuide, slugify } from '@/lib/guides'
import { Guide, GuideStep, Tool, Part, Spec } from '@/lib/supabase'

export const maxDuration = 60 // seconds

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function jsonError(message: string, status = 500, step?: string) {
  const body = step ? { error: message, step } : { error: message }
  return NextResponse.json(body, { status })
}

export function buildPrompt(year: number, make: string, model: string, task: string, feedback?: string): string {
  const feedbackSection = feedback
    ? `\n\nUSER CORRECTION — a previous version of this guide was wrong. The user reported:\n"${feedback}"\nYou MUST address this correction. Double-check every relevant detail against this feedback before writing.`
    : ''

  return `You are an expert automotive mechanic and technical writer with access to factory service manuals.

YEAR-SPECIFIC ACCURACY IS CRITICAL. This guide is ONLY for the ${year} ${make} ${model}.

Before writing anything, internally verify:
1. What engine code(s) were available in the ${year} ${make} ${model} specifically (e.g. VQ35DE vs VQ35HR)?
2. What trim variants existed for this exact model year, and do any affect this task?
3. What changed between adjacent model years that could affect this task (e.g. mid-cycle engine swap, revised intake system)?

Then write the guide ONLY for the ${year} model year. Do NOT include steps, parts, or specifications that apply to a different model year or a different engine variant than what was in the ${year} ${make} ${model}.${feedbackSection}

Generate a detailed, accurate, step-by-step maintenance guide for:
Vehicle: ${year} ${make} ${model}
Task: ${task}

Use factory service procedures, OEM torque specifications, and required tools for this EXACT year and variant.

Respond with ONLY valid JSON in exactly this format — no extra text, no markdown fences:
{
  "task": "${task}",
  "overview": "Brief 2-3 sentence description. If there are year-specific details (engine variant, number of filters, etc.) mention them here.",
  "difficulty": "Beginner",
  "estimated_time": "e.g. 30-45 minutes",
  "tools_needed": [
    { "name": "Tool name", "size": "e.g. 14mm", "type": "socket" }
  ],
  "parts_needed": [
    { "name": "Part name", "part_number": "OEM part number if known", "quantity": 1, "notes": "notes" }
  ],
  "safety_notes": [
    "Safety warning 1"
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Short step title",
      "description": "Detailed description of exactly what to do.",
      "specs": [
        { "label": "Torque spec", "value": "25", "unit": "Nm" }
      ],
      "tips": ["Helpful tip"],
      "image_search_query": "${year} ${make} ${model} ${task} step 1"
    }
  ]
}

Rules:
- difficulty must be exactly one of: Beginner, Intermediate, Advanced, Professional
- Include ALL factory torque specs in the relevant step's specs array
- Include at least 6 detailed steps
- parts_needed quantities must reflect what the ${year} model actually requires (e.g. 1 air filter if single intake, 2 if dual intake)
- Output ONLY the JSON object — nothing before or after it`
}

export async function POST(req: NextRequest) {
  try {
    // ── Step 1: parse request ────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonError('Invalid JSON in request body', 400, 'parse')
    }

    const make  = typeof body.make  === 'string' ? body.make.trim()  : ''
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    const task  = typeof body.task  === 'string' ? body.task.trim()  : ''
    const year  = Number(body.year)

    if (!make || !model || !task || !year || isNaN(year)) {
      return jsonError('Missing required fields: make, model, year, task', 400, 'validate')
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError('Anthropic API key not configured', 500, 'config')
    }

    // ── Step 2: find or create car ───────────────────────────────────────────
    let car
    try {
      car = await findOrCreateCar(make, model, year)
    } catch (e) {
      console.error('[/api/guide] findOrCreateCar threw:', e)
      return jsonError(`Database error looking up car: ${e instanceof Error ? e.message : String(e)}`, 500, 'db_car')
    }
    if (!car) return jsonError('Failed to create car record', 500, 'db_car')

    const taskSlug = slugify(task)

    // ── Step 3: return cached guide if it exists ─────────────────────────────
    let existing
    try {
      existing = await findGuide(car.id, taskSlug)
    } catch (e) {
      console.error('[/api/guide] findGuide threw:', e)
      // Non-fatal — just proceed to generate
    }
    if (existing) return NextResponse.json({ guide: existing, cached: true })

    // ── Step 4: generate guide with Claude ───────────────────────────────────
    const prompt = buildPrompt(year, make, model, task)

    let guideJson: string
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = [...response.content].reverse().find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        return jsonError('AI returned no text content', 500, 'ai_response')
      }
      guideJson = textBlock.text.trim()
    } catch (e) {
      console.error('[/api/guide] Anthropic API error:', e)
      const msg = e instanceof Anthropic.APIError
        ? `AI API error ${e.status}: ${e.message}`
        : `AI call failed: ${e instanceof Error ? e.message : String(e)}`
      return jsonError(msg, 500, 'ai_call')
    }

    // ── Step 5: parse the JSON response ─────────────────────────────────────
    // Strip markdown fences if the model added them despite instructions
    const fenceMatch = guideJson.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) guideJson = fenceMatch[1].trim()

    // Extract bare JSON object if wrapped in prose
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
      console.error('[/api/guide] JSON parse failed, raw (500 chars):', guideJson.slice(0, 500))
      return jsonError('AI returned malformed JSON — please try again', 500, 'ai_parse')
    }

    // ── Step 6: normalise fields before saving ───────────────────────────────
    const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Professional'] as const
    type Difficulty = typeof VALID_DIFFICULTIES[number]
    const difficulty: Difficulty = (VALID_DIFFICULTIES as readonly string[]).includes(guideData.difficulty)
      ? guideData.difficulty as Difficulty
      : 'Intermediate'

    const guideRecord: Omit<Guide, 'id' | 'created_at' | 'updated_at'> = {
      car_id: car.id,
      task: guideData.task || task,
      task_slug: taskSlug,
      overview: guideData.overview ?? '',
      difficulty,
      estimated_time: guideData.estimated_time ?? '',
      tools_needed: Array.isArray(guideData.tools_needed) ? guideData.tools_needed : [],
      parts_needed: Array.isArray(guideData.parts_needed) ? guideData.parts_needed : [],
      safety_notes: Array.isArray(guideData.safety_notes) ? guideData.safety_notes : [],
    }

    const steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[] =
      (Array.isArray(guideData.steps) ? guideData.steps : []).map(s => ({
        step_number: s.step_number ?? 0,
        title: s.title ?? '',
        description: s.description ?? '',
        specs: Array.isArray(s.specs) ? s.specs : [],
        tips: Array.isArray(s.tips) ? s.tips : [],
        image_search_query: s.image_search_query ?? null,
      }))

    // ── Step 7: save to database ─────────────────────────────────────────────
    let savedGuide
    try {
      savedGuide = await saveGuide(guideRecord, steps)
    } catch (e) {
      console.error('[/api/guide] saveGuide threw:', e)
      return jsonError(`Failed to save guide: ${e instanceof Error ? e.message : String(e)}`, 500, 'db_save')
    }
    if (!savedGuide) return jsonError('Failed to save guide to database', 500, 'db_save')

    return NextResponse.json({ guide: savedGuide, cached: false })

  } catch (err) {
    // Catch-all: should not normally be reached
    console.error('[/api/guide] Unhandled error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Unexpected error: ${msg}`, 500, 'unknown')
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const make  = searchParams.get('make')
    const model = searchParams.get('model')
    const year  = searchParams.get('year')
    const task  = searchParams.get('task')

    if (!make || !model || !year || !task) {
      return jsonError('Missing required fields', 400, 'validate')
    }

    const car = await findOrCreateCar(make, model, parseInt(year))
    if (!car) return NextResponse.json({ guide: null })

    const guide = await findGuide(car.id, slugify(task))
    return NextResponse.json({ guide })
  } catch (err) {
    console.error('[/api/guide GET] error:', err)
    return jsonError(`Failed to fetch guide: ${err instanceof Error ? err.message : String(err)}`, 500, 'unknown')
  }
}
