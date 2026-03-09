import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // seconds
import Anthropic from '@anthropic-ai/sdk'
import { findOrCreateCar, findGuide, saveGuide, slugify } from '@/lib/guides'
import { Guide, GuideStep, Tool, Part, Spec } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  const { make, model, year, task } = await req.json()

  if (!make || !model || !year || !task) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Find or create the car record
  const car = await findOrCreateCar(make, model, year)
  if (!car) {
    return NextResponse.json({ error: 'Failed to create car record' }, { status: 500 })
  }

  const taskSlug = slugify(task)

  // 2. Check if guide already exists
  const existing = await findGuide(car.id, taskSlug)
  if (existing) {
    return NextResponse.json({ guide: existing, cached: true })
  }

  // 3. Generate guide using Claude with web search
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

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

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      tools: [
        { type: 'web_search_20250305', name: 'web_search' },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const message = await stream.finalMessage()

    // Extract the JSON text from the response
    const textContent = message.content.find(b => b.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Parse the JSON — strip markdown code fences if present
    let jsonText = textContent.text.trim()
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim()
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
      console.error('Failed to parse guide JSON:', jsonText.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // 4. Save to database
    const guideRecord: Omit<Guide, 'id' | 'created_at' | 'updated_at'> = {
      car_id: car.id,
      task: guideData.task || task,
      task_slug: taskSlug,
      overview: guideData.overview,
      difficulty: guideData.difficulty,
      estimated_time: guideData.estimated_time,
      tools_needed: guideData.tools_needed || [],
      parts_needed: guideData.parts_needed || [],
      safety_notes: guideData.safety_notes || [],
    }

    const steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[] = (guideData.steps || []).map(s => ({
      step_number: s.step_number,
      title: s.title,
      description: s.description,
      specs: s.specs || [],
      tips: s.tips || [],
      image_search_query: s.image_search_query || null,
    }))

    const savedGuide = await saveGuide(guideRecord, steps)
    if (!savedGuide) {
      return NextResponse.json({ error: 'Failed to save guide' }, { status: 500 })
    }

    return NextResponse.json({ guide: savedGuide, cached: false })
  } catch (err) {
    console.error('Guide generation error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = err instanceof Anthropic.APIError ? err.status : 500
    return NextResponse.json({ error: `Failed to generate guide: ${message}` }, { status })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const make = searchParams.get('make')
  const model = searchParams.get('model')
  const year = searchParams.get('year')
  const task = searchParams.get('task')

  if (!make || !model || !year || !task) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { findOrCreateCar: findCar, findGuide: lookupGuide, slugify: slug } = await import('@/lib/guides')
  const car = await findCar(make, model, parseInt(year))
  if (!car) return NextResponse.json({ guide: null })

  const guide = await lookupGuide(car.id, slug(task))
  return NextResponse.json({ guide })
}
