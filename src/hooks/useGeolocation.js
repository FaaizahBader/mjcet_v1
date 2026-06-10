import { useCallback, useEffect, useRef, useState } from 'react'
import { smoothCoordinate } from '../lib/geo'

const HIGH_ACCURACY_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
}

const NETWORK_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 30000,
  timeout: 15000,
}

const SMOOTHING_ALPHA = 0.35

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
  const fallbackTimerRef = useRef(null)
  const modeRef = useRef('gps')

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const applyPosition = useCallback((nextPosition) => {
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
          if (modeRef.current !== 'manual') {
            applyPosition(mapPosition(pos, sourceLabel))
          }
        },
        (err) => {
          if (modeRef.current === 'manual') return

          if (err.code === 1) {
            setError(
              'Location permission denied. Enable GPS in browser settings or tap the map to set your location manually.',
            )
            setStatus('manual')
            modeRef.current = 'manual'
            clearWatch()
            return
          }

          if (options.enableHighAccuracy && modeRef.current === 'gps') {
            setStatus('fallback')
            clearWatch()
            modeRef.current = 'network'
            startWatch(NETWORK_OPTIONS, 'network')
            return
          }

          setError(
            'Unable to get your location. Try moving outdoors or tap the map to set your location manually.',
          )
          setStatus('manual')
          modeRef.current = 'manual'
        },
        options,
      )
    },
    [applyPosition, clearWatch],
  )

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(
        'Geolocation is not supported. Tap the map to set your location manually.',
      )
      setStatus('manual')
      modeRef.current = 'manual'
      return undefined
    }

    modeRef.current = 'gps'
    startWatch(HIGH_ACCURACY_OPTIONS, 'gps')

    fallbackTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'gps' && !smoothRef.current) {
        clearWatch()
        modeRef.current = 'network'
        setStatus('fallback')
        startWatch(NETWORK_OPTIONS, 'network')
      }
    }, 12000)

    return clearWatch
  }, [clearWatch, startWatch])

  const setManualPosition = useCallback(
    (coords) => {
      modeRef.current = 'manual'
      clearWatch()
      smoothRef.current = coords
      setPosition(coords)
      setAccuracy(25)
      setSource('manual')
      setStatus('manual')
      setError(null)
    },
    [clearWatch],
  )

  const resumeGps = useCallback(() => {
    if (!navigator.geolocation) return false

    clearWatch()
    modeRef.current = 'gps'
    smoothRef.current = null
    setSource(null)
    setStatus('pending')
    setError(null)
    startWatch(HIGH_ACCURACY_OPTIONS, 'gps')

    fallbackTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'gps' && !smoothRef.current) {
        clearWatch()
        modeRef.current = 'network'
        setStatus('fallback')
        startWatch(NETWORK_OPTIONS, 'network')
      }
    }, 12000)

    return true
  }, [clearWatch, startWatch])

  const recenterAvailable = !!position

  return {
    position,
    accuracy,
    error,
    status,
    source,
    setManualPosition,
    resumeGps,
    recenterAvailable,
  }
}
