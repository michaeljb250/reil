'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as turf from '@turf/turf'

type PopulationArea = {
  code: string
  name: string
  lat: number | string
  lng: number | string
  population: number | string
}

type MotorwayPoint = {
  code: string
  name: string
  lat: number | string
  lng: number | string
  road: string
  junction: string
  corridor: string
  nation: string
  region: string
  strategic: string
  freight_relevance: string
}

type MarketRow = {
  region: string
  vacancy_rate_current_pct?: number
  vacancy_rate?: number
  vacancy_rate_current_rank?: number
  avg_rent_psf?: number
  rent_trend?: string
  market_type?: string
  economic_growth_1y_pct?: number
  economic_growth_1y_rank?: number
  economic_growth_5y_cagr_proxy_pct?: number
  economic_growth_5y_cagr_proxy_rank?: number
  vacancy_change_1y_pp?: number
  vacancy_change_1y_rank?: number
  vacancy_change_5y_proxy_pp?: number
  vacancy_change_5y_proxy_rank?: number
  rental_change_1y_pct?: number
  rental_change_1y_rank?: number
  rental_change_5y_forecast_pct?: number
  rental_change_5y_forecast_rank?: number
  foreign_investment_last_year_projects?: number
  foreign_investment_last_year_rank?: number
}

const freightHubs = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'dover', name: 'Port of Dover', category: 'port', subtype: 'ro_ro', region: 'South East' },
      geometry: { type: 'Point', coordinates: [1.313, 51.129] }
    },
    {
      type: 'Feature',
      properties: { id: 'felixstowe', name: 'Port of Felixstowe', category: 'port', subtype: 'container', region: 'East of England' },
      geometry: { type: 'Point', coordinates: [1.311, 51.955] }
    },
    {
      type: 'Feature',
      properties: { id: 'southampton', name: 'Port of Southampton', category: 'port', subtype: 'container', region: 'South East' },
      geometry: { type: 'Point', coordinates: [-1.404, 50.899] }
    },
    {
      type: 'Feature',
      properties: { id: 'london_gateway', name: 'London Gateway', category: 'port', subtype: 'deep_sea', region: 'Greater London' },
      geometry: { type: 'Point', coordinates: [0.484, 51.503] }
    },
    {
      type: 'Feature',
      properties: { id: 'tilbury', name: 'Port of Tilbury', category: 'port', subtype: 'mixed', region: 'Greater London' },
      geometry: { type: 'Point', coordinates: [0.355, 51.462] }
    },
    {
      type: 'Feature',
      properties: { id: 'liverpool', name: 'Port of Liverpool', category: 'port', subtype: 'container', region: 'North West' },
      geometry: { type: 'Point', coordinates: [-3.007, 53.445] }
    },
    {
      type: 'Feature',
      properties: { id: 'hull', name: 'Port of Hull', category: 'port', subtype: 'ro_ro', region: 'Yorkshire' },
      geometry: { type: 'Point', coordinates: [-0.327, 53.744] }
    },
    {
      type: 'Feature',
      properties: { id: 'immingham', name: 'Port of Immingham', category: 'port', subtype: 'bulk', region: 'Yorkshire' },
      geometry: { type: 'Point', coordinates: [-0.186, 53.617] }
    },
    {
      type: 'Feature',
      properties: { id: 'teesport', name: 'Teesport', category: 'port', subtype: 'bulk', region: 'North East' },
      geometry: { type: 'Point', coordinates: [-1.183, 54.616] }
    },
    {
      type: 'Feature',
      properties: { id: 'bristol', name: 'Port of Bristol (Avonmouth)', category: 'port', subtype: 'mixed', region: 'South West' },
      geometry: { type: 'Point', coordinates: [-2.699, 51.504] }
    },
    {
      type: 'Feature',
      properties: { id: 'grangemouth', name: 'Port of Grangemouth', category: 'port', subtype: 'container', region: 'Scotland' },
      geometry: { type: 'Point', coordinates: [-3.718, 56.011] }
    },
    {
      type: 'Feature',
      properties: { id: 'heathrow', name: 'Heathrow Airport', category: 'airport', subtype: 'cargo_hub', region: 'Greater London' },
      geometry: { type: 'Point', coordinates: [-0.4543, 51.47] }
    },
    {
      type: 'Feature',
      properties: { id: 'east_midlands_airport', name: 'East Midlands Airport', category: 'airport', subtype: 'cargo_hub', region: 'East Midlands' },
      geometry: { type: 'Point', coordinates: [-1.328, 52.831] }
    },
    {
      type: 'Feature',
      properties: { id: 'stansted', name: 'London Stansted Airport', category: 'airport', subtype: 'cargo_hub', region: 'East of England' },
      geometry: { type: 'Point', coordinates: [0.235, 51.885] }
    },
    {
      type: 'Feature',
      properties: { id: 'luton', name: 'London Luton Airport', category: 'airport', subtype: 'cargo_hub', region: 'East of England' },
      geometry: { type: 'Point', coordinates: [-0.3683, 51.8747] }
    },
    {
      type: 'Feature',
      properties: { id: 'manchester_airport', name: 'Manchester Airport', category: 'airport', subtype: 'cargo_hub', region: 'North West' },
      geometry: { type: 'Point', coordinates: [-2.275, 53.353] }
    },
    {
      type: 'Feature',
      properties: { id: 'dirft', name: 'DIRFT (Daventry)', category: 'rail_terminal', subtype: 'srfi', region: 'East Midlands' },
      geometry: { type: 'Point', coordinates: [-1.178, 52.272] }
    },
    {
      type: 'Feature',
      properties: { id: 'east_midlands_gateway', name: 'East Midlands Gateway', category: 'rail_terminal', subtype: 'srfi', region: 'East Midlands' },
      geometry: { type: 'Point', coordinates: [-1.327, 52.831] }
    },
    {
      type: 'Feature',
      properties: { id: 'iport_doncaster', name: 'iPort Doncaster', category: 'rail_terminal', subtype: 'srfi', region: 'Yorkshire' },
      geometry: { type: 'Point', coordinates: [-1.123, 53.52] }
    },
    {
      type: 'Feature',
      properties: { id: 'hams_hall', name: 'Hams Hall Rail Freight Terminal', category: 'rail_terminal', subtype: 'intermodal', region: 'West Midlands' },
      geometry: { type: 'Point', coordinates: [-1.735, 52.519] }
    },
    {
      type: 'Feature',
      properties: { id: 'trafford_park_terminal', name: 'Trafford Park Rail Terminal', category: 'rail_terminal', subtype: 'intermodal', region: 'North West' },
      geometry: { type: 'Point', coordinates: [-2.333, 53.466] }
    }
  ]
} as GeoJSON.FeatureCollection<GeoJSON.Point>

