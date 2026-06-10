import { useEffect, useState } from 'react'
import { parseCampusGeoJson } from '../lib/graph'

export function useCampusData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data/mjcet_campus.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Campus map not found')
        return response.json()
      })
      .then((geoJson) => {
        setData(parseCampusGeoJson(geoJson))
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load campus map data.')
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}
