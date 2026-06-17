import { useEffect, useRef, useState } from 'react'
import { snapPositionToPathNetwork } from '../lib/pathSnapping'

export function usePathSnapping({
  position,
  routeCoordinates,
  walkwayPaths,
  active,
}) {
  const previousSnapRef = useRef(null)
  const [snap, setSnap] = useState(null)

  useEffect(() => {
    const nextSnap = snapPositionToPathNetwork({
      position,
      routeCoordinates: active ? routeCoordinates : null,
      walkwayPaths,
      previousSnap: previousSnapRef.current,
    })

    previousSnapRef.current = nextSnap?.snapped ? nextSnap : null
    setSnap(nextSnap)
  }, [active, position, routeCoordinates, walkwayPaths])

  return {
    position: snap?.point ?? position,
    snap,
  }
}