const populationUrl =
  '/geopop.json'
const motorwayUrl =
  '/uk_motorway_access_network.json'
const marketUrl =
  '/uk_il_market_data.json'

export default function UkPopulationMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const siteMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const activePopupRef = useRef<mapboxgl.Popup | null>(null)

  const [postcode, setPostcode] = useState('')
  const [resultHtml, setResultHtml] = useState('Loading map...')
  const [isReady, setIsReady] = useState(false)

  const populationGeoJSONRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
  const motorwayGeoJSONRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
  const marketDataRef = useRef<MarketRow[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      setResultHtml('<span style="color:red;">Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</span>')
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mjb1000/cmo2vzo10008901s68c1yb3ty',
      center: [-2.5, 54.5],
      zoom: 5
    })

    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl())

    const ukBounds: [number, number][] = [
      [-8.8, 49.8],
      [2.1, 60.9]
    ]

    map.on('load', async () => {
      map.fitBounds(ukBounds as [[number, number], [number, number]], { padding: 20 })

      try {
        const [populationData, motorwayData, marketData] = await Promise.all([
          fetch(populationUrl).then((r) => {
            if (!r.ok) throw new Error(`Population data request failed: ${r.status}`)
            return r.json()
          }),
          fetch(motorwayUrl).then((r) => {
            if (!r.ok) throw new Error(`Motorway data request failed: ${r.status}`)
            return r.json()
          }),
          fetch(marketUrl).then((r) => {
            if (!r.ok) throw new Error(`Market data request failed: ${r.status}`)
            return r.json()
          }),
        ])

        populationGeoJSONRef.current = convertPopulationToGeoJSON(populationData)
        motorwayGeoJSONRef.current = convertMotorwaysToGeoJSON(motorwayData)
        marketDataRef.current = marketData

        addPopulationSourceAndLayer(map, populationGeoJSONRef.current)
        addFreightHubsSourceAndLayer(map)
        addMotorwayAccessSourceAndLayer(map, motorwayGeoJSONRef.current)

        setResultHtml('Data loaded. Search a postcode or click the map.')
        setIsReady(true)
      } catch (error) {
        console.error(error)
        setResultHtml('<span style="color:red;">Could not load data.</span>')
      }
    })

    map.on('click', async (e) => {
      if (!populationGeoJSONRef.current || !motorwayGeoJSONRef.current || !marketDataRef.current.length) return

      setResultHtml('Calculating drive-time reach for clicked location...')

      try {
        const lng = e.lngLat.lng
        const lat = e.lngLat.lat

        addOrMoveSiteMarker(map, lng, lat)
        const isochrones = await getDriveTimeIsochrones(lng, lat)
        drawIsochrones(map, isochrones)

        const populationAnalysis = calculateDriveTimePopulations(
          isochrones,
          populationGeoJSONRef.current
        )
        const freightAnalysis = calculateDriveTimeFreightHubs(isochrones, freightHubs)
        const motorwayAnalysis = await calculateNearestMotorwayAccess(lng, lat, motorwayGeoJSONRef.current)

        drawMotorwayRoute(map, motorwayAnalysis.routeGeometry)

        const html = buildResultsHtml({
          label: 'Clicked location',
          lng,
          lat,
          populationAnalysis,
          freightAnalysis,
          motorwayAnalysis,
          regionalMarket: null,
          regionName: null
        })

        setResultHtml(html.sidebar)
        showPopup(map, [lng, lat], html.popup)
        fitToIsochrones(map, isochrones)
      } catch (error) {
        console.error(error)
        setResultHtml('<span style="color:red;">Could not calculate drive-time reach for that location.</span>')
      }
    })

    return () => {
      activePopupRef.current?.remove()
      siteMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  async function handleSearch() {
    if (!mapRef.current) return

    const value = postcode.trim()
    if (!value) {
      setResultHtml('<span style="color:red;">Please enter a postcode.</span>')
      return
    }

    if (!populationGeoJSONRef.current || !motorwayGeoJSONRef.current || !marketDataRef.current.length) {
      setResultHtml('<span style="color:red;">Data is not ready yet.</span>')
      return
    }

    setResultHtml('Searching postcode and calculating drive-time reach...')

    try {
      const postcodeData = await lookupPostcode(value)
      const lng = postcodeData.longitude
      const lat = postcodeData.latitude

      addOrMoveSiteMarker(mapRef.current, lng, lat)

      const isochrones = await getDriveTimeIsochrones(lng, lat)
      drawIsochrones(mapRef.current, isochrones)

      const populationAnalysis = calculateDriveTimePopulations(
        isochrones,
        populationGeoJSONRef.current
      )
      const freightAnalysis = calculateDriveTimeFreightHubs(isochrones, freightHubs)
      const motorwayAnalysis = await calculateNearestMotorwayAccess(lng, lat, motorwayGeoJSONRef.current)

      drawMotorwayRoute(mapRef.current, motorwayAnalysis.routeGeometry)

      const regionName = getRegionFromPostcodeData(postcodeData)
      const regionalMarket = getMarketDataByRegion(regionName, marketDataRef.current)

      const html = buildResultsHtml({
        label: postcodeData.postcode,
        lng,
        lat,
        populationAnalysis,
        freightAnalysis,
        motorwayAnalysis,
        regionalMarket,
        regionName
      })

      setResultHtml(html.sidebar)
      showPopup(mapRef.current, [lng, lat], html.popup)
      fitToIsochrones(mapRef.current, isochrones)
    } catch (error) {
      console.error(error)
      setResultHtml(`<span style="color:red;">${error instanceof Error ? error.message : 'Search failed.'}</span>`)
    }
  }

  function showPopup(map: mapboxgl.Map, coordinates: [number, number], html: string) {
    activePopupRef.current?.remove()
    activePopupRef.current = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(map)
  }

  function addOrMoveSiteMarker(map: mapboxgl.Map, lng: number, lat: number) {
    if (siteMarkerRef.current) {
      siteMarkerRef.current.setLngLat([lng, lat])
      return
    }

    siteMarkerRef.current = new mapboxgl.Marker({ color: '#111827' })
      .setLngLat([lng, lat])
      .addTo(map)
  }

  return (
    <div className="map-page">
      <div className="search-panel">
        <input
          type="text"
          placeholder="Enter UK postcode"
          autoComplete="off"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
        />
        <button onClick={handleSearch} disabled={!isReady}>
          Search
        </button>
        <div id="result" dangerouslySetInnerHTML={{ __html: resultHtml }} />
      </div>

      <div ref={mapContainerRef} className="map-container" />
    </div>
  )
}

