function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angleBetween(previous, next) {
  const previousAngle = Math.atan2(previous.y, previous.x)
  const nextAngle = Math.atan2(next.y, next.x)
  return ((nextAngle - previousAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
}

function directionKind(previousPoint, currentPoint, nextPoint) {
  const previous = {
    x: currentPoint.x - previousPoint.x,
    y: currentPoint.y - previousPoint.y,
  }
  const next = {
    x: nextPoint.x - currentPoint.x,
    y: nextPoint.y - currentPoint.y,
  }
  const delta = angleBetween(previous, next)

  if (Math.abs(delta) < Math.PI / 6) return 'straight'
  return delta > 0 ? 'right' : 'left'
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

export function buildIndoorDirections(route, destinationLabel) {
  if (!route?.coordinates?.length) return []

  const coordinates = route.coordinates.filter((point, index, points) => {
    if (index === 0) return true
    return distanceBetween(points[index - 1], point) > 1
  })

  const steps = [
    {
      id: 'start',
      text: 'Go straight from the entrance.',
    },
  ]

  for (let i = 1; i < coordinates.length - 1; i += 1) {
    const kind = directionKind(
      coordinates[i - 1],
      coordinates[i],
      coordinates[i + 1],
    )

    if (kind === 'straight') continue

    steps.push({
      id: `${kind}-${i}`,
      text:
        i === coordinates.length - 2
          ? `Turn ${kind} for ${destinationLabel}.`
          : `Turn ${kind} and continue.`,
    })
  }

  steps.push({
    id: 'arrive',
    text: `You have reached ${destinationLabel}.`,
  })

  if (steps.length === 3 && steps[1].text.endsWith('and continue.')) {
    steps[1] = {
      ...steps[1],
      text: steps[1].text.replace('and continue.', `for ${destinationLabel}.`),
    }
  }

  return steps
}
