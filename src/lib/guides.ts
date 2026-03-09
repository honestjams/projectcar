import { supabase, Car, Guide, GuideStep } from './supabase'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function findOrCreateCar(make: string, model: string, year: number): Promise<Car | null> {
  // Try to find existing car
  const { data: existing } = await supabase
    .from('pc_cars')
    .select('*')
    .eq('make', make.trim())
    .eq('model', model.trim())
    .eq('year', year)
    .single()

  if (existing) return existing

  // Create new car
  const { data, error } = await supabase
    .from('pc_cars')
    .insert({ make: make.trim(), model: model.trim(), year })
    .select()
    .single()

  if (error) {
    console.error('Error creating car:', error)
    return null
  }
  return data
}

export async function findGuide(carId: string, taskSlug: string): Promise<Guide | null> {
  const { data, error } = await supabase
    .from('pc_guides')
    .select(`
      *,
      pc_cars(*),
      pc_guide_steps(*)
    `)
    .eq('car_id', carId)
    .eq('task_slug', taskSlug)
    .single()

  if (error || !data) return null

  // Sort steps by step_number
  if (data.pc_guide_steps) {
    data.pc_guide_steps.sort((a: GuideStep, b: GuideStep) => a.step_number - b.step_number)
  }

  return data
}

export async function saveGuide(guide: Omit<Guide, 'id' | 'created_at' | 'updated_at'>, steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[]): Promise<Guide | null> {
  // Insert the guide
  const { data: guideData, error: guideError } = await supabase
    .from('pc_guides')
    .insert({
      car_id: guide.car_id,
      task: guide.task,
      task_slug: guide.task_slug,
      overview: guide.overview,
      difficulty: guide.difficulty,
      estimated_time: guide.estimated_time,
      tools_needed: guide.tools_needed,
      parts_needed: guide.parts_needed,
      safety_notes: guide.safety_notes,
    })
    .select()
    .single()

  if (guideError || !guideData) {
    console.error('Error saving guide:', guideError)
    return null
  }

  // Insert steps
  const stepsWithGuideId = steps.map(step => ({
    ...step,
    guide_id: guideData.id,
  }))

  const { error: stepsError } = await supabase
    .from('pc_guide_steps')
    .insert(stepsWithGuideId)

  if (stepsError) {
    console.error('Error saving guide steps:', stepsError)
  }

  // Return full guide
  return findGuide(guide.car_id, guide.task_slug)
}

export async function getRecentGuides(limit = 10): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data
}

export async function searchGuides(make: string, model: string, year: number): Promise<Guide[]> {
  const { data: car } = await supabase
    .from('pc_cars')
    .select('id')
    .eq('make', make)
    .eq('model', model)
    .eq('year', year)
    .single()

  if (!car) return []

  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*)')
    .eq('car_id', car.id)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data
}
