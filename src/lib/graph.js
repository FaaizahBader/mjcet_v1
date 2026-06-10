import {
  haversineDistance,
  isWithinCampusBounds,
  nearestPointOnSegment,
} from './geo'
import { CAMPUS_BOUNDS } from './constants'

const ORPHAN_CONNECT_MAX_M = 120
const DEBUG_ROUTING = import.meta.env.DEV

function addEdge(adjacency, from, to, weight, coordinates, synthetic = false) {
  if (!adjacency.has(from)) adjacency.set(from, [])
  adjacency.get(from).push({ to, weight, coordinates, synthetic })
}

function getConnectedComponents(nodes, adjacency) {
  const visited = new Set()
  const components = []

  for (const id of nodes.keys()) {
    if (visited.has(id)) continue

    const queue = [id]
    const component = new Set()

    while (queue.length > 0) {
      const current = queue.pop()
      if (visited.has(current)) continue
      visited.add(current)
      component.add(current)

      for (const edge of adjacency.get(current) ?? []) {
        queue.push(edge.to)
      }
    }

    components.push(component)
  }

  return components
}

function connectOrphanNodes(nodes, adjacency) {
  const orphans = [...nodes.keys()].filter(
    (id) => (adjacency.get(id) ?? []).length === 0,
  )

  for (const orphanId of orphans) {
    const orphan = nodes.get(orphanId)
    let nearestId = null
    let minDistance = Infinity

    for (const [id, node] of nodes) {
      if (id === orphanId) continue
      const distance = haversineDistance(orphan.coords, node.coords)
      if (distance < minDistance) {
        minDistance = distance
        nearestId = id
      }
    }

    if (!nearestId || minDistance > ORPHAN_CONNECT_MAX_M) continue

    const connector = [orphan.coords, nodes.get(nearestId).coords]
    addEdge(adjacency, orphanId, nearestId, minDistance, connector, true)
    addEdge(adjacency, nearestId, orphanId, minDistance, [...connector].reverse(), true)

    if (DEBUG_ROUTING) {
      console.warn(
        `[routing] Auto-connected orphan "${orphan.label}" → "${nodes.get(nearestId).label}" (${Math.round(minDistance)} m)`,
      )
    }
  }
}

function bridgeSmallComponents(nodes, adjacency) {
  const components = getConnectedComponents(nodes, adjacency)
  if (components.length <= 1) return

  const ranked = components
    .map((component) => ({
      component,
      size: component.size,
    }))
    .sort((a, b) => b.size - a.size)

  const main = ranked[0].component

  for (let i = 1; i < ranked.length; i += 1) {
    const island = ranked[i].component
    let best = null

    for (const islandId of island) {
      for (const mainId of main) {
        const distance = haversineDistance(
          nodes.get(islandId).coords,
          nodes.get(mainId).coords,
        )
        if (!best || distance < best.distance) {
          best = { islandId, mainId, distance }
        }
      }
    }

    if (!best || best.distance > ORPHAN_CONNECT_MAX_M) continue

    const fromCoords = nodes.get(best.islandId).coords
    const toCoords = nodes.get(best.mainId).coords
    const connector = [fromCoords, toCoords]

    addEdge(adjacency, best.islandId, best.mainId, best.distance, connector, true)
    addEdge(adjacency, best.mainId, best.islandId, best.distance, [...connector].reverse(), true)

    for (const id of island) main.add(id)

    if (DEBUG_ROUTING) {
      console.warn(
        `[routing] Bridged island via "${nodes.get(best.islandId).label}" ↔ "${nodes.get(best.mainId).label}" (${Math.round(best.distance)} m)`,
      )
    }
  }
}

export function validateDestinations(destinations) {
  if (!DEBUG_ROUTING) return

  console.group('[routing] Destination coordinate audit')
  for (const destination of destinations) {
    const [lat, lng] = destination.coords
    const inBounds = isWithinCampusBounds(destination.coords, CAMPUS_BOUNDS)
    console.log(destination.label, { lat, lng, inBounds })
    if (!inBounds) {
      console.warn(`  ⚠ "${destination.label}" is outside campus bounds`)
    }
  }
  console.groupEnd()
}

export function parseCampusGeoJson(geoJson) {
  const nodes = new Map()
  const paths = []

  for (const feature of geoJson.features) {
    const { properties, geometry } = feature

    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates
      nodes.set(properties.id, {
        id: properties.id,
        label: properties.label,
        coords: [lat, lng],
        nodeType: properties.type,
      })
      continue
    }

    if (geometry.type === 'LineString' && properties.type === 'path') {
      paths.push({
        from: properties.from,
        to: properties.to,
        weight: properties.distance_m,
        coordinates: geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      })
    }
  }

  const adjacency = new Map()

  for (const path of paths) {
    addEdge(adjacency, path.from, path.to, path.weight, path.coordinates)
    addEdge(adjacency, path.to, path.from, path.weight, [...path.coordinates].reverse())
  }

  connectOrphanNodes(nodes, adjacency)
  bridgeSmallComponents(nodes, adjacency)

  const destinations = Array.from(nodes.values())
    .filter((node) => node.nodeType === 'destination')
    .sort((a, b) => a.label.localeCompare(b.label))

  validateDestinations(destinations)

  if (DEBUG_ROUTING) {
    const components = getConnectedComponents(nodes, adjacency)
    console.log(`[routing] Graph: ${nodes.size} nodes, ${paths.length} paths, ${components.length} component(s)`)
  }

  return { nodes, adjacency, paths, destinations }
}

export function findNearestNodeId(position, nodes) {
  if (!position || nodes.size === 0) return null

  let nearestId = null
  let minDistance = Infinity

  for (const [id, node] of nodes) {
    const distance = haversineDistance(position, node.coords)
    if (distance < minDistance) {
      minDistance = distance
      nearestId = id
    }
  }

  return nearestId
}

/** Snap a GPS point to the nearest location on the walkable path network. */
export function snapPositionToNetwork(position, nodes, adjacency) {
  if (!position) return null

  let best = null

  for (const [fromId, edges] of adjacency) {
    for (const edge of edges) {
      if (edge.synthetic) continue

      const coords = edge.coordinates
      for (let i = 0; i < coords.length - 1; i += 1) {
        const projection = nearestPointOnSegment(
          position,
          coords[i],
          coords[i + 1],
        )

        if (!best || projection.distance < best.distance) {
          best = {
            distance: projection.distance,
            point: projection.point,
            nodeId: projection.t <= 0.5 ? fromId : edge.to,
            fromId,
            toId: edge.to,
          }
        }
      }
    }
  }

  const nearestNodeId = findNearestNodeId(position, nodes)
  const nearestNodeDistance = haversineDistance(
    position,
    nodes.get(nearestNodeId).coords,
  )

  if (!best || nearestNodeDistance < best.distance) {
    return {
      nodeId: nearestNodeId,
      point: nodes.get(nearestNodeId).coords,
      distance: nearestNodeDistance,
      snappedToEdge: false,
    }
  }

  return {
    nodeId: best.nodeId,
    point: best.point,
    distance: best.distance,
    snappedToEdge: true,
  }
}

export function getReachableDestinationIds(nodes, adjacency, startId) {
  const visited = new Set()
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.pop()
    if (visited.has(current)) continue
    visited.add(current)

    for (const edge of adjacency.get(current) ?? []) {
      queue.push(edge.to)
    }
  }

  return visited
}
