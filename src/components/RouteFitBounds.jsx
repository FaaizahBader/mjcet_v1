import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

export default function RouteFitBounds({
  routeCoordinates,
  position,
  destinationCoords,
}) {
  const map = useMap()
  const lastRouteKey = useRef(null)

  useEffect(() => {
    if (!routeCoordinates?.length) {
      lastRouteKey.current = null
      return
    }

    const routeKey = `${routeCoordinates.length}:${routeCoordinates[0]?.join(',')}:${routeCoordinates.at(-1)?.join(',')}`
    if (routeKey === lastRouteKey.current) return
    lastRouteKey.current = routeKey

    const points = [...routeCoordinates]
    if (position) points.push(position)
    if (destinationCoords) points.push(destinationCoords)

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [64, 64], maxZoom: 19 })
  }, [map, routeCoordinates, position, destinationCoords])

  return null
}
