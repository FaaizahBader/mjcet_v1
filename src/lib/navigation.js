import { haversineDistance } from './geo'

export const NAVIGATION_STATES = {
  IDLE: 'idle',
  DESTINATION_SELECTED: 'destination_selected',
  READY: 'ready_to_navigate',
  ACTIVE: 'navigation_active',
  REROUTING: 'rerouting',
  REACHED: 'destination_reached',
}

export const WALKING_SPEED_MPS = 1.35
export const ARRIVAL_RADIUS_M = 12
export const REROUTE_THRESHOLD_M = 24
export const STEP_COMPLETION_RADIUS_M = 8

const INSTRUCTION_ARROWS = {
  straight: '^',
  left: 'L',
  right: 'R',
  start: '->',
  arrive: 'OK',
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toXY(coord, origin) {
  const [lat, lng] = coord
  const [originLat, originLng] = origin
  const metersPerDegreeLat = 111320
  const metersPerDegreeLng =
    111320 * Math.cos((originLat * Math.PI) / 180)

  return {
    x: (lng - originLng) * metersPerDegreeLng,
    y: (lat - originLat) * metersPerDegreeLat,
  }
}

function bearing(from, to) {
  const [lat1, lng1] = from.map((value) => (value * Math.PI) / 180)
  const [lat2, lng2] = to.map((value) => (value * Math.PI) / 180)
  const deltaLng = lng2 - lng1
  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function angleDelta(previous, next) {
  return ((next - previous + 540) % 360) - 180
}

function routeDistance(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0

  return coordinates.reduce((total, coord, index) => {
    if (index === 0) return total
    return total + haversineDistance(coordinates[index - 1], coord)
  }, 0)
}

function projectPointToSegment(point, start, end) {
  const origin = start
  const p = toXY(point, origin)
  const a = toXY(start, origin)
  const b = toXY(end, origin)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1)

  const projected = [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
  ]

  return {
    point: projected,
    t,
    distance: haversineDistance(point, projected),
    distanceFromStart: haversineDistance(start, projected),
  }
}

export function calculateRouteDistance(coordinates) {
  return routeDistance(coordinates)
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '0 m'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.max(0, Math.round(meters))} m`
}

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} min`
}

export function estimateWalkSeconds(meters) {
  return meters / WALKING_SPEED_MPS
}

export function formatEta(secondsFromNow) {
  const eta = new Date(Date.now() + secondsFromNow * 1000)
  return eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function getDestinationBuilding(destination) {
  const explicit = destination.building || destination.block
  if (explicit) return explicit

  const blockMatch = destination.label.match(/block\s*([0-9ivx]+)/i)
  if (blockMatch) return `Block ${blockMatch[1].toUpperCase()}`

  return destination.isManual ? 'Selected map point' : 'Campus destination'
}

export function buildRouteProgress(position, coordinates) {
  if (!position || !coordinates || coordinates.length < 2) return null

  const totalDistance = routeDistance(coordinates)
  let best = null
  let distanceBeforeSegment = 0

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const segmentDistance = haversineDistance(coordinates[i], coordinates[i + 1])
    const projection = projectPointToSegment(
      position,
      coordinates[i],
      coordinates[i + 1],
    )

    if (!best || projection.distance < best.distanceFromRoute) {
      best = {
        segmentIndex: i,
        projectedPoint: projection.point,
        distanceFromRoute: projection.distance,
        distanceAlong: distanceBeforeSegment + projection.distanceFromStart,
      }
    }

    distanceBeforeSegment += segmentDistance
  }

  const remainingCoordinates = [
    best.projectedPoint,
    ...coordinates.slice(best.segmentIndex + 1),
  ]
  const remainingDistance = routeDistance(remainingCoordinates)
  const progress = totalDistance > 0 ? best.distanceAlong / totalDistance : 1

  return {
    ...best,
    remainingCoordinates,
    remainingDistance,
    totalDistance,
    progressPercent: Math.round(clamp(progress, 0, 1) * 100),
  }
}

function instructionKind(previousBearing, nextBearing, index) {
  if (index === 0) return 'start'

  const delta = angleDelta(previousBearing, nextBearing)
  if (Math.abs(delta) < 35) return 'straight'
  return delta > 0 ? 'right' : 'left'
}

function instructionText(kind, distance, destinationLabel, isFinal) {
  const distanceText = formatDistance(distance)
  if (isFinal) return `Continue toward ${destinationLabel} for ${distanceText}`
  if (kind === 'right') return `Turn right and walk ${distanceText}`
  if (kind === 'left') return `Turn left and walk ${distanceText}`
  if (kind === 'start') return `Walk straight for ${distanceText}`
  return `Continue straight for ${distanceText}`
}

export function buildTurnByTurnSteps(coordinates, destinationLabel) {
  if (!coordinates || coordinates.length < 2) return []

  const steps = []
  let traveled = 0

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const distance = haversineDistance(coordinates[i], coordinates[i + 1])
    if (distance < 2) continue

    const currentBearing = bearing(coordinates[i], coordinates[i + 1])
    const previousBearing =
      i > 0 ? bearing(coordinates[i - 1], coordinates[i]) : currentBearing
    const kind = instructionKind(previousBearing, currentBearing, i)
    const isFinal = i === coordinates.length - 2
    const text = instructionText(kind, distance, destinationLabel, isFinal)

    steps.push({
      id: `${i}-${Math.round(traveled)}`,
      index: steps.length,
      kind,
      arrow: INSTRUCTION_ARROWS[kind],
      text,
      distance,
      startDistance: traveled,
      endDistance: traveled + distance,
    })

    traveled += distance
  }

  steps.push({
    id: 'arrive',
    index: steps.length,
    kind: 'arrive',
    arrow: INSTRUCTION_ARROWS.arrive,
    text: `You have arrived at ${destinationLabel}`,
    distance: 0,
    startDistance: traveled,
    endDistance: traveled,
  })

  return steps
}

export function getActiveStep(steps, distanceAlong) {
  if (!steps.length) return null

  return (
    steps.find(
      (step) => distanceAlong <= step.endDistance - STEP_COMPLETION_RADIUS_M,
    ) ?? steps[steps.length - 1]
  )
}
