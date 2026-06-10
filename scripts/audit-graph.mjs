import { readFileSync } from 'fs'

const EARTH_RADIUS_M = 6371000
function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function parseCampusGeoJson(geoJson) {
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
  const addEdge = (from, to, weight, coordinates) => {
    if (!adjacency.has(from)) adjacency.set(from, [])
    adjacency.get(from).push({ to, weight, coordinates })
  }
  for (const path of paths) {
    addEdge(path.from, path.to, path.weight, path.coordinates)
    addEdge(path.to, path.from, path.weight, [...path.coordinates].reverse())
  }
  return { nodes, adjacency, paths }
}

function findShortestPath(startId, endId, nodes, adjacency) {
  if (!nodes.has(startId) || !nodes.has(endId)) return null
  if (startId === endId) return { nodeIds: [startId] }
  const openSet = new Set([startId])
  const cameFrom = new Map()
  const gScore = new Map([[startId, 0]])
  const heuristic = (a, b) =>
    haversineDistance(nodes.get(a).coords, nodes.get(b).coords)
  const fScore = new Map([[startId, heuristic(startId, endId)]])
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
      const nodeIds = [endId]
      let c = endId
      while (cameFrom.has(c)) {
        c = cameFrom.get(c)
        nodeIds.unshift(c)
      }
      return { nodeIds }
    }
    openSet.delete(current)
    for (const edge of adjacency.get(current) ?? []) {
      const tentativeG = (gScore.get(current) ?? Infinity) + edge.weight
      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current)
        gScore.set(edge.to, tentativeG)
        fScore.set(edge.to, tentativeG + heuristic(edge.to, endId))
        openSet.add(edge.to)
      }
    }
  }
  return null
}

const geo = JSON.parse(readFileSync('./public/data/mjcet_campus.geojson', 'utf8'))
const data = parseCampusGeoJson(geo)

const visited = new Set()
const components = []
for (const [id] of data.nodes) {
  if (visited.has(id)) continue
  const queue = [id]
  const comp = new Set()
  while (queue.length) {
    const cur = queue.pop()
    if (visited.has(cur)) continue
    visited.add(cur)
    comp.add(cur)
    for (const e of data.adjacency.get(cur) ?? []) queue.push(e.to)
  }
  components.push(comp)
}

console.log('Components:', components.length)
components.forEach((c, i) => {
  const dests = [...c]
    .filter((id) => data.nodes.get(id)?.nodeType === 'destination')
    .map((id) => data.nodes.get(id).label)
  console.log(`Component ${i + 1} (${c.size} nodes):`, dests.join(', ') || '(no destinations)')
})

const orphans = []
for (const [id, node] of data.nodes) {
  if ((data.adjacency.get(id) ?? []).length === 0) orphans.push(`${node.label} (${id})`)
}
console.log('\nOrphan nodes:', orphans)

const failing = [
  'sues',
  'sports',
  'law_college',
  'sukhf_gate',
  'parking_backtrance',
  'parking_main',
  'gate_nearsukhf',
  'block_1',
]
console.log('\nRoutes from main_gate:')
for (const end of failing) {
  const path = findShortestPath('main_gate', end, data.nodes, data.adjacency)
  console.log('  ->', data.nodes.get(end)?.label, path ? `${path.nodeIds.length} hops` : 'NO PATH')
}
