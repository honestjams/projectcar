import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables')
    }
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Convenience proxy — same API as before, but lazily initialised
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Car = {
  id: string
  make: string
  model: string
  year: number
  created_at: string
}

export type GuideStep = {
  id: string
  guide_id: string
  step_number: number
  title: string
  description: string
  specs: Spec[]
  tips: string[]
  image_search_query: string | null
  created_at: string
}

export type Spec = {
  label: string
  value: string
  unit?: string
}

export type Guide = {
  id: string
  car_id: string
  task: string
  task_slug: string
  overview: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'
  estimated_time: string
  tools_needed: Tool[]
  parts_needed: Part[]
  safety_notes: string[]
  created_at: string
  updated_at: string
  pc_cars?: Car
  pc_guide_steps?: GuideStep[]
}

export type Tool = {
  name: string
  size?: string
  type?: string
}

export type Part = {
  name: string
  part_number?: string
  quantity?: number
  notes?: string
}
