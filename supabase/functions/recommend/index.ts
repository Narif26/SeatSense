import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StudySpot {
  id: string
  name: string
  building: string
  floor: string
  lat: number
  lng: number
}

interface SpotStatus {
  occupancy_percent: number | null
  noise_level: string | null
  updated_at: string
  source: string
  wifi_latency: number | null
}

interface RecommendationRequest {
  duration?: number
  groupSize?: number
  lat: number
  lng: number
}

interface ScoredSpot {
  spot: StudySpot
  status: SpotStatus | null
  score: number
  distance: number
  warnings: string[]
  matchReason: string
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function scoreSpot(
  spot: StudySpot,
  status: SpotStatus | null,
  userPrefs: RecommendationRequest
): { score: number; warnings: string[]; matchReason: string } {
  const warnings: string[] = []
  let matchReason = ''

  // Availability score (50% weight)
  let availability = 0.5
  if (status && status.occupancy_percent !== null) {
    availability = 1 - (status.occupancy_percent / 100)
  } else {
    warnings.push('Occupancy unknown - using neutral estimate')
  }

  // Distance score (50% weight - increased from 30%)
  const distance = calculateDistance(userPrefs.lat, userPrefs.lng, spot.lat, spot.lng)
  const distanceMatch = Math.max(0, 1 - Math.min(distance / 1500, 1))

  const totalScore = (0.5 * availability) + (0.5 * distanceMatch)

  if (!matchReason) {
    if (distance < 300) {
      matchReason = 'Very close to your location'
    } else if (availability > 0.7) {
      matchReason = 'Plenty of space available'
    } else {
      matchReason = 'Good overall match'
    }
  }

  return { score: totalScore, warnings, matchReason }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const userPrefs: RecommendationRequest = await req.json()

    console.log('Received recommendation request:', userPrefs)

    // Fetch all spots
    const { data: spots, error: spotsError } = await supabase
      .from('study_spots')
      .select('*')

    if (spotsError) {
      console.error('Error fetching spots:', spotsError)
      throw spotsError
    }

    // Fetch latest status for each spot
    const spotIds = spots.map((s: StudySpot) => s.id)
    const { data: statuses, error: statusError } = await supabase
      .from('spot_status')
      .select('*')
      .in('spot_id', spotIds)
      .order('updated_at', { ascending: false })

    if (statusError) {
      console.error('Error fetching statuses:', statusError)
    }

    // Group statuses by spot_id (take most recent)
    const statusMap = new Map<string, SpotStatus>()
    if (statuses) {
      for (const status of statuses) {
        if (!statusMap.has(status.spot_id)) {
          statusMap.set(status.spot_id, status)
        }
      }
    }

    // Score all spots
    const scoredSpots: ScoredSpot[] = spots.map((spot: StudySpot) => {
      const status = statusMap.get(spot.id) || null
      const distance = calculateDistance(userPrefs.lat, userPrefs.lng, spot.lat, spot.lng)
      const { score, warnings, matchReason } = scoreSpot(spot, status, userPrefs)

      return { spot, status, score, distance, warnings, matchReason }
    })

    // Sort by score and take top 5
    scoredSpots.sort((a, b) => b.score - a.score)
    const topSpots = scoredSpots.slice(0, 5)

    console.log('Returning top recommendations:', topSpots.length)

    return new Response(
      JSON.stringify({ recommendations: topSpots }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in recommend function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})