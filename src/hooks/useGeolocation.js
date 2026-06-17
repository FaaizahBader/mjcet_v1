/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { haversineDistance } from '../lib/geo'

const HIGH_ACCURACY_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 8000,
}

const MAX_ACCEPTED_ACCURACY_M = Number(
  import.meta.env.VITE_MAX_GPS_ACCURACY_M ?? 45,
)
const RELAXED_ACCURACY_M = Number(
  import.meta.env.VITE_RELAXED_GPS_ACCURACY_M ?? 70,
)
const MAX_WALKING_SPEED_MPS = 3.2
const MAX_JUMP_M = 75
const MIN_UPDATE_DISTANCE_M = 0.6
const EXCELLENT_ACCURACY_M = 18
const GOOD_ACCURACY_M = 30

function smoothPosition(previous, nextCoords, accuracy, speed, distanceFromPrevious) {
  if (!previous) return nextCoords

  if (
    accuracy <= EXCELLENT_ACCURACY_M &&
    (previous.accuracy > GOOD_ACCURACY_M || distanceFromPrevious > 4)
  ) {
    return nextCoords
  }

  let alpha = 0.42

  if (accuracy <= EXCELLENT_ACCURACY_M) alpha = 0.78
  else if (accuracy <= GOOD_ACCURACY_M) alpha = 0.62
  else if (accuracy > MAX_ACCEPTED_ACCURACY_M) alpha = 0.24

  if (speed > 0.8) alpha = Math.max(alpha, 0.68)
  if (speed < 0.25) alpha = Math.min(alpha, 0.36)

  return [
    previous.coords[0] + alpha * (nextCoords[0] - previous.coords[0]),
    previous.coords[1] + alpha * (nextCoords[1] - previous.coords[1]),
  ]
}

function mapPosition(pos, source) {
  return {
    coords: [pos.coords.latitude, pos.coords.longitude],
    accuracy: pos.coords.accuracy,
    source,
    timestamp: pos.timestamp,
  }
}

export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('pending')
  const [source, setSource] = useState(null)

  const watchIdRef = useRef(null)
  const lastAcceptedRef = useRef(null)
  const modeRef = useRef('gps')

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const applyPosition = useCallback((nextPosition) => {
    const nextAccuracy = nextPosition.accuracy ?? Infinity
    const lastAccepted = lastAcceptedRef.current
    const hasFix = Boolean(lastAccepted)
    const acceptedAccuracy = hasFix
      ? Math.min(
          RELAXED_ACCURACY_M,
          Math.max(MAX_ACCEPTED_ACCURACY_M, (lastAccepted.accuracy ?? 0) + 18),
        )
      : MAX_ACCEPTED_ACCURACY_M

    if (nextAccuracy > acceptedAccuracy) {
      setAccuracy(nextAccuracy)
      setSource(nextPosition.source)
      setStatus(hasFix ? 'watching' : 'pending')

      if (!hasFix) {
        setError(
          `Waiting for a more accurate GPS fix. Current accuracy is about ${Math.round(nextAccuracy)} meters.`,
        )
      }
      return
    }

    const previous = lastAcceptedRef.current
    const deltaSeconds = previous
      ? Math.max((nextPosition.timestamp - previous.timestamp) / 1000, 0.2)
      : 0.2
    const distanceFromPrevious = previous
      ? haversineDistance(previous.coords, nextPosition.coords)
      : 0
    const speed = distanceFromPrevious / deltaSeconds
    const allowedJump = Math.max(
      MAX_JUMP_M,
      MAX_WALKING_SPEED_MPS * deltaSeconds +
        nextAccuracy +
        (previous?.accuracy ?? 0),
    )

    // Outdoor pedestrians cannot teleport; keep one-off GPS spikes from dragging the marker.
    if (previous && distanceFromPrevious > allowedJump) {
      setAccuracy(nextAccuracy)
      setSource(nextPosition.source)
      setStatus('watching')
      return
    }

    // Smooth weak fixes, but let accurate outdoor GPS fixes correct the marker immediately.
    const filteredCoords = smoothPosition(
      previous,
      nextPosition.coords,
      nextAccuracy,
      speed,
      distanceFromPrevious,
    )

    if (
      previous &&
      speed < 0.35 &&
      haversineDistance(previous.coords, filteredCoords) < MIN_UPDATE_DISTANCE_M
    ) {
      setAccuracy(nextAccuracy)
      setSource(nextPosition.source)
      return
    }

    lastAcceptedRef.current = {
      coords: filteredCoords,
      accuracy: nextAccuracy,
      timestamp: nextPosition.timestamp,
    }

    setPosition(filteredCoords)
    setAccuracy(nextPosition.accuracy ?? null)
    setSource(nextPosition.source)
    setStatus('watching')
    setError(null)
  }, [])

  const startWatch = useCallback(
    (options, sourceLabel) => {
      if (!navigator.geolocation) return

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (modeRef.current !== 'error') {
            applyPosition(mapPosition(pos, sourceLabel))
          }
        },
        (err) => {
          if (modeRef.current === 'error') return

          if (err.code === 1) {
            setError(
              'Location permission denied. Enable GPS in browser settings to use navigation.',
            )
            setStatus('error')
            modeRef.current = 'error'
            clearWatch()
            return
          }

          setError(
            'Still looking for an accurate GPS fix. Try moving outdoors or check location access.',
          )
          setStatus('pending')
        },
        options,
      )
    },
    [applyPosition, clearWatch],
  )

  useEffect(() => {
    if (!window.isSecureContext) {
      setError(
        'Live location requires HTTPS on production hosting. Open this app from a secure site to use navigation.',
      )
      setStatus('error')
      modeRef.current = 'error'
      return undefined
    }

    if (!navigator.geolocation) {
      setError(
        'Geolocation is not supported by this browser.',
      )
      setStatus('error')
      modeRef.current = 'error'
      return undefined
    }

    modeRef.current = 'gps'
    startWatch(HIGH_ACCURACY_OPTIONS, 'gps')

    return clearWatch
  }, [clearWatch, startWatch])

  const recenterAvailable = !!position

  return {
    position,
    accuracy,
    error,
    status,
    source,
    recenterAvailable,
  }
}
