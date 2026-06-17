import { haversineDistance } from './geo'

export const PATH_SNAP_THRESHOLD_M = 22
export const ROUTE_SNAP_THRESHOLD_M = 28

const SAME_SEGMENT_BONUS_M = 6
const SNAP_SMOOTHING_ALPHA = 0.72

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
  }
}

function findNearestPolylinePoint(position, polylines, previousSnap) {
  let best = null

  for (const polyline of polylines) {
    const coordinates = polyline.coordinates
    if (!coordinates || coordinates.length < 2) continue

    for (let i = 0; i < coordinates.length - 1; i += 1) {
      const segmentId = `${polyline.id}:${i}`
      const projection = projectPointToSegment(
        position,
        coordinates[i],
        coordinates[i + 1],
      )
      const score =
        projection.distance -
        (previousSnap?.segmentId === segmentId ? SAME_SEGMENT_BONUS_M : 0)

      if (!best || score < best.score) {
        best = {
          ...projection,
          score,
          segmentId,
          source: polyline.source,
        }
      }
    }
  }

  return best
}

function smoothSnappedPoint(previousSnap, nextPoint, segmentId) {
  if (!previousSnap?.point || previousSnap.segmentId !== segmentId) {
    return nextPoint
  }

  return [
    previousSnap.point[0] +
      SNAP_SMOOTHING_ALPHA * (nextPoint[0] - previousSnap.point[0]),
    previousSnap.point[1] +
      SNAP_SMOOTHING_ALPHA * (nextPoint[1] - previousSnap.point[1]),
  ]
}

export function snapPositionToPathNetwork({
  position,
  routeCoordinates,
  walkwayPaths,
  previousSnap,
}) {
  if (!position) return null

  const routePolyline =
    routeCoordinates?.length > 1
      ? [
          {
            id: 'active-route',
            source: 'route',
            coordinates: routeCoordinates,
          },
        ]
      : []

  const routeSnap = findNearestPolylinePoint(
    position,
    routePolyline,
    previousSnap,
  )

  if (routeSnap && routeSnap.distance <= ROUTE_SNAP_THRESHOLD_M) {
    const point = smoothSnappedPoint(
      previousSnap,
      routeSnap.point,
      routeSnap.segmentId,
    )

    return {
      ...routeSnap,
      point,
      snapped: true,
      threshold: ROUTE_SNAP_THRESHOLD_M,
    }
  }

  const pathPolylines =
    walkwayPaths?.map((path, index) => ({
      id: `${path.from}-${path.to}-${index}`,
      source: 'network',
      coordinates: path.coordinates,
    })) ?? []
  const pathSnap = findNearestPolylinePoint(
    position,
    pathPolylines,
    previousSnap,
  )

  if (pathSnap && pathSnap.distance <= PATH_SNAP_THRESHOLD_M) {
    const point = smoothSnappedPoint(
      previousSnap,
      pathSnap.point,
      pathSnap.segmentId,
    )

    return {
      ...pathSnap,
      point,
      snapped: true,
      threshold: PATH_SNAP_THRESHOLD_M,
    }
  }

  return {
    point: position,
    distance: pathSnap?.distance ?? routeSnap?.distance ?? Infinity,
    segmentId: null,
    source: 'raw',
    snapped: false,
    threshold: PATH_SNAP_THRESHOLD_M,
  }
}
