export default function IndoorMap({ indoorMap, route, roomNumber, onClose }) {
  if (!indoorMap || !route) return null

  const points = route.coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const destination = route.coordinates.at(-1)

  return (
    <section className="indoor-panel" aria-label="Indoor route">
      <div className="indoor-panel-header">
        <div>
          <p className="card-eyebrow">Indoor Navigation</p>
          <h2>{indoorMap.label}</h2>
          <p className="card-subtitle">Route to Room {roomNumber}</p>
        </div>
        <button
          type="button"
          className="secondary-action indoor-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="indoor-map-frame">
        <svg viewBox={indoorMap.viewBox} role="img" aria-label={`Indoor route to room ${roomNumber}`}>
          <image href={indoorMap.svgPath} x="0" y="0" width="249.55501" height="127.42333" />
          <polyline className="indoor-route-line" points={points} />
          <circle className="indoor-route-start" cx={route.coordinates[0].x} cy={route.coordinates[0].y} r="2.4" />
          {destination && (
            <circle className="indoor-route-destination" cx={destination.x} cy={destination.y} r="2.8" />
          )}
        </svg>
      </div>
    </section>
  )
}
