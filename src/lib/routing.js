import {
  bearingBetween,
  bearingToCardinal,
  haversineDistance,
} from './geo'
import { findShortestPath } from './pathfinding'
import { snapPositionToNetwork } from './graph'

const WALKING_SPEED_MPS = 1.4
const DEBUG_ROUTING = import.meta.env.DEV

function appendSegment(route, segment) {
  if (!segment?.length) return route

  const next = [...route]
  const startIndex = next.length === 0 ? 0 : 1

  for (let i = startIndex; i < segment.length; i += 1) {
    next.push(segment[i])
  }

  return next
}

function buildFullRouteCoordinates(position, startSnap, pathResult, destinationCoords) {
  let route = []

  if (position) {
    route.push(position)
  }

  if (
    startSnap?.point &&
    position &&
    haversineDistance(position, startSnap.point) > 2
  ) {
    route.push(startSnap.point)
  }

  route = appendSegment(route, pathResult?.routeCoordinates)

  if (
    destinationCoords &&
    (route.length === 0 ||
      haversineDistance(route[route.length - 1], destinationCoords) > 2)
  ) {
    route.push(destinationCoords)
  }

  return route.length > 1 ? route : route
}

function pathLengthMeters(routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length < 2) return 0

  let total = 0
  for (let i = 1; i < routeCoordinates.length; i += 1) {
    total += haversineDistance(routeCoordinates[i - 1], routeCoordinates[i])
  }
  return total
}

function generateDirections(nodeIds, nodes) {
  if (!nodeIds || nodeIds.length < 2) {
    const label = nodes.get(nodeIds?.[0])?.label ?? 'destination'
    return [{ text: `You have arrived at ${label}.`, distanceM: 0 }]
  }

  const directions = []

  for (let i = 1; i < nodeIds.length; i += 1) {
    const from = nodes.get(nodeIds[i - 1])
    const to = nodes.get(nodeIds[i])
    const distanceM = haversineDistance(from.coords, to.coords)
    const bearing = bearingBetween(from.coords, to.coords)
    const cardinal = bearingToCardinal(bearing)

    directions.push({
      text: `Head ${cardinal} toward ${to.label}`,
      distanceM,
    })
  }

  const destination = nodes.get(nodeIds[nodeIds.length - 1])
  directions.push({
    text: `Arrive at ${destination.label}`,
    distanceM: 0,
  })

  return directions
}

export function computeRoute(position, destination, campusData) {
  const { nodes, adjacency } = campusData

  if (!position || !destination) {
    return { ok: false, error: 'Missing start or destination.' }
  }

  const startSnap = snapPositionToNetwork(position, nodes, adjacency)
  const endId = destination.id

  if (!startSnap?.nodeId || !nodes.has(endId)) {
    return { ok: false, error: 'Invalid routing nodes.' }
  }

  const pathResult = findShortestPath(
    startSnap.nodeId,
    endId,
    nodes,
    adjacency,
  )

  if (DEBUG_ROUTING) {
    console.group('[routing] Route request')
    console.log('Start GPS:', position, `(±${startSnap.distance?.toFixed?.(0) ?? '?'} m to network)`)
    console.log('Start node:', startSnap.nodeId, nodes.get(startSnap.nodeId)?.label)
    console.log('Destination:', destination.label, destination.coords)
    console.log('Path nodes:', pathResult?.nodeIds ?? null)
    console.log('Route geometry points:', pathResult?.routeCoordinates?.length ?? 0)
    console.groupEnd()
  }

  if (!pathResult) {
    return {
      ok: false,
      error: 'No walking route found to that destination.',
    }
  }

  const routeCoordinates = buildFullRouteCoordinates(
    position,
    startSnap,
    pathResult,
    destination.coords,
  )

  if (routeCoordinates.length < 2) {
    return {
      ok: false,
      error: 'No walking route found to that destination.',
    }
  }

  const distanceM = Math.round(pathLengthMeters(routeCoordinates))
  const durationMin = Math.max(1, Math.round(distanceM / WALKING_SPEED_MPS / 60))
  const directions = generateDirections(pathResult.nodeIds, nodes)

  return {
    ok: true,
    routeCoordinates,
    pathResult,
    startSnap,
    distanceM,
    durationMin,
    directions,
  }
}

export function formatRouteSummary(distanceM, durationMin) {
  if (distanceM >= 1000) {
    return `Distance: ${(distanceM / 1000).toFixed(1)} km · Walking time: ${durationMin} min`
  }
  return `Distance: ${distanceM} m · Walking time: ${durationMin} min`
}
