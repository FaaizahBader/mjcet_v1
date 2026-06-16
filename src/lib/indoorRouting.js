function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function buildAdjacency(map) {
  const adjacency = new Map()

  for (const [from, to] of map.edges) {
    const fromNode = map.nodes[from]
    const toNode = map.nodes[to]
    if (!fromNode || !toNode) continue

    const weight = distanceBetween(fromNode, toNode)
    if (!adjacency.has(from)) adjacency.set(from, [])
    if (!adjacency.has(to)) adjacency.set(to, [])
    adjacency.get(from).push({ to, weight })
    adjacency.get(to).push({ to: from, weight })
  }

  return adjacency
}

function reconstructPath(previous, endId) {
  const path = [endId]
  let current = endId

  while (previous.has(current)) {
    current = previous.get(current)
    path.unshift(current)
  }

  return path
}

export function findIndoorShortestPath(map, startId, endId) {
  if (!map?.nodes?.[startId] || !map?.nodes?.[endId]) return null

  const adjacency = buildAdjacency(map)
  const unvisited = new Set(Object.keys(map.nodes))
  const distances = new Map([[startId, 0]])
  const previous = new Map()

  while (unvisited.size > 0) {
    let current = null
    let bestDistance = Infinity

    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Infinity
      if (distance < bestDistance) {
        current = nodeId
        bestDistance = distance
      }
    }

    if (!current || bestDistance === Infinity) break
    if (current === endId) {
      const nodeIds = reconstructPath(previous, endId)
      return {
        nodeIds,
        coordinates: nodeIds.map((id) => map.nodes[id]),
        distance: bestDistance,
      }
    }

    unvisited.delete(current)

    for (const edge of adjacency.get(current) ?? []) {
      const nextDistance = bestDistance + edge.weight
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance)
        previous.set(edge.to, current)
      }
    }
  }

  return null
}