function convertPopulationToGeoJSON(data: PopulationArea[]) {
  return {
    type: 'FeatureCollection',
    features: data.map((area) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(area.lng), Number(area.lat)]
      },
      properties: {
        code: area.code,
        name: area.name,
        population: Number(area.population)
      }
    }))
  } as GeoJSON.FeatureCollection<GeoJSON.Point>
}

function convertMotorwaysToGeoJSON(data: MotorwayPoint[]) {
  return {
    type: 'FeatureCollection',
    features: data.map((point) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(point.lng), Number(point.lat)]
      },
      properties: {
        code: point.code,
        name: point.name,
        road: point.road,
        junction: point.junction,
        corridor: point.corridor,
        nation: point.nation,
        region: point.region,
        strategic: point.strategic,
        freight_relevance: point.freight_relevance
      }
    }))
  } as GeoJSON.FeatureCollection<GeoJSON.Point>
}

function addPopulationSourceAndLayer(
  map: mapboxgl.Map,
  populationGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  if (!map.getSource('population-data')) {
    map.addSource('population-data', {
      type: 'geojson',
      data: populationGeoJSON
    })
  }

  if (!map.getLayer('population-circles')) {
    map.addLayer({
      id: 'population-circles',
      type: 'circle',
      source: 'population-data',
      paint: {
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'population'],
          0, '#cfe8ff',
          10000, '#9ed0ff',
          25000, '#66b2ff',
          50000, '#3385ff',
          100000, '#005ce6',
          200000, '#003d99'
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'population'],
          0, 3,
          10000, 5,
          25000, 7,
          50000, 9,
          100000, 12,
          200000, 15
        ],
        'circle-opacity': 0.35,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5
      }
    })
  }
}

