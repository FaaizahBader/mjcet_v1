/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { smoothCoordinate } from '../lib/geo'

const HIGH_ACCURACY_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
}

const SMOOTHING_ALPHA = 0.35
const MAX_ACCEPTED_ACCURACY_M = 90

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
  const smoothRef = useRef(null)
  const modeRef = useRef('gps')

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const applyPosition = useCallback((nextPosition) => {
    const nextAccuracy = nextPosition.accuracy ?? Infinity

    if (nextAccuracy > MAX_ACCEPTED_ACCURACY_M) {
      setAccuracy(nextAccuracy)
      setSource(nextPosition.source)
      setStatus('pending')

      if (!smoothRef.current) {
        setError(
          `Waiting for a more accurate GPS fix. Current accuracy is about ${Math.round(nextAccuracy)} meters.`,
        )
      }
      return
    }

    const smoothed = smoothCoordinate(
      smoothRef.current,
      nextPosition.coords,
      SMOOTHING_ALPHA,
    )
    smoothRef.current = smoothed
    setPosition(smoothed)
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
