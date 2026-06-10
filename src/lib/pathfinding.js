import { haversineDistance } from './geo'

function heuristic(nodeIdA, nodeIdB, nodes) {
  return haversineDistance(
    nodes.get(nodeIdA).coords,
    nodes.get(nodeIdB).coords,
  )
}

function reconstructPath(cameFrom, endId, nodes) {
  const nodeIds = [endId]
  let current = endId

  while (cameFrom.has(current)) {
    const { from } = cameFrom.get(current)
    nodeIds.unshift(from)
    current = from
  }

  const coordinates = nodeIds.map((id) => nodes.get(id).coords)
  return { nodeIds, coordinates }
}

function stitchRouteCoordinates(cameFrom, endId) {
  const segments = []
  let current = endId

  while (cameFrom.has(current)) {
    const { from, edge } = cameFrom.get(current)
    segments.unshift(edge.coordinates)
    current = from
  }

  if (segments.length === 0) return []

  const route = [...segments[0]]
  for (let i = 1; i < segments.length; i += 1) {
    route.push(...segments[i].slice(1))
  }

  return route
}

export function findShortestPath(startId, endId, nodes, adjacency) {
  if (!nodes.has(startId) || !nodes.has(endId)) return null
  if (startId === endId) {
    return {
      nodeIds: [startId],
      coordinates: [nodes.get(startId).coords],
      routeCoordinates: [nodes.get(startId).coords],
    }
  }

  const openSet = new Set([startId])
  const cameFrom = new Map()
  const gScore = new Map([[startId, 0]])
  const fScore = new Map([[startId, heuristic(startId, endId, nodes)]])

  while (openSet.size > 0) {
    let current = null
    let lowestF = Infinity

    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity
      if (f < lowestF) {
        lowestF = f
        current = id
      }
    }

    if (current === endId) {
      const base = reconstructPath(cameFrom, current, nodes)
      return {
        ...base,
        routeCoordinates: stitchRouteCoordinates(cameFrom, current),
      }
    }

    openSet.delete(current)

    for (const edge of adjacency.get(current) ?? []) {
      const tentativeG = (gScore.get(current) ?? Infinity) + edge.weight

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, { from: current, edge })
        gScore.set(edge.to, tentativeG)
        fScore.set(edge.to, tentativeG + heuristic(edge.to, endId, nodes))
        openSet.add(edge.to)
      }
    }
  }

  return null
}
