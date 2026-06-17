import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

const FOLLOW_THROTTLE_MS = 1800
const EDGE_PADDING_PX = 96

export default function FollowUserPosition({ active, position }) {
  const map = useMap()
  const lastMoveRef = useRef(0)

  useEffect(() => {
    if (!active || !position) return

    const now = Date.now()
    if (now - lastMoveRef.current < FOLLOW_THROTTLE_MS) return

    const point = map.latLngToContainerPoint(position)
    const size = map.getSize()
    const outsideComfortZone =
      point.x < EDGE_PADDING_PX ||
      point.y < EDGE_PADDING_PX ||
      point.x > size.x - EDGE_PADDING_PX ||
      point.y > size.y - EDGE_PADDING_PX

    if (!outsideComfortZone) return

    lastMoveRef.current = now
    map.panTo(position, { animate: true, duration: 0.45 })
  }, [active, map, position])

  return null
}
