/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CampusMap from './components/CampusMap'
import DestinationSearch from './components/DestinationSearch'
import VoiceButton from './components/VoiceButton'
import RouteInfo from './components/RouteInfo'
import LocationModeToggle from './components/LocationModeToggle'
import { useCampusData } from './hooks/useCampusData'
import { useGeolocation } from './hooks/useGeolocation'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { createDestinationMatcher } from './lib/destinations'
import { haversineDistance } from './lib/geo'
import { findNearestNodeId } from './lib/graph'
import {
  announceArrival,
  announceInstruction,
  announceNavigationStart,
  announceNotFound,
  announceReroute,
  confirmNavigation,
} from './lib/speech'
import { findShortestPath } from './lib/pathfinding'
import {
  ARRIVAL_RADIUS_M,
  NAVIGATION_STATES,
  REROUTE_THRESHOLD_M,
  buildRouteProgress,
  buildTurnByTurnSteps,
  calculateRouteDistance,
  estimateWalkSeconds,
  formatDistance,
  formatDuration,
  formatEta,
  getActiveStep,
  getDestinationBuilding,
} from './lib/navigation'
import './App.css'

function createManualDestination(coords) {
  return {
    id: `manual-${coords[0].toFixed(6)}-${coords[1].toFixed(6)}`,
    label: 'Selected Map Point',
    coords,
    isManual: true,
  }
}

