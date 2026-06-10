import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export default function MapInitialCenter({ position }) {
  const map = useMap()
  const hasCentered = useRef(false)

  useEffect(() => {
    if (!position || hasCentered.current) return
    map.flyTo(position, Math.max(map.getZoom(), 18), { duration: 0.8 })
    hasCentered.current = true
  }, [map, position])

  return null
}
