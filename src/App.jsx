/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CampusMap from './components/CampusMap'
import DestinationSearch from './components/DestinationSearch'
import IndoorMap from './components/IndoorMap'
import VoiceButton from './components/VoiceButton'
import { useCampusData } from './hooks/useCampusData'
import { useGeolocation } from './hooks/useGeolocation'
import { usePathSnapping } from './hooks/usePathSnapping'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { createDestinationMatcher } from './lib/destinations'
import { haversineDistance } from './lib/geo'
import { findNearestNodeId } from './lib/graph'
import {
  announceArrival,
  announceInstruction,
  announceInstructionSequence,
  announceNavigationStart,
  announceNotFound,
  announceReroute,
  confirmNavigation,
  stopSpeech,
} from './lib/speech'
import { findShortestPath } from './lib/pathfinding'
import { getIndoorMap } from './lib/indoorMaps'
import {
  buildIndoorDirections,
  findIndoorShortestPath,
} from './lib/indoorRouting'
import {
  canPromptForIndoor,
  createIndoorRequest,
  getBlockFromDestination,
  isIndoorDestinationInput,
  isRoomNumberInput,
} from './lib/navigationController'
import {
  ARRIVAL_RADIUS_M,
  ARRIVAL_REMAINING_ROUTE_M,
  NAVIGATION_STATES,
  REROUTE_THRESHOLD_M,
  TURN_PREVIEW_DISTANCE_M,
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

function App() {
  const { data: campusData, loading, error: campusError } = useCampusData()
  const {
    position,
    accuracy,
    error: locationError,
    status: locationStatus,
  } = useGeolocation()

  const [destination, setDestination] = useState(null)
  const [routePlan, setRoutePlan] = useState(null)
  const [routeProgress, setRouteProgress] = useState(null)
  const [navigationState, setNavigationState] = useState(NAVIGATION_STATES.IDLE)
  const [navMessage, setNavMessage] = useState('')
  const [pendingIndoorRequest, setPendingIndoorRequest] = useState(null)
  const [indoorPrompt, setIndoorPrompt] = useState(null)
  const [indoorRoomInput, setIndoorRoomInput] = useState('')
  const [indoorRoute, setIndoorRoute] = useState(null)
  const spokenStepRef = useRef(null)
  const previewStepRef = useRef(null)
  const lastRerouteAtRef = useRef(0)
  const routeDistanceAlongRef = useRef(0)
  const routeProgressUpdatedAtRef = useRef(null)
  const routeVersionRef = useRef(0)

  const matchDestination = useMemo(
    () =>
      campusData
        ? createDestinationMatcher(campusData.destinations)
        : () => null,
    [campusData],
  )

  const routeSnapCoordinates =
    navigationState === NAVIGATION_STATES.ACTIVE
      ? routeProgress?.remainingCoordinates ?? routePlan?.coordinates
      : null
  const { position: navigationPosition } = usePathSnapping({
    position,
    routeCoordinates: routeSnapCoordinates,
    walkwayPaths: campusData?.paths,
    active: navigationState === NAVIGATION_STATES.ACTIVE,
  })

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

      let routeCoordinates = path.routeCoordinates

      if (
        routeCoordinates.length > 0 &&
        haversineDistance(startPosition, routeCoordinates[0]) > 2
      ) {
        routeCoordinates = [startPosition, ...routeCoordinates]
      }

      if (
        routeCoordinates.length > 0 &&
        haversineDistance(
          routeCoordinates[routeCoordinates.length - 1],
          selectedDestination.coords,
        ) > 2
      ) {
        routeCoordinates = [...routeCoordinates, selectedDestination.coords]
      }

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

  const buildIndoorRoute = useCallback((request) => {
    const indoorMap = getIndoorMap(request.block, request.floor)
    if (!indoorMap) {
      return {
        ok: false,
        error: `Indoor navigation for Block ${request.block} is not available yet.`,
      }
    }

    const route = findIndoorShortestPath(
      indoorMap,
      indoorMap.entranceNodeId,
      request.roomNodeId,
    )

    if (!route) {
      return {
        ok: false,
        error: `No indoor route found to ${request.roomNumber}.`,
      }
    }

    return { ok: true, indoorMap, route }
  }, [])

  const prepareDestination = useCallback(
    (
      selectedDestination,
      {
        speak = false,
        fromCoords = navigationPosition,
        indoorRequest = null,
      } = {},
    ) => {
      setDestination(selectedDestination)
      setRouteProgress(null)
      setNavigationState(NAVIGATION_STATES.DESTINATION_SELECTED)
      setPendingIndoorRequest(indoorRequest)
      setIndoorPrompt(null)
      setIndoorRoute(null)
      spokenStepRef.current = null
      previewStepRef.current = null
      routeDistanceAlongRef.current = 0
      routeProgressUpdatedAtRef.current = null

      if (!fromCoords) {
        setRoutePlan(null)
        setNavMessage(
          'Waiting for your location before routing.',
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
      setNavMessage(
        indoorRequest
          ? `Outdoor route ready to ${selectedDestination.label}. Indoor route to ${indoorRequest.roomNumber} will start when you arrive.`
          : `Route ready to ${selectedDestination.label}.`,
      )
      if (speak) confirmNavigation(selectedDestination.label)
    },
    [buildRoutePlan, navigationPosition],
  )

  const rerouteFromCurrentPosition = useCallback(() => {
    if (!destination || !navigationPosition) return

    setNavigationState(NAVIGATION_STATES.REROUTING)
    setNavMessage('Rerouting from your current location...')
    announceReroute()

    const nextPlan = buildRoutePlan(destination, navigationPosition)
    if (!nextPlan) {
      setNavMessage('Unable to reroute from your current location.')
      setNavigationState(NAVIGATION_STATES.ACTIVE)
      return
    }

    routeVersionRef.current = nextPlan.version
    spokenStepRef.current = null
    previewStepRef.current = null
    lastRerouteAtRef.current = Date.now()
    routeDistanceAlongRef.current = 0
    routeProgressUpdatedAtRef.current = null
    setRoutePlan(nextPlan)
    setNavigationState(NAVIGATION_STATES.ACTIVE)
  }, [buildRoutePlan, destination, navigationPosition])

  const handleDestinationSelect = useCallback(
    (selected) => {
      prepareDestination(selected)
    },
    [prepareDestination],
  )

  const handleRawDestinationSubmit = useCallback(
    (input) => {
      if (!campusData) return

      if (!isIndoorDestinationInput(input)) {
        const matched = matchDestination(input)
        if (matched) {
          prepareDestination(matched)
          return
        }

        setNavMessage('Destination not found.')
        return
      }

      const indoorRequest = createIndoorRequest(input)
      if (!indoorRequest.ok) {
        setNavMessage(indoorRequest.error)
        if (indoorRequest.unavailableFloor) announceNotFound()
        return
      }

      const blockDestination = campusData.destinations.find(
        (item) => item.id === indoorRequest.request.outdoorDestinationId,
      )

      if (!blockDestination) {
        setNavMessage(
          `Outdoor destination for Block ${indoorRequest.request.block} was not found.`,
        )
        return
      }

      prepareDestination(blockDestination, {
        indoorRequest: indoorRequest.request,
      })
    },
    [campusData, matchDestination, prepareDestination],
  )

  const handleStartRoute = useCallback(() => {
    if (!destination || !routePlan) return

    setNavigationState(NAVIGATION_STATES.ACTIVE)
    setNavMessage('')
    setRouteProgress(null)
    spokenStepRef.current = null
    previewStepRef.current = null
    routeDistanceAlongRef.current = 0
    routeProgressUpdatedAtRef.current = null
    announceNavigationStart(destination.label)
  }, [destination, routePlan])

  const handleDone = useCallback(() => {
    setDestination(null)
    setRoutePlan(null)
    setRouteProgress(null)
    setNavigationState(NAVIGATION_STATES.IDLE)
    setNavMessage('')
    setPendingIndoorRequest(null)
    setIndoorPrompt(null)
    setIndoorRoomInput('')
    setIndoorRoute(null)
    spokenStepRef.current = null
    previewStepRef.current = null
    routeDistanceAlongRef.current = 0
    routeProgressUpdatedAtRef.current = null
  }, [])

  const handleEndRoute = useCallback(() => {
    stopSpeech()
    setDestination(null)
    setRoutePlan(null)
    setRouteProgress(null)
    setNavigationState(NAVIGATION_STATES.IDLE)
    setPendingIndoorRequest(null)
    setIndoorPrompt(null)
    setIndoorRoomInput('')
    setIndoorRoute(null)
    spokenStepRef.current = null
    previewStepRef.current = null
    lastRerouteAtRef.current = 0
    routeDistanceAlongRef.current = 0
    routeProgressUpdatedAtRef.current = null
    setNavMessage('Route ended.')
  }, [])

  const handleNavigateAgain = useCallback(() => {
    if (!destination) return
    prepareDestination(destination)
  }, [destination, prepareDestination])

  const handleVoiceResult = useCallback(
    (transcript) => {
      if (isRoomNumberInput(transcript)) {
        handleRawDestinationSubmit(transcript)
        return
      }

      const matched = matchDestination(transcript)
      if (!matched) {
        handleRawDestinationSubmit(transcript)
        return
      }

      prepareDestination(matched, { speak: true })
    },
    [handleRawDestinationSubmit, matchDestination, prepareDestination],
  )

  const startIndoorNavigation = useCallback(
    (request) => {
      const indoorResult = buildIndoorRoute(request)
      if (!indoorResult.ok) {
        setNavMessage(indoorResult.error)
        return
      }

      setIndoorRoute({
        request,
        map: indoorResult.indoorMap,
        route: indoorResult.route,
        steps: buildIndoorDirections(
          indoorResult.route,
          request.roomLabel ?? request.roomNumber,
        ),
      })
      setIndoorPrompt(null)
      setIndoorRoomInput('')
      setPendingIndoorRequest(null)
      setNavMessage(`Indoor route ready to ${request.roomNumber}.`)
      announceInstructionSequence(
        buildIndoorDirections(
          indoorResult.route,
          request.roomLabel ?? request.roomNumber,
        ).map((step) => step.text),
      )
    },
    [buildIndoorRoute],
  )

  const handleIndoorPromptYes = useCallback(() => {
    setIndoorPrompt((current) =>
      current ? { ...current, askingRoom: true } : current,
    )
  }, [])

  const handleIndoorRoomSubmit = useCallback(() => {
    if (!indoorPrompt) return

    const indoorRequest = createIndoorRequest(indoorRoomInput)
    if (!indoorRequest.ok) {
      setNavMessage(indoorRequest.error)
      return
    }

    if (indoorRequest.request.block !== indoorPrompt.block) {
      setNavMessage(`Enter a ground-floor room or facility for Block ${indoorPrompt.block}.`)
      return
    }

    startIndoorNavigation(indoorRequest.request)
  }, [indoorPrompt, indoorRoomInput, startIndoorNavigation])

  useEffect(() => {
    if (!navigationPosition || !destination) return

    if (
      navigationState === NAVIGATION_STATES.DESTINATION_SELECTED ||
      navigationState === NAVIGATION_STATES.READY
    ) {
      const updatedPlan = buildRoutePlan(destination, navigationPosition)
      if (updatedPlan) {
        routeVersionRef.current = updatedPlan.version
        setRoutePlan(updatedPlan)
        setNavigationState(NAVIGATION_STATES.READY)
      }
    }
  }, [buildRoutePlan, destination, navigationPosition, navigationState])

  useEffect(() => {
    if (
      navigationState !== NAVIGATION_STATES.ACTIVE ||
      !navigationPosition ||
      !routePlan
    ) {
      return
    }

    const now = Date.now()
    const secondsSinceProgress =
      routeProgressUpdatedAtRef.current == null
        ? null
        : Math.max((now - routeProgressUpdatedAtRef.current) / 1000, 0.25)
    const maxDistanceAlong =
      secondsSinceProgress == null
        ? Infinity
        : routeDistanceAlongRef.current +
          Math.max(4, secondsSinceProgress * 2.4 + 1.5)

    const progress = buildRouteProgress(
      navigationPosition,
      routePlan.coordinates,
      routeDistanceAlongRef.current,
      maxDistanceAlong,
    )
    if (!progress) return

    const distanceToDestination = haversineDistance(
      navigationPosition,
      destination.coords,
    )

    if (
      progress.remainingDistance <= ARRIVAL_REMAINING_ROUTE_M &&
      distanceToDestination <= ARRIVAL_RADIUS_M
    ) {
      setRouteProgress({
        ...progress,
        remainingCoordinates: [destination.coords],
        remainingDistance: 0,
        progressPercent: 100,
      })
      routeDistanceAlongRef.current = routePlan.totalDistance
      setNavigationState(NAVIGATION_STATES.REACHED)
      setNavMessage('')
      announceArrival(destination.label)
      if (navigator.vibrate) navigator.vibrate([80, 40, 80])

      if (pendingIndoorRequest) {
        startIndoorNavigation(pendingIndoorRequest)
      } else if (canPromptForIndoor(destination)) {
        setIndoorPrompt({
          block: getBlockFromDestination(destination),
          blockLabel: destination.label,
          askingRoom: false,
        })
      }
      return
    }

    if (
      progress.distanceFromRoute > REROUTE_THRESHOLD_M &&
      Date.now() - lastRerouteAtRef.current > 9000
    ) {
      rerouteFromCurrentPosition()
      return
    }

    routeDistanceAlongRef.current = progress.distanceAlong
    routeProgressUpdatedAtRef.current = now
    setRouteProgress(progress)
  }, [
    destination,
    navigationState,
    pendingIndoorRequest,
    rerouteFromCurrentPosition,
    navigationPosition,
    routePlan,
    startIndoorNavigation,
  ])

  const activeStep = useMemo(() => {
    if (!routePlan) return null
    const distanceAlong = routeProgress?.distanceAlong ?? 0
    return getActiveStep(routePlan.steps, distanceAlong)
  }, [routePlan, routeProgress])

  const nextTurnStep = useMemo(() => {
    if (!routePlan || !activeStep || !routeProgress) return null

    const distanceToCurrentStepEnd =
      activeStep.endDistance - routeProgress.distanceAlong

    if (distanceToCurrentStepEnd > TURN_PREVIEW_DISTANCE_M) return null

    return routePlan.steps.find(
      (step) =>
        step.index === activeStep.index + 1 &&
        (step.kind === 'left' || step.kind === 'right'),
    )
  }, [activeStep, routePlan, routeProgress])

  useEffect(() => {
    if (navigationState !== NAVIGATION_STATES.ACTIVE || !activeStep) return
    if (spokenStepRef.current === activeStep.id) return

    spokenStepRef.current = activeStep.id
    announceInstruction(activeStep.text)
  }, [activeStep, navigationState])

  useEffect(() => {
    if (navigationState !== NAVIGATION_STATES.ACTIVE || !nextTurnStep) return
    if (previewStepRef.current === nextTurnStep.id) return

    previewStepRef.current = nextTurnStep.id
    announceInstruction(`In ${TURN_PREVIEW_DISTANCE_M} meters, ${nextTurnStep.text}`)
  }, [navigationState, nextTurnStep])

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

  const locationHint = locationStatus === 'pending'
      ? 'Getting your location...'
      : locationStatus === 'fallback'
        ? 'Using network location. For better accuracy, move outdoors.'
        : ''

  const showStatusBanner = locationError || navMessage
  const showLocationHint = !locationError && locationHint && !navMessage

  return (
    <div
      className={`app ${
        navigationState === NAVIGATION_STATES.ACTIVE ? 'app-navigation-active' : ''
      }`}
    >
      <header className="app-header">
        <h1>MJCET Campus Navigation</h1>
      </header>

      <div className="controls">
        <DestinationSearch
          destinations={campusData.destinations}
          value={destination}
          onChange={handleDestinationSelect}
          onSubmitQuery={handleRawDestinationSubmit}
        />
        <VoiceButton
          listening={listening}
          supported={supported}
          onClick={startListening}
        />
      </div>

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
        position={navigationPosition}
        positionLabel="You are here"
        accuracy={accuracy}
        routeCoordinates={visibleRouteCoordinates}
        destination={destination}
        walkwayPaths={campusData.paths}
        followPosition={navigationState === NAVIGATION_STATES.ACTIVE}
        fitRoute={navigationState !== NAVIGATION_STATES.ACTIVE}
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
          <button
            className="danger-action"
            type="button"
            onClick={handleEndRoute}
          >
            End Route
          </button>
        </section>
      )}

      {navigationState === NAVIGATION_STATES.REROUTING && (
        <section className="navigation-card guidance-card" aria-live="polite">
          <p className="card-eyebrow">Rerouting</p>
          <h2>Finding the best walking path...</h2>
        </section>
      )}

      {navigationState === NAVIGATION_STATES.REACHED &&
        destination &&
        !indoorPrompt &&
        !indoorRoute && (
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

      {indoorPrompt && !indoorRoute && (
        <section className="navigation-card indoor-prompt-card" aria-live="polite">
          {!indoorPrompt.askingRoom ? (
            <>
              <div>
                <p className="card-eyebrow">Indoor Navigation</p>
                <h2>You have reached {indoorPrompt.blockLabel}.</h2>
                <p className="card-subtitle">
                  Would you like to navigate indoors?
                </p>
              </div>
              <div className="arrival-actions">
                <button className="secondary-action" type="button" onClick={handleDone}>
                  No
                </button>
                <button
                  className="primary-action"
                  type="button"
                  onClick={handleIndoorPromptYes}
                >
                  Yes
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="card-eyebrow">Ground Floor Only</p>
                <h2>Enter room or facility</h2>
              </div>
              <input
                className="indoor-room-input"
                value={indoorRoomInput}
                onChange={(event) => setIndoorRoomInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleIndoorRoomSubmit()
                  }
                }}
                placeholder="Example: 1003 or Lift"
                aria-label="Indoor room or facility"
              />
              <button
                className="primary-action"
                type="button"
                onClick={handleIndoorRoomSubmit}
              >
                Show Indoor Route
              </button>
            </>
          )}
        </section>
      )}

      {indoorRoute && (
        <IndoorMap
          indoorMap={indoorRoute.map}
          route={indoorRoute.route}
          roomNumber={indoorRoute.request.roomNumber}
          steps={indoorRoute.steps}
          onClose={handleDone}
        />
      )}
    </div>
  )
}

export default App
