export default function LocationModeToggle({
  manualPickActive,
  usingManualLocation,
  gpsAvailable,
  onStartManualPick,
  onCancelManualPick,
  onResumeGps,
}) {
  if (usingManualLocation && gpsAvailable) {
    return (
      <button
        type="button"
        className="location-mode-toggle"
        onClick={onResumeGps}
        aria-pressed={false}
      >
        Use GPS location
      </button>
    )
  }

  if (manualPickActive) {
    return (
      <button
        type="button"
        className="location-mode-toggle location-mode-toggle-active"
        onClick={onCancelManualPick}
        aria-pressed={true}
      >
        Cancel manual pick
      </button>
    )
  }

  return (
    <button
      type="button"
      className="location-mode-toggle"
      onClick={onStartManualPick}
      aria-pressed={false}
    >
      Set location on map
    </button>
  )
}
