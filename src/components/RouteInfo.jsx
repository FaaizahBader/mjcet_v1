export default function RouteInfo({ summary, directions, destinationLabel }) {
  if (!summary && !directions?.length) return null

  return (
    <aside className="route-info" aria-label="Route details">
      {destinationLabel && (
        <p className="route-info-destination">To: {destinationLabel}</p>
      )}
      {summary && <p className="route-info-summary">{summary}</p>}
      {directions?.length > 0 && (
        <ol className="route-directions">
          {directions.slice(0, 5).map((step, index) => (
            <li key={`${step.text}-${index}`}>
              {step.text}
              {step.distanceM > 0 && (
                <span className="route-step-distance">
                  {' '}
                  ({Math.round(step.distanceM)} m)
                </span>
              )}
            </li>
          ))}
          {directions.length > 5 && (
            <li className="route-more">+{directions.length - 5} more steps</li>
          )}
        </ol>
      )}
    </aside>
  )
}
