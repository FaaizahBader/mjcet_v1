import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Marker,
  Popup,
} from 'react-leaflet'
import L from 'leaflet'
import {
  CAMPUS_CENTER,
  CAMPUS_BOUNDS,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  TILE_MAX_NATIVE_ZOOM,
} from '../lib/constants'
import MapInitialCenter from './MapInitialCenter'
import RouteFitBounds from './RouteFitBounds'
import MapControls from './MapControls'
import FollowUserPosition from './FollowUserPosition'

function bearingBetween([lat1, lng1], [lat2, lng2]) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const toDegrees = (radians) => (radians * 180) / Math.PI
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const deltaLng = toRadians(lng2 - lng1)
  const y = Math.sin(deltaLng) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng)

  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function createNavigationArrowIcon(rotation) {
  return L.divIcon({
    className: 'user-arrow-marker',
    html: `<span class="user-arrow-marker-inner" style="transform: rotate(${rotation}deg)"></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

export default function CampusMap({
  position,
  positionLabel = 'You are here',
  accuracy,
  routeCoordinates,
  destination,
  walkwayPaths,
  onRecenter,
  followPosition = false,
  fitRoute = true,
  navigating = false,
}) {
  const arrowBearing =
    routeCoordinates?.length > 1
      ? bearingBetween(routeCoordinates[0], routeCoordinates[1])
      : 0
  const navigationArrowIcon = createNavigationArrowIcon(arrowBearing)

  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={CAMPUS_BOUNDS}
      maxBoundsViscosity={0.85}
      className="campus-map"
      zoomControl={false}
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      boxZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
        maxZoom={MAX_ZOOM}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapControls position={position} onRecenter={onRecenter} />
      <MapInitialCenter position={position} />
      <FollowUserPosition active={followPosition} position={position} />
      <RouteFitBounds
        routeCoordinates={routeCoordinates}
        position={position}
        destinationCoords={destination?.coords}
        enabled={fitRoute}
      />

      {walkwayPaths.map((path) => (
        <Polyline
          key={`${path.from}-${path.to}`}
          positions={path.coordinates}
          pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.55 }}
        />
      ))}

      {routeCoordinates?.length > 1 && (
        <Polyline
          positions={routeCoordinates}
          pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.92 }}
        />
      )}

      {position && accuracy > 0 && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.12,
            weight: 1,
            opacity: 0.45,
          }}
        />
      )}

      {position && navigating && (
        <Marker position={position} icon={navigationArrowIcon}>
          <Popup>{positionLabel}</Popup>
        </Marker>
      )}

      {position && !navigating && (
        <CircleMarker
          center={position}
          radius={10}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#2563eb',
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Popup>{positionLabel}</Popup>
        </CircleMarker>
      )}

      {destination && (
        <>
          <Circle
            center={destination.coords}
            radius={18}
            pathOptions={{
              color: '#dc2626',
              fillColor: '#ef4444',
              fillOpacity: 0.2,
              weight: 2,
              opacity: 0.85,
            }}
          />
          <CircleMarker
            center={destination.coords}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#dc2626',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>{destination.label}</Popup>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  )
}