function addFreightHubsSourceAndLayer(map: mapboxgl.Map) {
  if (!map.getSource('freight-hubs')) {
    map.addSource('freight-hubs', {
      type: 'geojson',
      data: freightHubs
    })
  }

  if (!map.getLayer('freight-hubs-layer')) {
    map.addLayer({
      id: 'freight-hubs-layer',
      type: 'circle',
      source: 'freight-hubs',
      paint: {
        'circle-radius': [
          'match',
          ['get', 'category'],
          'port', 8,
          'airport', 7,
          'rail_terminal', 6,
          6
        ],
        'circle-color': [
          'match',
          ['get', 'category'],
          'port', '#d97706',
          'airport', '#dc2626',
          'rail_terminal', '#059669',
          '#6b7280'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95
      }
    })
  }
}

function addMotorwayAccessSourceAndLayer(
  map: mapboxgl.Map,
  motorwayGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  if (!map.getSource('motorway-access')) {
    map.addSource('motorway-access', {
      type: 'geojson',
      data: motorwayGeoJSON
    })
  }

  if (!map.getLayer('motorway-access-layer')) {
    map.addLayer({
      id: 'motorway-access-layer',
      type: 'circle',
      source: 'motorway-access',
      paint: {
        'circle-radius': 5,
        'circle-color': '#111827',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.2,
        'circle-opacity': 0.9
      }
    })
  }
}

async function lookupPostcode(postcode: string) {
  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
  )

  if (!response.ok) throw new Error('Postcode lookup failed.')

  const data = await response.json()
  if (!data.result) throw new Error('Postcode not found.')

  return data.result
}

