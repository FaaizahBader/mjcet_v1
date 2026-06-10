import RecenterButton from './RecenterButton'
import ZoomButtons from './ZoomButtons'

export default function MapControls({ position, onRecenter }) {
  return (
    <div className="map-controls">
      <RecenterButton position={position} onRecenter={onRecenter} />
      <ZoomButtons />
    </div>
  )
}
