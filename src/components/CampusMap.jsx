import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Popup,
} from 'react-leaflet'
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
import MapClickHandler from './MapClickHandler'
import MapControls from './MapControls'

export default function CampusMap({
  position,
  positionLabel = 'You are here',
  accuracy,
  routeCoordinates,
  destination,
  walkwayPaths,
  manualMode,
  onManualSelect,
  onMapSelect,
  onOutOfBounds,
  onRecenter,
}) {
  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={CAMPUS_BOUNDS}
      maxBoundsViscosity={0.85}
      className={`campus-map${manualMode ? ' manual-mode' : ''}`}
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
      <RouteFitBounds
        routeCoordinates={routeCoordinates}
        position={position}
        destinationCoords={destination?.coords}
      />
      <MapClickHandler
        enabled={manualMode || !!onMapSelect}
        onSelect={manualMode ? onManualSelect : onMapSelect}
        onOutOfBounds={onOutOfBounds}
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

      {position && (
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