async function getDriveTimeIsochrones(lng: number, lat: number) {
  const url =
    `https://api.mapbox.com/isochrone/v1/mapbox/driving/${lng},${lat}` +
    `?contours_minutes=30,60&polygons=true&denoise=1&generalize=100` +
    `&access_token=${mapboxgl.accessToken}`

  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not fetch drive-time areas from Mapbox.')
  return response.json()
}

function calculateDriveTimePopulations(
  isochronesGeoJSON: GeoJSON.FeatureCollection,
  populationPointsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  const results: Record<number, { totalPopulation: number }> = {}

  isochronesGeoJSON.features.forEach((feature: any) => {
    const minutes = Number(feature.properties.contour)
    const matchedPoints = turf.pointsWithinPolygon(populationPointsGeoJSON as any, feature as any)

    const totalPopulation = matchedPoints.features.reduce((sum: number, pointFeature: any) => {
      return sum + Number(pointFeature.properties.population || 0)
    }, 0)

    results[minutes] = { totalPopulation }
  })

  return results
}

function calculateDriveTimeFreightHubs(
  isochronesGeoJSON: GeoJSON.FeatureCollection,
  freightHubsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  const results: Record<number, { totalHubs: number; hubs: any[] }> = {}

  isochronesGeoJSON.features.forEach((feature: any) => {
    const minutes = Number(feature.properties.contour)
    const matchedHubs = turf.pointsWithinPolygon(freightHubsGeoJSON as any, feature as any)

    results[minutes] = {
      totalHubs: matchedHubs.features.length,
      hubs: matchedHubs.features.map((hub: any) => ({
        name: hub.properties.name,
        category: hub.properties.category,
        subtype: hub.properties.subtype,
        region: hub.properties.region
      }))
    }
  })

  return results
}

function findNearestMotorwayAccessPoint(
  lng: number,
  lat: number,
  motorwayGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  const sitePoint = turf.point([lng, lat])
  return turf.nearestPoint(sitePoint, motorwayGeoJSON as any)
}

async function getDriveRouteToMotorway(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number
) {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}` +
    `?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`

  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not fetch motorway access route.')

  const data = await response.json()
  if (!data.routes?.length) throw new Error('No route found to motorway access point.')

  return data.routes[0]
}

async function calculateNearestMotorwayAccess(
  lng: number,
  lat: number,
  motorwayGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  const nearest: any = findNearestMotorwayAccessPoint(lng, lat, motorwayGeoJSON)
  const [destLng, destLat] = nearest.geometry.coordinates
  const route = await getDriveRouteToMotorway(lng, lat, destLng, destLat)

  return {
    point: nearest,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    routeGeometry: route.geometry
  }
}

function getRegionFromPostcodeData(postcodeData: any) {
  const region = (postcodeData.region || '').toLowerCase()
  const country = (postcodeData.country || '').toLowerCase()

  if (country.includes('scotland')) return 'Scotland'
  if (country.includes('wales')) return 'Wales'
  if (region.includes('london')) return 'London'
  if (region.includes('south east')) return 'South East'
  if (region.includes('south west')) return 'South West'
  if (region.includes('east midlands') || region.includes('west midlands')) return 'Midlands'
  if (region.includes('north west')) return 'North West'
  if (region.includes('yorkshire') || region.includes('north east')) return 'Yorkshire & North East'

  return null
}

function getMarketDataByRegion(regionName: string | null, marketData: MarketRow[]) {
  if (!regionName) return null
  return marketData.find((item) => item.region === regionName) || null
}

function drawIsochrones(map: mapboxgl.Map, isochrones: any) {
  if (map.getLayer('isochrone-fill')) map.removeLayer('isochrone-fill')
  if (map.getLayer('isochrone-line')) map.removeLayer('isochrone-line')
  if (map.getSource('isochrones')) map.removeSource('isochrones')

  map.addSource('isochrones', {
    type: 'geojson',
    data: isochrones
  })

  map.addLayer({
    id: 'isochrone-fill',
    type: 'fill',
    source: 'isochrones',
    paint: {
      'fill-color': [
        'match',
        ['get', 'contour'],
        30, '#4f46e5',
        60, '#93c5fd',
        '#cccccc'
      ],
      'fill-opacity': 0.18
    }
  })

  map.addLayer({
    id: 'isochrone-line',
    type: 'line',
    source: 'isochrones',
    paint: {
      'line-color': [
        'match',
        ['get', 'contour'],
        30, '#3730a3',
        60, '#2563eb',
        '#666666'
      ],
      'line-width': 2
    }
  })
}

function drawMotorwayRoute(map: mapboxgl.Map, routeGeometry: GeoJSON.Geometry) {
  const routeGeoJSON = {
    type: 'Feature',
    geometry: routeGeometry,
    properties: {}
  } as GeoJSON.Feature

  if (map.getLayer('motorway-route-line')) map.removeLayer('motorway-route-line')
  if (map.getSource('motorway-route')) map.removeSource('motorway-route')

  map.addSource('motorway-route', {
    type: 'geojson',
    data: routeGeoJSON
  })

  map.addLayer({
    id: 'motorway-route-line',
    type: 'line',
    source: 'motorway-route',
    paint: {
      'line-color': '#111827',
      'line-width': 4,
      'line-opacity': 0.8
    }
  })
}

function fitToIsochrones(map: mapboxgl.Map, isochrones: any) {
  const bounds = new mapboxgl.LngLatBounds()

  isochrones.features.forEach((feature: any) => {
    const geometry = feature.geometry

    if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach((coord: [number, number]) => bounds.extend(coord))
    }

    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon: any) => {
        polygon[0].forEach((coord: [number, number]) => bounds.extend(coord))
      })
    }
  })

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 40 })
  }
}

function formatMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`
}

