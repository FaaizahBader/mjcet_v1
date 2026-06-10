import { useMap } from 'react-leaflet'

export default function ZoomButtons() {
  const map = useMap()

  return (
    <div className="zoom-buttons" aria-label="Map zoom">
      <button
        type="button"
        className="map-control zoom-button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className="map-control zoom-button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>
    </div>
  )
}
