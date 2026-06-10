import { useMap } from 'react-leaflet'

export default function RecenterButton({ position, onRecenter }) {
  const map = useMap()

  const handleClick = () => {
    if (!position) return
    map.flyTo(position, Math.max(map.getZoom(), 18), { duration: 0.6 })
    onRecenter?.()
  }

  return (
    <button
      type="button"
      className="map-control recenter-button"
      onClick={handleClick}
      disabled={!position}
      aria-label="Recenter to my location"
      title="Recenter to my location"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
        <path
          fill="currentColor"
          d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06Z"
        />
      </svg>
    </button>
  )
}
