import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
