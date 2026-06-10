import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { CAMPUS_BOUNDS } from '../lib/constants'
import { isWithinCampusBounds } from '../lib/geo'

export default function MapClickHandler({ enabled, onSelect, onOutOfBounds }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled) return undefined

    const handleClick = (event) => {
      const coords = [event.latlng.lat, event.latlng.lng]

      if (!isWithinCampusBounds(coords, CAMPUS_BOUNDS)) {
        onOutOfBounds?.()
        return
      }

      onSelect(coords)
    }

    map.on('click', handleClick)
    return () => map.off('click', handleClick)
  }, [enabled, map, onSelect, onOutOfBounds])

  return null
}
