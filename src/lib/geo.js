const EARTH_RADIUS_M = 6371000

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

export function toDegrees(radians) {
  return (radians * 180) / Math.PI
}

export function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

export function coordKey([lat, lng]) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`
}

export function isWithinCampusBounds([lat, lng], bounds) {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
}

/** Project a point onto a line segment; returns nearest point on segment. */
export function nearestPointOnSegment(point, segStart, segEnd) {
  const [pLat, pLng] = point
  const [aLat, aLng] = segStart
  const [bLat, bLng] = segEnd

  const dx = bLng - aLng
  const dy = bLat - aLat

  if (dx === 0 && dy === 0) {
    return { point: segStart, t: 0, distance: haversineDistance(point, segStart) }
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy),
    ),
  )

  const projected = [aLat + t * dy, aLng + t * dx]
  return {
    point: projected,
    t,
    distance: haversineDistance(point, projected),
  }
}

export function bearingBetween([lat1, lng1], [lat2, lng2]) {
  const dLng = toRadians(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRadians(lat2))
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLng)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

export function bearingToCardinal(bearing) {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
  return directions[Math.round(bearing / 45) % 8]
}

export function smoothCoordinate(prev, next, alpha = 0.35) {
  if (!prev) return next
  return [
    prev[0] + alpha * (next[0] - prev[0]),
    prev[1] + alpha * (next[1] - prev[1]),
  ]
}

export function findNearestNode(position, nodes) {
  if (!position || nodes.length === 0) return null

  let nearest = nodes[0]
  let minDistance = haversineDistance(position, nearest.coords)

  for (let i = 1; i < nodes.length; i += 1) {
    const distance = haversineDistance(position, nodes[i].coords)
    if (distance < minDistance) {
      minDistance = distance
      nearest = nodes[i]
    }
  }

  return nearest
}