function formatMiles(meters: number) {
  return `${(meters / 1609.344).toFixed(1)} miles`
}

function buildResultsHtml({
  label,
  lng,
  lat,
  populationAnalysis,
  freightAnalysis,
  motorwayAnalysis,
  regionalMarket,
  regionName
}: any) {
  const pop30 = populationAnalysis[30]?.totalPopulation || 0
  const pop60 = populationAnalysis[60]?.totalPopulation || 0
  const hubs30 = freightAnalysis[30]?.totalHubs || 0
  const hubs60 = freightAnalysis[60]?.totalHubs || 0

  const hubList30 = (freightAnalysis[30]?.hubs || [])
    .map((hub: any) => `${hub.name} (${hub.category.replace('_', ' ')})`)
    .join('<br>')

  const hubList60 = (freightAnalysis[60]?.hubs || [])
    .map((hub: any) => `${hub.name} (${hub.category.replace('_', ' ')})`)
    .join('<br>')

  const motorwayName = motorwayAnalysis?.point?.properties?.name || 'N/A'
  const motorwayRoad = motorwayAnalysis?.point?.properties?.road || 'N/A'
  const motorwayJunction = motorwayAnalysis?.point?.properties?.junction || 'N/A'
  const motorwayCorridor = motorwayAnalysis?.point?.properties?.corridor || 'N/A'
  const motorwayTime = motorwayAnalysis ? formatMinutes(motorwayAnalysis.durationSeconds) : 'N/A'
  const motorwayDistance = motorwayAnalysis ? formatMiles(motorwayAnalysis.distanceMeters) : 'N/A'

  const vacancyRate = regionalMarket?.vacancy_rate_current_pct ?? regionalMarket?.vacancy_rate ?? 'N/A'
  const vacancyRateRank = regionalMarket?.vacancy_rate_current_rank ?? 'N/A'
  const avgRent = regionalMarket?.avg_rent_psf ?? 'N/A'
  const rentTrend = regionalMarket?.rent_trend ?? 'N/A'
  const marketType = regionalMarket?.market_type ?? 'N/A'
  const economicGrowth1y = regionalMarket?.economic_growth_1y_pct ?? 'N/A'
  const economicGrowth1yRank = regionalMarket?.economic_growth_1y_rank ?? 'N/A'
  const economicGrowth5y = regionalMarket?.economic_growth_5y_cagr_proxy_pct ?? 'N/A'
  const economicGrowth5yRank = regionalMarket?.economic_growth_5y_cagr_proxy_rank ?? 'N/A'
  const vacancyChange1y = regionalMarket?.vacancy_change_1y_pp ?? 'N/A'
  const vacancyChange1yRank = regionalMarket?.vacancy_change_1y_rank ?? 'N/A'
  const vacancyChange5y = regionalMarket?.vacancy_change_5y_proxy_pp ?? 'N/A'
  const vacancyChange5yRank = regionalMarket?.vacancy_change_5y_proxy_rank ?? 'N/A'
  const rentalChange1y = regionalMarket?.rental_change_1y_pct ?? 'N/A'
  const rentalChange1yRank = regionalMarket?.rental_change_1y_rank ?? 'N/A'
  const rentalChange5y = regionalMarket?.rental_change_5y_forecast_pct ?? 'N/A'
  const rentalChange5yRank = regionalMarket?.rental_change_5y_forecast_rank ?? 'N/A'
  const fdiLastYear = regionalMarket?.foreign_investment_last_year_projects ?? 'N/A'
  const fdiLastYearRank = regionalMarket?.foreign_investment_last_year_rank ?? 'N/A'

  return {
    sidebar: `
      <strong>Location:</strong> ${label}<br>
      <strong>Latitude:</strong> ${lat.toFixed(6)}<br>
      <strong>Longitude:</strong> ${lng.toFixed(6)}<br><br>

      <strong>Population within 30 min drive:</strong><br>
      ${pop30.toLocaleString()}<br><br>

      <strong>Population within 60 min drive:</strong><br>
      ${pop60.toLocaleString()}<br><br>

      <strong>Freight hubs within 30 min drive:</strong><br>
      ${hubs30}<br>
      ${hubList30 || 'None'}<br><br>

      <strong>Freight hubs within 60 min drive:</strong><br>
      ${hubs60}<br>
      ${hubList60 || 'None'}<br><br>

      <strong>Closest motorway corridor:</strong><br>
      ${motorwayName} (${motorwayRoad} J${motorwayJunction})<br>
      ${motorwayCorridor}<br><br>

      <strong>Time to access motorway:</strong><br>
      ${motorwayTime}<br>
      <strong>Distance to access motorway:</strong><br>
      ${motorwayDistance}<br><br>

      <strong>Regional I&amp;L market:</strong><br>
      Region: ${regionName || 'Unknown'}<br>
      Current vacancy rate: ${vacancyRate}${vacancyRate !== 'N/A' ? '%' : ''} (Rank ${vacancyRateRank})<br>
      Vacancy change 1Y: ${vacancyChange1y}${vacancyChange1y !== 'N/A' ? ' pp' : ''} (Rank ${vacancyChange1yRank})<br>
      Vacancy change 5Y: ${vacancyChange5y}${vacancyChange5y !== 'N/A' ? ' pp' : ''} (Rank ${vacancyChange5yRank})<br>
      Average rent: ${avgRent !== 'N/A' ? `£${avgRent}/sq ft` : 'N/A'}<br>
      Rental change 1Y: ${rentalChange1y}${rentalChange1y !== 'N/A' ? '%' : ''} (Rank ${rentalChange1yRank})<br>
      Rental change 5Y: ${rentalChange5y}${rentalChange5y !== 'N/A' ? '%' : ''} (Rank ${rentalChange5yRank})<br>
      Economic growth 1Y: ${economicGrowth1y}${economicGrowth1y !== 'N/A' ? '%' : ''} (Rank ${economicGrowth1yRank})<br>
      Economic growth 5Y: ${economicGrowth5y}${economicGrowth5y !== 'N/A' ? '%' : ''} (Rank ${economicGrowth5yRank})<br>
      Foreign investment last year: ${fdiLastYear} projects (Rank ${fdiLastYearRank})<br>
      Rent trend: ${rentTrend}<br>
      Market type: ${marketType}
    `,
    popup: `
      <strong>${label}</strong><br>
      30 min population: ${pop30.toLocaleString()}<br>
      60 min population: ${pop60.toLocaleString()}<br>
      30 min freight hubs: ${hubs30}<br>
      60 min freight hubs: ${hubs60}<br>
      Closest motorway: ${motorwayName}<br>
      Access time: ${motorwayTime}<br>
      Region: ${regionName || 'Unknown'}<br>
      Vacancy: ${vacancyRate}${vacancyRate !== 'N/A' ? '%' : ''}<br>
      Rent: ${avgRent !== 'N/A' ? `£${avgRent}/sq ft` : 'N/A'}
    `
  }
}