function App() {
  const { data: campusData, loading, error: campusError } = useCampusData()
  const {
    position,
    accuracy,
    error: locationError,
    status: locationStatus,
    source: locationSource,
    setManualPosition,
    resumeGps,
  } = useGeolocation()

  const [destination, setDestination] = useState(null)
  const [routePlan, setRoutePlan] = useState(null)
  const [routeProgress, setRouteProgress] = useState(null)
  const [navigationState, setNavigationState] = useState(NAVIGATION_STATES.IDLE)
  const [navMessage, setNavMessage] = useState('')
  const [manualPickActive, setManualPickActive] = useState(false)
  const spokenStepRef = useRef(null)
  const routeVersionRef = useRef(0)

  const gpsUnavailable = locationStatus === 'manual' || !!locationError
  const usingManualLocation = locationSource === 'manual'
  const gpsAvailable = typeof navigator !== 'undefined' && !!navigator.geolocation
  const pickLocationEnabled = gpsUnavailable || manualPickActive

  const matchDestination = useMemo(
    () =>
      campusData
        ? createDestinationMatcher(campusData.destinations)
        : () => null,
    [campusData],
  )

  const buildRoutePlan = useCallback(
    (selectedDestination, startPosition) => {
      if (!campusData || !startPosition) return null

      const startId = findNearestNodeId(startPosition, campusData.nodes)
      const endId = campusData.nodes.has(selectedDestination.id)
        ? selectedDestination.id
        : findNearestNodeId(selectedDestination.coords, campusData.nodes)

      const path = findShortestPath(
        startId,
        endId,
        campusData.nodes,
        campusData.adjacency,
      )

      if (!path) return null

      let routeCoordinates = selectedDestination.isManual
        ? [...path.routeCoordinates, selectedDestination.coords]
        : path.routeCoordinates

      if (routeCoordinates.length < 2) {
        routeCoordinates = [startPosition, selectedDestination.coords]
      }
      const totalDistance = calculateRouteDistance(routeCoordinates)

      return {
        version: routeVersionRef.current + 1,
        coordinates: routeCoordinates,
        totalDistance,
        walkingSeconds: estimateWalkSeconds(totalDistance),
        steps: buildTurnByTurnSteps(routeCoordinates, selectedDestination.label),
      }
    },
    [campusData],
  )

  const prepareDestination = useCallback(
    (selectedDestination, { speak = false, fromCoords = position } = {}) => {
      setDestination(selectedDestination)
      setRouteProgress(null)
      setNavigationState(NAVIGATION_STATES.DESTINATION_SELECTED)
      spokenStepRef.current = null

      if (!fromCoords) {
        setRoutePlan(null)
        setNavMessage(
          pickLocationEnabled
            ? 'Tap the map to set your location, then choose a destination.'
            : 'Waiting for your location before routing.',
        )
        return
      }

      const nextPlan = buildRoutePlan(selectedDestination, fromCoords)
      if (!nextPlan) {
        setRoutePlan(null)
        setNavMessage('No walking route found to that destination.')
        if (speak) announceNotFound()
        return
      }

      routeVersionRef.current = nextPlan.version
      setRoutePlan(nextPlan)
      setNavigationState(NAVIGATION_STATES.READY)
      setNavMessage(`Route ready to ${selectedDestination.label}.`)
      if (speak) confirmNavigation(selectedDestination.label)
    },
    [buildRoutePlan, pickLocationEnabled, position],
  )

  const rerouteFromCurrentPosition = useCallback(() => {
    if (!destination || !position) return

    setNavigationState(NAVIGATION_STATES.REROUTING)
    setNavMessage('Rerouting from your current location...')
    announceReroute()

    const nextPlan = buildRoutePlan(destination, position)
    if (!nextPlan) {
      setNavMessage('Unable to reroute from your current location.')
      setNavigationState(NAVIGATION_STATES.ACTIVE)
      return
    }

    routeVersionRef.current = nextPlan.version
    spokenStepRef.current = null
    setRoutePlan(nextPlan)
    setNavigationState(NAVIGATION_STATES.ACTIVE)
  }, [buildRoutePlan, destination, position])

  const handleDestinationSelect = useCallback(
    (selected) => {
      prepareDestination(selected)
    },
    [prepareDestination],
  )

  const handleMapDestinationSelect = useCallback(
    (coords) => {
      prepareDestination(createManualDestination(coords))
    },
    [prepareDestination],
  )

  const handleManualSelect = useCallback(
    (coords) => {
      setManualPosition(coords)
      setManualPickActive(false)

      if (destination) {
        prepareDestination(destination, { fromCoords: coords })
        setNavMessage(`Location updated. Route to ${destination.label}`)
      } else {
        setNavMessage('Location set. Select a destination to navigate.')
      }
    },
    [destination, prepareDestination, setManualPosition],
  )

  const handleOutOfBounds = useCallback(() => {
    setNavMessage('Tap inside the campus area to set your location.')
  }, [])

  const handleStartManualPick = useCallback(() => {
    setManualPickActive(true)
    setNavMessage('Tap the map to set your location.')
  }, [])

  const handleCancelManualPick = useCallback(() => {
    setManualPickActive(false)
    setNavMessage('')
  }, [])

  const handleResumeGps = useCallback(() => {
    if (resumeGps()) {
      setManualPickActive(false)
      setNavMessage('Resuming GPS location...')
    }
  }, [resumeGps])

  const handleStartRoute = useCallback(() => {
    if (!destination || !routePlan) return

    setNavigationState(NAVIGATION_STATES.ACTIVE)
    setNavMessage('')
    announceNavigationStart(destination.label)
  }, [destination, routePlan])

  const handleDone = useCallback(() => {
    setDestination(null)
    setRoutePlan(null)
    setRouteProgress(null)
    setNavigationState(NAVIGATION_STATES.IDLE)
    setNavMessage('')
    spokenStepRef.current = null
  }, [])

  const handleNavigateAgain = useCallback(() => {
    if (!destination) return
    prepareDestination(destination)
  }, [destination, prepareDestination])

  const handleVoiceResult = useCallback(
    (transcript) => {
      const matched = matchDestination(transcript)
      if (!matched) {
        setNavMessage('Destination not found.')
        announceNotFound()
        return
      }

      prepareDestination(matched, { speak: true })
    },
    [matchDestination, prepareDestination],
  )

  useEffect(() => {
    if (!position || !destination) return

    if (
      navigationState === NAVIGATION_STATES.DESTINATION_SELECTED ||
      navigationState === NAVIGATION_STATES.READY
    ) {
      const updatedPlan = buildRoutePlan(destination, position)
      if (updatedPlan) {
        routeVersionRef.current = updatedPlan.version
        setRoutePlan(updatedPlan)
        setNavigationState(NAVIGATION_STATES.READY)
      }
    }
  }, [buildRoutePlan, destination, navigationState, position])

  useEffect(() => {
    if (
      navigationState !== NAVIGATION_STATES.ACTIVE ||
      !position ||
      !routePlan
    ) {
      return
    }

    const progress = buildRouteProgress(position, routePlan.coordinates)
    if (!progress) return

    const distanceToDestination = haversineDistance(
      position,
      destination.coords,
    )

    if (distanceToDestination <= ARRIVAL_RADIUS_M) {
      setRouteProgress({
        ...progress,
        remainingCoordinates: [destination.coords],
        remainingDistance: 0,
        progressPercent: 100,
      })
      setNavigationState(NAVIGATION_STATES.REACHED)
      setNavMessage('')
      announceArrival(destination.label)
      if (navigator.vibrate) navigator.vibrate([80, 40, 80])
      return
    }

    if (progress.distanceFromRoute > REROUTE_THRESHOLD_M) {
      rerouteFromCurrentPosition()
      return
    }

    setRouteProgress(progress)
  }, [
    destination,
    navigationState,
    rerouteFromCurrentPosition,
    position,
    routePlan,
  ])

  const activeStep = useMemo(() => {
    if (!routePlan) return null
    const distanceAlong = routeProgress?.distanceAlong ?? 0
    return getActiveStep(routePlan.steps, distanceAlong)
  }, [routePlan, routeProgress])

  useEffect(() => {
    if (navigationState !== NAVIGATION_STATES.ACTIVE || !activeStep) return
    if (spokenStepRef.current === activeStep.id) return

    spokenStepRef.current = activeStep.id
    announceInstruction(activeStep.text)
  }, [activeStep, navigationState])

  const { listening, supported, startListening } =
    useSpeechRecognition(handleVoiceResult)

  const visibleRouteCoordinates =
    navigationState === NAVIGATION_STATES.ACTIVE
      ? routeProgress?.remainingCoordinates ?? routePlan?.coordinates
      : routePlan?.coordinates

  const remainingDistance =
    routeProgress?.remainingDistance ?? routePlan?.totalDistance ?? 0
  const remainingSeconds = estimateWalkSeconds(remainingDistance)
  const progressPercent =
    routeProgress?.progressPercent ??
    (navigationState === NAVIGATION_STATES.REACHED ? 100 : 0)
  const routeSummary = routePlan
    ? `${formatDistance(routePlan.totalDistance)} - ${formatDuration(
        routePlan.walkingSeconds,
      )}`
    : ''
  const routeDirections =
    routePlan?.steps.map((step) => ({
      text: step.text,
      distanceM: step.distance,
    })) ?? []

  if (loading) {
    return (
      <div className="app app-loading">
        <p className="status-banner" role="status">
          Loading campus map...
        </p>
      </div>
    )
  }

  if (campusError || !campusData) {
    return (
      <div className="app app-loading">
        <p className="status-banner" role="status">
          {campusError ?? 'Campus map unavailable.'}
        </p>
      </div>
    )
  }

  const locationHint = manualPickActive
    ? 'Tap anywhere on the campus map to set your location.'
    : locationStatus === 'pending'
      ? 'Getting your location...'
      : locationStatus === 'fallback'
        ? 'Using network location. For better accuracy, move outdoors.'
        : gpsUnavailable
          ? 'Tap the map to set your location.'
          : usingManualLocation
            ? 'Using manually selected location.'
            : ''

  const showStatusBanner = locationError || navMessage
  const showLocationHint = !locationError && locationHint && !navMessage

  return (
    <div className="app">
      <header className="app-header">
        <h1>MJCET Campus Navigation</h1>
      </header>

      <div className="controls">
        <DestinationSearch
          destinations={campusData.destinations}
          value={destination}
          onChange={handleDestinationSelect}
        />
        <VoiceButton
          listening={listening}
          supported={supported}
          onClick={startListening}
        />
      </div>

      <LocationModeToggle
        manualPickActive={manualPickActive}
        usingManualLocation={usingManualLocation}
        gpsAvailable={gpsAvailable}
        onStartManualPick={handleStartManualPick}
        onCancelManualPick={handleCancelManualPick}
        onResumeGps={handleResumeGps}
      />

      {routeSummary && (
        <RouteInfo
          summary={routeSummary}
          directions={routeDirections}
          destinationLabel={destination?.label}
        />
      )}

      {showStatusBanner && (
        <p className="status-banner" role="status">
          {locationError || navMessage}
        </p>
      )}

      {showLocationHint && (
        <p className="status-banner status-banner-muted" role="status">
          {locationHint}
        </p>
      )}

      <CampusMap
        position={position}
        positionLabel={
          usingManualLocation ? 'Pinned start location' : 'You are here'
        }
        accuracy={accuracy}
        routeCoordinates={visibleRouteCoordinates}
        destination={destination}
        walkwayPaths={campusData.paths}
        manualMode={pickLocationEnabled}
        onManualSelect={handleManualSelect}
        onMapSelect={handleMapDestinationSelect}
        onOutOfBounds={handleOutOfBounds}
      />

      {destination &&
        routePlan &&
        (navigationState === NAVIGATION_STATES.READY ||
          navigationState === NAVIGATION_STATES.DESTINATION_SELECTED) && (
          <section className="navigation-card" aria-live="polite">
            <div>
              <p className="card-eyebrow">Destination Selected</p>
              <h2>{destination.label}</h2>
              <p className="card-subtitle">
                {getDestinationBuilding(destination)}
              </p>
            </div>
            <div className="route-stats">
              <span>{formatDistance(routePlan.totalDistance)}</span>
              <span>{formatDuration(routePlan.walkingSeconds)}</span>
              <span>ETA {formatEta(routePlan.walkingSeconds)}</span>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={handleStartRoute}
            >
              Start Route
            </button>
          </section>
        )}

      {navigationState === NAVIGATION_STATES.ACTIVE && routePlan && (
        <section className="navigation-card guidance-card" aria-live="polite">
          <div className="instruction-row">
            <span className="instruction-arrow">{activeStep?.arrow ?? '^'}</span>
            <div>
              <p className="card-eyebrow">Now</p>
              <h2>{activeStep?.text ?? `Continue to ${destination.label}`}</h2>
            </div>
          </div>
          <div className="progress-track" aria-label="Route progress">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="route-stats">
            <span>{formatDistance(remainingDistance)} left</span>
            <span>{formatDuration(remainingSeconds)}</span>
            <span>{progressPercent}%</span>
          </div>
        </section>
      )}

      {navigationState === NAVIGATION_STATES.REROUTING && (
        <section className="navigation-card guidance-card" aria-live="polite">
          <p className="card-eyebrow">Rerouting</p>
          <h2>Finding the best walking path...</h2>
        </section>
      )}

      {navigationState === NAVIGATION_STATES.REACHED && destination && (
        <section className="navigation-card reached-card" aria-live="polite">
          <div className="success-icon" aria-hidden="true">
            OK
          </div>
          <div>
            <p className="card-eyebrow">Destination Reached</p>
            <h2>You have arrived at:</h2>
            <p className="arrival-destination">{destination.label}</p>
            <p className="card-subtitle">
              {getDestinationBuilding(destination)}
            </p>
          </div>
          <div className="arrival-actions">
            <button className="secondary-action" type="button" onClick={handleDone}>
              Done
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={handleNavigateAgain}
            >
              Navigate Again
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
