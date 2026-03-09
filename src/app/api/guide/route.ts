import { NextRequest, NextResponse } from 'next/server'
import Anthropic, { type MessageParam as AMessageParam } from '@anthropic-ai/sdk'
import { findOrCreateCar, findGuide, saveGuide, slugify } from '@/lib/guides'
import { Guide, GuideStep, Tool, Part, Spec } from '@/lib/supabase'

export const maxDuration = 60 // seconds

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    // --- Parse & validate input ---
    let body: { make?: unknown; model?: unknown; year?: unknown; task?: unknown }
    try {
      body = await req.json()
    } catch {
      return jsonError('Invalid request body', 400)
    }

    const make  = typeof body.make  === 'string' ? body.make.trim()  : ''
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    const task  = typeof body.task  === 'string' ? body.task.trim()  : ''
    const year  = Number(body.year)

    if (!make || !model || !task || !year || isNaN(year)) {
      return jsonError('Missing required fields: make, model, year, task', 400)
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError('Anthropic API key not configured', 500)
    }

    // --- 1. Find or create car ---
    const car = await findOrCreateCar(make, model, year)
    if (!car) return jsonError('Failed to create car record')

    const taskSlug = slugify(task)

    // --- 2. Return cached guide if exists ---
    const existing = await findGuide(car.id, taskSlug)
    if (existing) return NextResponse.json({ guide: existing, cached: true })

    // --- 3. Generate guide with Claude ---
    const prompt = `You are an expert automotive mechanic and technical writer. Generate a detailed, step-by-step maintenance guide for the following:

Vehicle: ${year} ${make} ${model}
Task: ${task}

Search the web for:
1. Factory service manual procedures for this specific vehicle
2. OEM torque specifications
3. Required tools with specific sizes (e.g., "14mm socket", "T30 Torx bit")
4. Part numbers and specifications
5. Common mistakes and tips from experienced mechanics

Then produce a complete JSON guide in EXACTLY this format (no extra text, just valid JSON):
{
  "task": "${task}",
  "overview": "Brief 2-3 sentence description of what this job involves and why it matters",
  "difficulty": "Beginner|Intermediate|Advanced|Professional",
  "estimated_time": "e.g. 2-3 hours",
  "tools_needed": [
    { "name": "Tool name", "size": "e.g. 14mm", "type": "socket|wrench|screwdriver|specialty" }
  ],
  "parts_needed": [
    { "name": "Part name", "part_number": "OEM or aftermarket part number if known", "quantity": 1, "notes": "any relevant notes" }
  ],
  "safety_notes": [
    "Safety warning 1",
    "Safety warning 2"
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Short step title",
      "description": "Detailed description of exactly what to do in this step. Be specific and clear.",
      "specs": [
        { "label": "Torque spec label", "value": "70", "unit": "Nm" }
      ],
      "tips": [
        "Helpful tip or common mistake to avoid"
      ],
      "image_search_query": "specific search query to find a relevant image for this step"
    }
  ]
}

Important:
- Include ALL torque specs in the relevant step's specs array
- Be specific about tool sizes (metric preferred, include imperial equivalent)
- Include at least 5-8 detailed steps
- The image_search_query should be specific to help find instructional images (e.g. "${year} ${make} ${model} radiator drain plug location")
- Only output valid JSON, nothing else`

    const userMessages: AMessageParam[] = [{ role: 'user', content: prompt }]
    let lastMessage: Anthropic.Message | null = null
    const MAX_CONTINUATIONS = 5

    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        messages: userMessages,
      })
      lastMessage = await stream.finalMessage()
      if (lastMessage.stop_reason !== 'pause_turn') break
      userMessages.push({ role: 'assistant', content: lastMessage.content })
    }

    if (!lastMessage) return jsonError('No response from AI')

    // Use the LAST text block — earlier ones may be intermediate "searching…" messages
    const textBlock = [...lastMessage.content].reverse().find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return jsonError('No text response from AI')

    // Strip markdown code fences if present
    let jsonText = textBlock.text.trim()
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonText = fenceMatch[1].trim()

    // If the model wrapped it in extra prose, try to extract the JSON object
    if (!jsonText.startsWith('{')) {
      const objMatch = jsonText.match(/\{[\s\S]*\}/)
      if (objMatch) jsonText = objMatch[0]
    }

    let guideData: {
      task: string
      overview: string
      difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'
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
      guideData = JSON.parse(jsonText)
    } catch {
      console.error('Failed to parse guide JSON. Raw text (first 500):', jsonText.slice(0, 500))
      return jsonError('AI returned an unreadable response — please try again')
    }

    // Normalise difficulty to valid enum value
    const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Professional'] as const
    type Difficulty = typeof VALID_DIFFICULTIES[number]
    const rawDiff = String(guideData.difficulty ?? '')
    const difficulty: Difficulty = (VALID_DIFFICULTIES as readonly string[]).includes(rawDiff)
      ? rawDiff as Difficulty
      : 'Intermediate'

    // --- 4. Save to database ---
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

    const steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[] = (guideData.steps ?? []).map(s => ({
      step_number: s.step_number,
      title: s.title ?? '',
      description: s.description ?? '',
      specs: Array.isArray(s.specs) ? s.specs : [],
      tips: Array.isArray(s.tips) ? s.tips : [],
      image_search_query: s.image_search_query ?? null,
    }))

    const savedGuide = await saveGuide(guideRecord, steps)
    if (!savedGuide) return jsonError('Failed to save guide to database')

    return NextResponse.json({ guide: savedGuide, cached: false })

  } catch (err) {
    console.error('Unhandled /api/guide error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    const status = err instanceof Anthropic.APIError ? (err.status ?? 500) : 500
    return jsonError(`Guide generation failed: ${msg}`, status)
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
      return jsonError('Missing required fields', 400)
    }

    const car = await findOrCreateCar(make, model, parseInt(year))
    if (!car) return NextResponse.json({ guide: null })

    const guide = await findGuide(car.id, slugify(task))
    return NextResponse.json({ guide })
  } catch (err) {
    console.error('Unhandled /api/guide GET error:', err)
    return jsonError('Failed to fetch guide')
  }
}
