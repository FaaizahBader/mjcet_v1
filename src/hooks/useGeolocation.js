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
const MAX_JUMP_M = 55
const MIN_UPDATE_DISTANCE_M = 0.6

function createKalmanFilter(initialValue, initialAccuracy) {
  return {
    estimate: initialValue,
    error: Math.max(initialAccuracy, 8) ** 2,
  }
}

function updateKalmanFilter(filter, measurement, accuracy, deltaSeconds) {
  // Higher reported GPS accuracy gets more trust; elapsed time allows walking motion to catch up.
  const processNoise = Math.max(deltaSeconds, 0.2) * 0.000000000018
  const measurementNoise = Math.max(accuracy, 5) ** 2 * 0.00000000000001
  const predictedError = filter.error + processNoise
  const gain = predictedError / (predictedError + measurementNoise)

  return {
    estimate: filter.estimate + gain * (measurement - filter.estimate),
    error: (1 - gain) * predictedError,
  }
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
  const filteredRef = useRef(null)
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

    const filter = filteredRef.current
    const nextFilter = filter
      ? {
          lat: updateKalmanFilter(
            filter.lat,
            nextPosition.coords[0],
            nextAccuracy,
            deltaSeconds,
          ),
          lng: updateKalmanFilter(
            filter.lng,
            nextPosition.coords[1],
            nextAccuracy,
            deltaSeconds,
          ),
        }
      : {
          lat: createKalmanFilter(nextPosition.coords[0], nextAccuracy),
          lng: createKalmanFilter(nextPosition.coords[1], nextAccuracy),
        }

    const filteredCoords = [
      nextFilter.lat.estimate,
      nextFilter.lng.estimate,
    ]

    if (
      previous &&
      speed < 0.35 &&
      haversineDistance(previous.coords, filteredCoords) < MIN_UPDATE_DISTANCE_M
    ) {
      setAccuracy(nextAccuracy)
      setSource(nextPosition.source)
      return
    }

    filteredRef.current = nextFilter
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
