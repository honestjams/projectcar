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
  const cleanMake  = make.trim()
  const cleanModel = model.trim()

  // 1. Try to find existing car (ignore PGRST116 "0 rows" error)
  const { data: existing } = await supabase
    .from('pc_cars')
    .select('*')
    .eq('make', cleanMake)
    .eq('model', cleanModel)
    .eq('year', year)
    .maybeSingle()

  if (existing) return existing

  // 2. Insert — use upsert to handle the rare race-condition duplicate
  const { data, error } = await supabase
    .from('pc_cars')
    .upsert(
      { make: cleanMake, model: cleanModel, year },
      { onConflict: 'make,model,year', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) {
    console.error('[findOrCreateCar] upsert error:', error)
    // Last-resort: try selecting again (the row may have been inserted by another request)
    const { data: retry } = await supabase
      .from('pc_cars')
      .select('*')
      .eq('make', cleanMake)
      .eq('model', cleanModel)
      .eq('year', year)
      .maybeSingle()
    return retry ?? null
  }

  return data
}

export async function findGuide(carId: string, taskSlug: string): Promise<Guide | null> {
  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*), pc_guide_steps(*)')
    .eq('car_id', carId)
    .eq('task_slug', taskSlug)
    .maybeSingle()

  if (error) {
    console.error('[findGuide] error:', error)
    return null
  }
  if (!data) return null

  if (Array.isArray(data.pc_guide_steps)) {
    data.pc_guide_steps.sort((a: GuideStep, b: GuideStep) => a.step_number - b.step_number)
  }

  return data
}

export async function saveGuide(
  guide: Omit<Guide, 'id' | 'created_at' | 'updated_at'>,
  steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[],
): Promise<Guide | null> {
  // 1. Insert the guide record
  const { data: guideData, error: guideError } = await supabase
    .from('pc_guides')
    .insert({
      car_id:         guide.car_id,
      task:           guide.task,
      task_slug:      guide.task_slug,
      overview:       guide.overview,
      difficulty:     guide.difficulty,
      estimated_time: guide.estimated_time,
      tools_needed:   guide.tools_needed,
      parts_needed:   guide.parts_needed,
      safety_notes:   guide.safety_notes,
    })
    .select()
    .single()

  if (guideError || !guideData) {
    console.error('[saveGuide] guide insert error:', guideError)
    return null
  }

  // 2. Insert steps (non-fatal if this fails)
  let savedSteps: GuideStep[] = []
  if (steps.length > 0) {
    const { data: stepsData, error: stepsError } = await supabase
      .from('pc_guide_steps')
      .insert(steps.map(s => ({ ...s, guide_id: guideData.id })))
      .select()

    if (stepsError) {
      console.error('[saveGuide] steps insert error:', stepsError)
    } else {
      savedSteps = (stepsData ?? []).sort((a: GuideStep, b: GuideStep) => a.step_number - b.step_number)
    }
  }

  // 3. Return the assembled guide directly — avoids a second joined query
  //    which could fail if FK relationships aren't configured in PostgREST
  return {
    ...guideData,
    pc_guide_steps: savedSteps,
  } as Guide
}

export async function updateGuide(
  guideId: string,
  guide: Pick<Guide, 'overview' | 'difficulty' | 'estimated_time' | 'tools_needed' | 'parts_needed' | 'safety_notes'>,
  steps: Omit<GuideStep, 'id' | 'guide_id' | 'created_at'>[],
): Promise<Guide | null> {
  // 1. Update guide record
  const { data: guideData, error: guideError } = await supabase
    .from('pc_guides')
    .update({
      overview:       guide.overview,
      difficulty:     guide.difficulty,
      estimated_time: guide.estimated_time,
      tools_needed:   guide.tools_needed,
      parts_needed:   guide.parts_needed,
      safety_notes:   guide.safety_notes,
    })
    .eq('id', guideId)
    .select('*, pc_cars(*)')
    .single()

  if (guideError || !guideData) {
    console.error('[updateGuide] update error:', guideError)
    return null
  }

  // 2. Replace steps
  await supabase.from('pc_guide_steps').delete().eq('guide_id', guideId)

  let savedSteps: GuideStep[] = []
  if (steps.length > 0) {
    const { data: stepsData, error: stepsError } = await supabase
      .from('pc_guide_steps')
      .insert(steps.map(s => ({ ...s, guide_id: guideId })))
      .select()

    if (stepsError) {
      console.error('[updateGuide] steps insert error:', stepsError)
    } else {
      savedSteps = (stepsData ?? []).sort((a: GuideStep, b: GuideStep) => a.step_number - b.step_number)
    }
  }

  return { ...guideData, pc_guide_steps: savedSteps } as Guide
}

export async function getRecentGuides(limit = 10): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[getRecentGuides] error:', error)
    return []
  }
  return data ?? []
}

export async function searchGuides(make: string, model: string, year: number): Promise<Guide[]> {
  const { data: car } = await supabase
    .from('pc_cars')
    .select('id')
    .eq('make', make)
    .eq('model', model)
    .eq('year', year)
    .maybeSingle()

  if (!car) return []

  const { data, error } = await supabase
    .from('pc_guides')
    .select('*, pc_cars(*)')
    .eq('car_id', car.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[searchGuides] error:', error)
    return []
  }
  return data ?? []
}
