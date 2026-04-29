'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

type PopulationArea = {
  code: string
  name: string
  lat: number | string
  lng: number | string
  population: number | string
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

type FreightHubProperties = {
  name?: string
  category?: string
  region?: string
  nation?: string
}

type InfrastructureProjectProperties = {
  id?: string
  name?: string
  category?: string
  subtype?: string
  stage?: string
  status_label?: string
  promoter?: string
  region?: string
  nation?: string
  corridor?: string
  expected_completion?: string
  description?: string
  source_name?: string
  source_key?: string
  last_checked?: string
  distance_km?: number
}

type MotorwayJunctionProperties = {
  fid?: number
  id?: string
  junction_number?: string
  name?: string
}

type NearestMotorwayAnalysis = {
  point: GeoJSON.Feature<GeoJSON.Point>
  name: string
  road: string
  junction: string
  corridor: string
  region: string
  nation: string
  distanceKm: number
}

type InfrastructureAnalysis = {
  nearest: GeoJSON.Feature<GeoJSON.Point> | null
  within25km: GeoJSON.Feature<GeoJSON.Point>[]
  within50km: GeoJSON.Feature<GeoJSON.Point>[]
}

const populationUrl = '/geopop.json'
const scotlandPopulationUrl = '/scoto.geojson'
const motorwayJunctionsUrl = '/motorjunctions.geojson'
const marketUrl = '/uk_il_market_data.json'
const freightHubsUrl = '/uk_freight_hubs.json'
const infrastructureProjectsUrl = '/uk_major_infrastructure_projects.json'

export default function UkPopulationMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const siteMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const activePopupRef = useRef<mapboxgl.Popup | null>(null)

  const [searchText, setSearchText] = useState('')
  const [resultHtml, setResultHtml] = useState('Loading map...')
  const [isReady, setIsReady] = useState(false)
  const [isKeyOpen, setIsKeyOpen] = useState(false)

  const populationGeoJSONRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
  const motorwayGeoJSONRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
  const freightHubsGeoJSONRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
  const infrastructureProjectsGeoJSONRef =
    useRef<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null)
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
      style: 'mapbox://styles/mjb1000/cmobx92pt002l01pe1cii23u7',
      center: [-2.5, 54.5],
      zoom: 5
    })

    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl())

    const ukBounds: [[number, number], [number, number]] = [
      [-8.8, 49.8],
      [2.1, 60.9]
    ]

    map.on('load', async () => {
      map.fitBounds(ukBounds, { padding: 20 })

      try {
        const [
          englandWalesPopulationData,
          scotlandPopulationData,
          motorwayData,
          marketData,
          freightHubsData,
          infrastructureProjectsData
        ] = await Promise.all([
          fetch(populationUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Population data request failed: ${r.status}`)
            return (await r.json()) as PopulationArea[]
          }),
          fetch(scotlandPopulationUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Scotland population request failed: ${r.status}`)
            return (await r.json()) as GeoJSON.FeatureCollection<GeoJSON.Point>
          }),
          fetch(motorwayJunctionsUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Motorway junctions request failed: ${r.status}`)
            return (await r.json()) as GeoJSON.FeatureCollection<GeoJSON.Point>
          }),
          fetch(marketUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Market data request failed: ${r.status}`)
            return (await r.json()) as MarketRow[]
          }),
          fetch(freightHubsUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Freight hubs data request failed: ${r.status}`)
            return (await r.json()) as GeoJSON.FeatureCollection<GeoJSON.Point>
          }),
          fetch(infrastructureProjectsUrl).then(async (r) => {
            if (!r.ok) throw new Error(`Infrastructure projects request failed: ${r.status}`)
            return (await r.json()) as GeoJSON.FeatureCollection<GeoJSON.Point>
          })
        ])

        const scotlandPopulationRows =
          convertScotlandGeoJSONToPopulationRows(scotlandPopulationData)

        const combinedPopulationRows = [
          ...englandWalesPopulationData,
          ...scotlandPopulationRows
        ]

        const populationGeoJSON = convertPopulationToGeoJSON(combinedPopulationRows)
        const motorwayGeoJSON = motorwayData
        const freightHubsGeoJSON = freightHubsData
        const infrastructureProjectsGeoJSON = infrastructureProjectsData

        populationGeoJSONRef.current = populationGeoJSON
        motorwayGeoJSONRef.current = motorwayGeoJSON
        freightHubsGeoJSONRef.current = freightHubsGeoJSON
        infrastructureProjectsGeoJSONRef.current = infrastructureProjectsGeoJSON
        marketDataRef.current = marketData

        addPopulationSourceAndLayer(map, populationGeoJSON)
        addMotorwayJunctionsSourceAndLayer(map, motorwayGeoJSON)
        addFreightHubsSourceAndLayer(map, freightHubsGeoJSON)
        addInfrastructureProjectsSourceAndLayer(map, infrastructureProjectsGeoJSON)

        map.on('click', 'motorway-junctions-layer', (e) => {
          const feature = e.features?.[0]
          if (!feature || feature.geometry.type !== 'Point') return

          const geometry = feature.geometry as GeoJSON.Point
          const coordinates = [...geometry.coordinates] as [number, number]
          const properties = (feature.properties || {}) as MotorwayJunctionProperties

          showMotorwayJunctionPopup(map, coordinates, properties)
          setResultHtml(buildMotorwayJunctionSidebarHtml(properties))
        })

        map.on('click', 'freight-hubs-layer', (e) => {
          const feature = e.features?.[0]
          if (!feature || feature.geometry.type !== 'Point') return

          const geometry = feature.geometry as GeoJSON.Point
          const coordinates = [...geometry.coordinates] as [number, number]
          const properties = (feature.properties || {}) as FreightHubProperties

          showFreightHubPopup(map, coordinates, properties)
          setResultHtml(buildFreightHubSidebarHtml(properties))
        })

        map.on('click', 'infrastructure-projects-layer', (e) => {
          const feature = e.features?.[0]
          if (!feature || feature.geometry.type !== 'Point') return

          const geometry = feature.geometry as GeoJSON.Point
          const coordinates = [...geometry.coordinates] as [number, number]
          const properties = (feature.properties || {}) as InfrastructureProjectProperties

          showInfrastructureProjectPopup(map, coordinates, properties)
          setResultHtml(buildInfrastructureProjectSidebarHtml(properties))
        })

        map.on('mouseenter', 'motorway-junctions-layer', () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', 'motorway-junctions-layer', () => {
          map.getCanvas().style.cursor = ''
        })

        map.on('mouseenter', 'freight-hubs-layer', () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', 'freight-hubs-layer', () => {
          map.getCanvas().style.cursor = ''
        })

        map.on('mouseenter', 'infrastructure-projects-layer', () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', 'infrastructure-projects-layer', () => {
          map.getCanvas().style.cursor = ''
        })

        setResultHtml(
          'Data loaded. Search an address or postcode, click the map, or click a motorway junction, freight hub, or infrastructure project.'
        )
        setIsReady(true)
      } catch (error) {
        console.error(error)
        setResultHtml('<span style="color:red;">Could not load data.</span>')
      }
    })

    map.on('click', async (e) => {
      const clickedMotorwayJunction = map.getLayer('motorway-junctions-layer')
        ? map.queryRenderedFeatures(e.point, {
            layers: ['motorway-junctions-layer']
          })
        : []
      if (clickedMotorwayJunction.length) return

      const clickedFreightHub = map.getLayer('freight-hubs-layer')
        ? map.queryRenderedFeatures(e.point, {
            layers: ['freight-hubs-layer']
          })
        : []
      if (clickedFreightHub.length) return

      const clickedInfrastructureProject = map.getLayer('infrastructure-projects-layer')
        ? map.queryRenderedFeatures(e.point, {
            layers: ['infrastructure-projects-layer']
          })
        : []
      if (clickedInfrastructureProject.length) return

      if (
        !populationGeoJSONRef.current ||
        !motorwayGeoJSONRef.current ||
        !freightHubsGeoJSONRef.current ||
        !infrastructureProjectsGeoJSONRef.current ||
        !marketDataRef.current.length
      ) {
        return
      }

      setResultHtml('Calculating drive-time reach for clicked location...')

      try {
        const lng = e.lngLat.lng
        const lat = e.lngLat.lat

        addOrMoveSiteMarker(map, lng, lat)
        clearMotorwayRoute(map)

        const [isochrones, searchResult] = await Promise.all([
          getDriveTimeIsochrones(lng, lat),
          reverseGeocodeWithMapbox(lng, lat)
        ])

        drawIsochrones(map, isochrones)

        const populationAnalysis = calculateDriveTimePopulations(
          isochrones,
          populationGeoJSONRef.current
        )

        const freightAnalysis = calculateDriveTimeFreightHubs(
          isochrones,
          freightHubsGeoJSONRef.current
        )

        const motorwayAnalysis = calculateNearestMotorwayAccess(
          lng,
          lat,
          motorwayGeoJSONRef.current
        )

        const infrastructureAnalysis = calculateNearbyInfrastructureProjects(
          lng,
          lat,
          infrastructureProjectsGeoJSONRef.current
        )

        const regionName =
          searchResult.regionName || getRegionFromCoordinates(lng, lat)

        const regionalMarket = getMarketDataByRegion(
          regionName,
          marketDataRef.current
        )

        const html = buildResultsHtml({
          label: searchResult.label || 'Clicked location',
          lng,
          lat,
          populationAnalysis,
          freightAnalysis,
          motorwayAnalysis,
          infrastructureAnalysis,
          regionalMarket,
          regionName
        })

        setResultHtml(html.sidebar)
        showPopup(map, [lng, lat], html.popup)
        fitToIsochrones(map, isochrones)
      } catch (error) {
        console.error(error)
        setResultHtml(
          '<span style="color:red;">Could not calculate drive-time reach for that location.</span>'
        )
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

    if (
      !populationGeoJSONRef.current ||
      !motorwayGeoJSONRef.current ||
      !freightHubsGeoJSONRef.current ||
      !infrastructureProjectsGeoJSONRef.current ||
      !marketDataRef.current.length
    ) {
      setResultHtml('<span style="color:red;">Data is not ready yet.</span>')
      return
    }

    const value = searchText.trim()
    if (!value) {
      setResultHtml('<span style="color:red;">Please enter an address or postcode.</span>')
      return
    }

    setResultHtml('Searching location and calculating drive-time reach...')

    try {
      const searchResult = await forwardGeocodeWithMapbox(value)
      const { lng, lat } = searchResult

      addOrMoveSiteMarker(mapRef.current, lng, lat)
      clearMotorwayRoute(mapRef.current)

      const isochrones = await getDriveTimeIsochrones(lng, lat)
      drawIsochrones(mapRef.current, isochrones)

      const populationAnalysis = calculateDriveTimePopulations(
        isochrones,
        populationGeoJSONRef.current
      )

      const freightAnalysis = calculateDriveTimeFreightHubs(
        isochrones,
        freightHubsGeoJSONRef.current
      )

      const motorwayAnalysis = calculateNearestMotorwayAccess(
        lng,
        lat,
        motorwayGeoJSONRef.current
      )

      const infrastructureAnalysis = calculateNearbyInfrastructureProjects(
        lng,
        lat,
        infrastructureProjectsGeoJSONRef.current
      )

      const regionName =
        searchResult.regionName || getRegionFromCoordinates(lng, lat)

      const regionalMarket = getMarketDataByRegion(
        regionName,
        marketDataRef.current
      )

      const html = buildResultsHtml({
        label: searchResult.label,
        lng,
        lat,
        populationAnalysis,
        freightAnalysis,
        motorwayAnalysis,
        infrastructureAnalysis,
        regionalMarket,
        regionName
      })

      setResultHtml(html.sidebar)
      showPopup(mapRef.current, [lng, lat], html.popup)
      fitToIsochrones(mapRef.current, isochrones)
    } catch (error) {
      console.error(error)
      setResultHtml(
        `<span style="color:red;">${
          error instanceof Error ? error.message : 'Search failed.'
        }</span>`
      )
    }
  }

  function showPopup(map: mapboxgl.Map, coordinates: [number, number], html: string) {
    activePopupRef.current?.remove()
    activePopupRef.current = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(map)
  }

  function showMotorwayJunctionPopup(
    map: mapboxgl.Map,
    coordinates: [number, number],
    properties: MotorwayJunctionProperties
  ) {
    const junction = properties?.junction_number || properties?.name || 'Unknown junction'
    const roadMatch = String(junction).match(/^([A-Z0-9()\/-]+)\s/)
    const road = roadMatch ? roadMatch[1] : 'N/A'

    activePopupRef.current?.remove()
    activePopupRef.current = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(`
        <div class="popup-card">
          <div class="popup-card__label">Motorway junction</div>
          <div class="popup-card__title">${junction}</div>

          <div class="popup-line">
            <span>Road</span>
            <strong>${road}</strong>
          </div>

          <div class="popup-line">
            <span>Junction</span>
            <strong>${junction}</strong>
          </div>
        </div>
      `)
      .addTo(map)
  }

  function showFreightHubPopup(
    map: mapboxgl.Map,
    coordinates: [number, number],
    properties: FreightHubProperties
  ) {
    const name = properties?.name || 'Unknown freight hub'
    const category = properties?.category || 'N/A'
    const region = properties?.region || 'N/A'
    const nation = properties?.nation || 'N/A'
    activePopupRef.current?.remove()
    activePopupRef.current = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(`
        <div class="popup-card">
          <div class="popup-card__label">Freight hub</div>
          <div class="popup-card__title">${name}</div>

          <div class="popup-line">
            <span>Category</span>
            <strong>${String(category).replace(/_/g, ' ')}</strong>
          </div>


          <div class="popup-line">
            <span>Region</span>
            <strong>${region}</strong>
          </div>

          <div class="popup-line">
            <span>Nation</span>
            <strong>${nation}</strong>
          </div>
        </div>
      `)
      .addTo(map)
  }

  function showInfrastructureProjectPopup(
    map: mapboxgl.Map,
    coordinates: [number, number],
    properties: InfrastructureProjectProperties
  ) {
    const name = properties?.name || 'Unknown project'
    const category = properties?.category || 'N/A'
    const subtype = properties?.subtype || 'N/A'


    activePopupRef.current?.remove()
    activePopupRef.current = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(`
        <div class="popup-card">
          <div class="popup-card__label">Infrastructure project</div>
          <div class="popup-card__title">${name}</div>

          <div class="popup-line">
            <span>Category</span>
            <strong>${String(category).replace(/_/g, ' ')}</strong>
          </div>

          <div class="popup-line">
            <span>Subtype</span>
            <strong>${String(subtype).replace(/_/g, ' ')}</strong>
          </div>
        </div>
      `)
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
    <header className="site-header">
      <div className="site-header__brand">
        UK Freight & Population Analysis
      </div>

      <button
        className="site-header__key-button"
        onClick={() => setIsKeyOpen((value) => !value)}
      >
        Map key & how it works
      </button>

      {isKeyOpen && (
        <div className="site-header__dropdown">
          <div className="key-section">
            <strong>Map key</strong>

            <div className="key-row">
              <span className="key-dot key-dot--population" />
              Population area points
            </div>

            <div className="key-row">
              <span className="key-dot key-dot--motorway" />
              Motorway junctions
            </div>

            <div className="key-row">
              <span className="key-dot key-dot--port" />
              Ports
            </div>

            <div className="key-row">
              <span className="key-dot key-dot--airport" />
              Airports
            </div>

            <div className="key-row">
              <span className="key-dot key-dot--rail" />
              Rail freight terminals
            </div>

            <div className="key-row">
              <span className="key-dot key-dot--infrastructure" />
              Major infrastructure projects
            </div>
          </div>

          <div className="key-section">
            <strong>How the site works</strong>
            <p>
              Search a UK address or postcode, or click anywhere on the map.
              The tool calculates 30 and 60 minute drive-time areas, estimated
              population reach, nearby freight hubs, nearest motorway access,
              nearby infrastructure projects, and regional I&amp;L market data.
            </p>
          </div>
        </div>
      )}
    </header>

    <div className="search-panel">
      <input
        type="text"
        placeholder="Enter UK address or postcode"
        autoComplete="off"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
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

function convertScotlandGeoJSONToPopulationRows(geojson: any): PopulationArea[] {
  if (!geojson || !Array.isArray(geojson.features)) {
    console.error('Invalid Scotland GeoJSON:', geojson)
    return []
  }

  return geojson.features.map((feature: any) => {
    const [lng, lat] = feature.geometry.coordinates
    const properties = feature.properties || {}

    return {
      code: String(properties.DataZone || ''),
      name: String(properties.Name || ''),
      lat: Number(lat),
      lng: Number(lng),
      population: Number(properties.TotPop2011 || 0)
    }
  })
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
          10000, 3,
          25000, 5,
          50000, 7,
          100000, 10,
          200000, 12
        ],
        'circle-opacity': 0.35,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5
      }
    })
  }
}

function addMotorwayJunctionsSourceAndLayer(
  map: mapboxgl.Map,
  motorwayGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  if (!map.getSource('motorway-junctions')) {
    map.addSource('motorway-junctions', {
      type: 'geojson',
      data: motorwayGeoJSON
    })
  }

  if (!map.getLayer('motorway-junctions-layer')) {
    map.addLayer({
      id: 'motorway-junctions-layer',
      type: 'circle',
      source: 'motorway-junctions',
      paint: {
        'circle-radius': 2,
        'circle-color': '#111827',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
        'circle-opacity': 0.9
      }
    })
  }
}

function addFreightHubsSourceAndLayer(
  map: mapboxgl.Map,
  freightHubsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  if (!map.getSource('freight-hubs')) {
    map.addSource('freight-hubs', {
      type: 'geojson',
      data: freightHubsGeoJSON
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
          'port', '#061f7a',
          'airport', '#64b9de',
          'rail_terminal', '#059669',
          '#6b7280'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95
      }
    })
  }

  if (!map.getLayer('freight-hubs-labels')) {
    map.addLayer({
      id: 'freight-hubs-labels',
      type: 'symbol',
      source: 'freight-hubs',
      minzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-size': 11,
        'text-offset': [0, -1.4],
        'text-anchor': 'bottom',
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(8, 14, 26, 0.95)',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.2
      }
    })
  }
}

function addInfrastructureProjectsSourceAndLayer(
  map: mapboxgl.Map,
  infrastructureProjectsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
) {
  if (!map.getSource('infrastructure-projects')) {
    map.addSource('infrastructure-projects', {
      type: 'geojson',
      data: infrastructureProjectsGeoJSON
    })
  }

  if (!map.getLayer('infrastructure-projects-layer')) {
    map.addLayer({
      id: 'infrastructure-projects-layer',
      type: 'circle',
      source: 'infrastructure-projects',
      paint: {
        'circle-radius': [
          'match',
          ['get', 'category'],
          'road', 5,
          'rail', 5,
          'energy', 5,
          6
        ],
        'circle-color': [
          'match',
          ['get', 'category'],
          'road', '#181616',
          'rail', '#181616',
          'energy', '#181616',
          '#6b7280'
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95
      }
    })
  }

  if (!map.getLayer('infrastructure-projects-labels')) {
    map.addLayer({
      id: 'infrastructure-projects-labels',
      type: 'symbol',
      source: 'infrastructure-projects',
      minzoom: 9,
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-size': 11,
        'text-offset': [0, -1.4],
        'text-anchor': 'bottom',
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(8, 14, 26, 0.95)',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.2
      }
    })
  }
}

function clearMotorwayRoute(map: mapboxgl.Map) {
  if (map.getLayer('motorway-route-line')) map.removeLayer('motorway-route-line')
  if (map.getSource('motorway-route')) map.removeSource('motorway-route')
}

async function forwardGeocodeWithMapbox(query: string) {
  const url =
    `https://api.mapbox.com/search/geocode/v6/forward` +
    `?q=${encodeURIComponent(query)}` +
    `&country=GB` +
    `&limit=1` +
    `&access_token=${mapboxgl.accessToken}`

  const response = await fetch(url)
  if (!response.ok) throw new Error('Address/postcode lookup failed.')

  const data = await response.json()
  const feature = data.features?.[0]
  if (!feature) throw new Error('Location not found.')

  const [lng, lat] = feature.geometry.coordinates

  return {
    label:
      feature.properties?.full_address ||
      feature.properties?.name ||
      feature.properties?.place_formatted ||
      query,
    lng,
    lat,
    regionName: extractRegionFromMapboxFeature(feature)
  }
}

async function reverseGeocodeWithMapbox(lng: number, lat: number) {
  const url =
    `https://api.mapbox.com/search/geocode/v6/reverse` +
    `?longitude=${encodeURIComponent(lng)}` +
    `&latitude=${encodeURIComponent(lat)}` +
    `&country=GB` +
    `&limit=1` +
    `&access_token=${mapboxgl.accessToken}`

  const response = await fetch(url)

  if (!response.ok) {
    return {
      label: 'Clicked location',
      lng,
      lat,
      regionName: null as string | null
    }
  }

  const data = await response.json()
  const feature = data.features?.[0]

  return {
    label:
      feature?.properties?.full_address ||
      feature?.properties?.name ||
      feature?.properties?.place_formatted ||
      'Clicked location',
    lng,
    lat,
    regionName: feature ? extractRegionFromMapboxFeature(feature) : null
  }
}

function extractRegionFromMapboxFeature(feature: any): string | null {
  const texts: string[] = []

  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) texts.push(value.trim())
  }

  push(feature?.properties?.context?.country?.name)
  push(feature?.properties?.context?.region?.name)
  push(feature?.properties?.context?.region?.region_code)
  push(feature?.properties?.context?.district?.name)
  push(feature?.properties?.context?.place?.name)
  push(feature?.properties?.place_formatted)
  push(feature?.properties?.full_address)
  push(feature?.properties?.name)

  const joined = texts.join(' | ').toLowerCase()

  if (joined.includes('scotland')) return 'Scotland'
  if (joined.includes('wales')) return 'Wales'
  if (joined.includes('northern ireland')) return 'Northern Ireland'

  if (joined.includes('london')) return 'London'
  if (joined.includes('south east')) return 'South East'
  if (joined.includes('south west')) return 'South West'
  if (joined.includes('east midlands')) return 'East Midlands'
  if (joined.includes('west midlands')) return 'West Midlands'
  if (joined.includes('north west')) return 'North West'
  if (joined.includes('north east')) return 'North East'
  if (joined.includes('yorkshire')) return 'Yorkshire'
  if (joined.includes('east of england')) return 'East of England'
  if (joined.includes('east anglia')) return 'East of England'

  return null
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
    const matchedPoints = turf.pointsWithinPolygon(
      populationPointsGeoJSON as any,
      feature as any
    )

    const totalPopulation = matchedPoints.features.reduce(
      (sum: number, pointFeature: any) => {
        return sum + Number(pointFeature.properties.population || 0)
      },
      0
    )

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
    const matchedHubs = turf.pointsWithinPolygon(
      freightHubsGeoJSON as any,
      feature as any
    )

    const uniqueHubs = Array.from(
      new Map(
        matchedHubs.features.map((hub: any) => [
          `${hub.properties?.name || ''}-${hub.properties?.category || ''}-${hub.properties?.subtype || ''}`,
          hub
        ])
      ).values()
    )

    results[minutes] = {
      totalHubs: uniqueHubs.length,
      hubs: uniqueHubs.map((hub: any) => ({
        name: hub.properties.name,
        category: hub.properties.category,
        subtype: hub.properties.subtype,
        region: hub.properties.region
      }))
    }
  })

  return results
}

function calculateNearestMotorwayAccess(
  lng: number,
  lat: number,
  motorwayGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
): NearestMotorwayAnalysis {
  const sitePoint = turf.point([lng, lat])
  const nearest = turf.nearestPoint(
    sitePoint,
    motorwayGeoJSON as any
  ) as GeoJSON.Feature<GeoJSON.Point>

  const distanceKm = turf.distance(sitePoint, nearest, { units: 'kilometers' })

  const junction = String(
    nearest.properties?.junction_number ||
      nearest.properties?.name ||
      'N/A'
  )

  const roadMatch = junction.match(/^([A-Z0-9()\/-]+)\s/)
  const road = roadMatch ? roadMatch[1] : 'N/A'

  return {
    point: nearest,
    name: junction,
    road,
    junction,
    corridor: 'N/A',
    region: 'N/A',
    nation: 'N/A',
    distanceKm
  }
}

function calculateNearbyInfrastructureProjects(
  lng: number,
  lat: number,
  infrastructureProjectsGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point>
): InfrastructureAnalysis {
  const sitePoint = turf.point([lng, lat])

  const projectsWithDistance = infrastructureProjectsGeoJSON.features
    .map((feature: any) => {
      const distanceKm = turf.distance(sitePoint, feature, { units: 'kilometers' })

      return {
        ...feature,
        properties: {
          ...(feature.properties || {}),
          distance_km: distanceKm
        }
      } as GeoJSON.Feature<GeoJSON.Point>
    })
    .sort((a: any, b: any) => {
      return Number(a.properties?.distance_km || 0) - Number(b.properties?.distance_km || 0)
    })

  const within25km = projectsWithDistance.filter(
    (feature: any) => Number(feature.properties?.distance_km || 0) <= 25
  )

  const within50km = projectsWithDistance.filter(
    (feature: any) => Number(feature.properties?.distance_km || 0) <= 50
  )

  return {
    nearest: projectsWithDistance[0] || null,
    within25km,
    within50km
  }
}

function getRegionFromCoordinates(lng: number, lat: number) {
  if (lat >= 55.0) return 'Scotland'
  if (lng <= -3.3 && lat >= 51.3 && lat <= 53.6) return 'Wales'

  if (lng >= -0.6 && lng <= 0.4 && lat >= 51.25 && lat <= 51.75) return 'London'
  if (lng >= -0.2 && lng <= 1.8 && lat >= 51.6 && lat <= 53.1) return 'East of England'
  if (lng >= -1.9 && lng <= -0.3 && lat >= 52.6 && lat <= 53.8) return 'East Midlands'
  if (lng >= -3.1 && lng <= -1.1 && lat >= 52.2 && lat <= 53.8) return 'West Midlands'

  if (lng >= -5.9 && lng <= -1.7 && lat >= 50.0 && lat <= 52.2) return 'South West'
  if (lng >= -2.7 && lng <= 1.2 && lat >= 50.7 && lat <= 51.6) return 'South East'

  if (lng >= -3.5 && lng <= -1.7 && lat >= 53.2 && lat <= 55.3) return 'North West'
  if (lng >= -2.2 && lng <= 0.2 && lat >= 53.3 && lat <= 54.6) return 'Yorkshire'
  if (lng >= -2.1 && lng <= -0.8 && lat >= 54.5 && lat <= 55.3) return 'North East'

  return null
}

function getMarketDataByRegion(regionName: string | null, marketData: MarketRow[]) {
  if (!regionName) return null

  const normalise = (value: string) =>
    value
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim()

  const aliases: Record<string, string[]> = {
    london: ['greater london'],
    'greater london': ['london'],
    yorkshire: ['yorkshire and humber', 'yorkshire & humber'],
    'north east': ['yorkshire and north east', 'yorkshire & north east'],
    'east of england': ['east', 'east anglia'],
    'east midlands': ['midlands'],
    'west midlands': ['midlands'],
    midlands: ['east midlands', 'west midlands']
  }

  const target = normalise(regionName)
  const candidates = [target, ...(aliases[target] || [])]

  const exact = marketData.find((item) =>
    candidates.includes(normalise(item.region))
  )
  if (exact) return exact

  return (
    marketData.find((item) => {
      const itemRegion = normalise(item.region)
      return candidates.some(
        (candidate) =>
          itemRegion.includes(candidate) || candidate.includes(itemRegion)
      )
    }) || null
  )
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

function fitToIsochrones(map: mapboxgl.Map, isochrones: any) {
  const bounds = new mapboxgl.LngLatBounds()

  isochrones.features.forEach((feature: any) => {
    const geometry = feature.geometry

    if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach((coord: [number, number]) => {
        bounds.extend(coord)
      })
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

function buildMotorwayJunctionSidebarHtml(properties: MotorwayJunctionProperties) {
  const junction = properties?.junction_number || properties?.name || 'Unknown junction'
  const roadMatch = String(junction).match(/^([A-Z0-9()\/-]+)\s/)
  const road = roadMatch ? roadMatch[1] : 'N/A'

  return `
    <div class="results-shell">
      <div class="hero-card">
        <div class="hero-card__label">Motorway junction</div>
        <div class="hero-card__title">${junction}</div>
        <div class="hero-card__meta">
          <span class="hero-chip">${road}</span>
        </div>
      </div>

      <div class="result-section">
        <div class="section-heading">Junction details</div>
        <div class="market-grid">
          <div class="data-tile">
            <span class="data-tile__label">Junction</span>
            <span class="data-tile__value">${junction}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Road</span>
            <span class="data-tile__value">${road}</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildFreightHubSidebarHtml(properties: FreightHubProperties) {
  const name = properties?.name || 'Unknown freight hub'
  const category = properties?.category || 'N/A'
  const region = properties?.region || 'N/A'
  const nation = properties?.nation || 'N/A'


  return `
    <div class="results-shell">
      <div class="hero-card">
        <div class="hero-card__label">Freight hub</div>
        <div class="hero-card__title">${name}</div>
        <div class="hero-card__meta">
          <span class="hero-chip">${String(category).replace(/_/g, ' ')}</span>
          <span class="hero-chip">${region}</span>
        </div>
      </div>

      <div class="result-section">
        <div class="section-heading">Freight hub details</div>
        <div class="market-grid">
          <div class="data-tile">
            <span class="data-tile__label">Name</span>
            <span class="data-tile__value">${name}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Category</span>
            <span class="data-tile__value">${String(category).replace(/_/g, ' ')}</span>
          </div>


          <div class="data-tile">
            <span class="data-tile__label">Region</span>
            <span class="data-tile__value">${region}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Nation</span>
            <span class="data-tile__value">${nation}</span>
          </div>


        </div>
      </div>
    </div>
  `
}

function buildInfrastructureProjectSidebarHtml(
  properties: InfrastructureProjectProperties
) {
  const name = properties?.name || 'Unknown project'
  const category = properties?.category || 'N/A'
  const subtype = properties?.subtype || 'N/A'
  const stage = properties?.stage || 'N/A'
  const statusLabel = properties?.status_label || 'N/A'
  const promoter = properties?.promoter || 'N/A'
  const region = properties?.region || 'N/A'
  const nation = properties?.nation || 'N/A'
  const corridor = properties?.corridor || 'N/A'
  const expectedCompletion = properties?.expected_completion || 'N/A'
  const description = properties?.description || 'No description available.'

  return `
    <div class="results-shell">
      <div class="hero-card">
        <div class="hero-card__label">Infrastructure project</div>
        <div class="hero-card__title">${name}</div>
        <div class="hero-card__meta">
          <span class="hero-chip">${String(category).replace(/_/g, ' ')}</span>
          <span class="hero-chip">${String(stage).replace(/_/g, ' ')}</span>
          <span class="hero-chip">${region}</span>
        </div>
      </div>

      <div class="result-section">
        <div class="section-heading">Project details</div>
        <div class="market-grid">
          <div class="data-tile">
            <span class="data-tile__label">Name</span>
            <span class="data-tile__value">${name}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Category</span>
            <span class="data-tile__value">${String(category).replace(/_/g, ' ')}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Subtype</span>
            <span class="data-tile__value">${String(subtype).replace(/_/g, ' ')}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Stage</span>
            <span class="data-tile__value">${String(stage).replace(/_/g, ' ')}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Status</span>
            <span class="data-tile__value">${statusLabel}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Promoter</span>
            <span class="data-tile__value">${promoter}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Region</span>
            <span class="data-tile__value">${region}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Nation</span>
            <span class="data-tile__value">${nation}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Corridor</span>
            <span class="data-tile__value">${corridor}</span>
          </div>

          <div class="data-tile">
            <span class="data-tile__label">Expected completion</span>
            <span class="data-tile__value">${expectedCompletion}</span>
          </div>
        </div>

        <div class="info-card" style="margin-top: 14px;">
          <div class="info-card__title">Description</div>
          <div class="info-card__sub">${description}</div>
        </div>
      </div>
    </div>
  `
}

function buildResultsHtml({
  label,
  lng,
  lat,
  populationAnalysis,
  freightAnalysis,
  motorwayAnalysis,
  infrastructureAnalysis,
  regionalMarket,
  regionName
}: {
  label: string
  lng: number
  lat: number
  populationAnalysis: any
  freightAnalysis: any
  motorwayAnalysis: NearestMotorwayAnalysis
  infrastructureAnalysis: InfrastructureAnalysis
  regionalMarket: MarketRow | null
  regionName: string | null
}) {
  const pop30 = populationAnalysis[30]?.totalPopulation || 0
  const pop60 = populationAnalysis[60]?.totalPopulation || 0
  const hubs30 = freightAnalysis[30]?.totalHubs || 0
  const hubs60 = freightAnalysis[60]?.totalHubs || 0

  const hubs30List = freightAnalysis[30]?.hubs || []
  const hubs60List = freightAnalysis[60]?.hubs || []

  const motorwayRoad = motorwayAnalysis.road || 'N/A'
  const motorwayJunction = motorwayAnalysis.junction || 'N/A'
  const motorwayDistance =
    typeof motorwayAnalysis.distanceKm === 'number'
      ? `${motorwayAnalysis.distanceKm.toFixed(1)} km`
      : 'N/A'

  const nearestProject = infrastructureAnalysis?.nearest || null
  const nearestProjectName = nearestProject?.properties?.name || 'None'
  const nearestProjectCategory = nearestProject?.properties?.category || 'N/A'
  const nearestProjectStage = nearestProject?.properties?.stage || 'N/A'
  const nearestProjectDistance = nearestProject?.properties?.distance_km
  const projectsWithin25km = infrastructureAnalysis?.within25km?.length || 0
  const projectsWithin50km = infrastructureAnalysis?.within50km?.length || 0

  const vacancyRate =
    regionalMarket?.vacancy_rate_current_pct ??
    regionalMarket?.vacancy_rate ??
    'N/A'
  const vacancyRateRank = regionalMarket?.vacancy_rate_current_rank ?? 'N/A'
  const avgRent = regionalMarket?.avg_rent_psf ?? 'N/A'
  const rentTrend = regionalMarket?.rent_trend ?? 'N/A'
  const marketType = regionalMarket?.market_type ?? 'N/A'
  const economicGrowth1y = regionalMarket?.economic_growth_1y_pct ?? 'N/A'
  const economicGrowth1yRank = regionalMarket?.economic_growth_1y_rank ?? 'N/A'
  const economicGrowth5y =
    regionalMarket?.economic_growth_5y_cagr_proxy_pct ?? 'N/A'
  const economicGrowth5yRank =
    regionalMarket?.economic_growth_5y_cagr_proxy_rank ?? 'N/A'
  const vacancyChange1y = regionalMarket?.vacancy_change_1y_pp ?? 'N/A'
  const vacancyChange1yRank = regionalMarket?.vacancy_change_1y_rank ?? 'N/A'
  const vacancyChange5y = regionalMarket?.vacancy_change_5y_proxy_pp ?? 'N/A'
  const vacancyChange5yRank =
    regionalMarket?.vacancy_change_5y_proxy_rank ?? 'N/A'
  const rentalChange1y = regionalMarket?.rental_change_1y_pct ?? 'N/A'
  const rentalChange1yRank = regionalMarket?.rental_change_1y_rank ?? 'N/A'
  const rentalChange5y =
    regionalMarket?.rental_change_5y_forecast_pct ?? 'N/A'
  const rentalChange5yRank =
    regionalMarket?.rental_change_5y_forecast_rank ?? 'N/A'
  const fdiLastYear =
    regionalMarket?.foreign_investment_last_year_projects ?? 'N/A'
  const fdiLastYearRank =
    regionalMarket?.foreign_investment_last_year_rank ?? 'N/A'

  return {
    sidebar: `
      <div class="results-shell">
        <div class="hero-card">
          <div class="hero-card__label">Selected location</div>
          <div class="hero-card__title">${label}</div>
          <div class="hero-card__meta">
            <span class="hero-chip">Lat ${lat.toFixed(6)}</span>
            <span class="hero-chip">Lng ${lng.toFixed(6)}</span>
            <span class="hero-chip">${regionName || 'Unknown region'}</span>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card metric-card--blue">
            <div class="metric-card__label">30 min population</div>
            <div class="metric-card__value">${pop30.toLocaleString()}</div>
          </div>

          <div class="metric-card metric-card--indigo">
            <div class="metric-card__label">60 min population</div>
            <div class="metric-card__value">${pop60.toLocaleString()}</div>
          </div>

          <div class="metric-card metric-card--amber">
            <div class="metric-card__label">30 min freight hubs</div>
            <div class="metric-card__value">${hubs30}</div>
          </div>

          <div class="metric-card metric-card--emerald">
            <div class="metric-card__label">60 min freight hubs</div>
            <div class="metric-card__value">${hubs60}</div>
          </div>
        </div>

        <div class="result-section">
          <div class="section-heading">Infrastructure nearby</div>
          <div class="market-grid">
            <div class="data-tile">
              <span class="data-tile__label">Within 25 km</span>
              <span class="data-tile__value">${projectsWithin25km}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Within 50 km</span>
              <span class="data-tile__value">${projectsWithin50km}</span>
            </div>

            <div class="data-tile data-tile--wide">
              <span class="data-tile__label">Nearest project</span>
              <span class="data-tile__value">${nearestProjectName}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Project category</span>
              <span class="data-tile__value">${String(nearestProjectCategory).replace(/_/g, ' ')}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Project stage</span>
              <span class="data-tile__value">${String(nearestProjectStage).replace(/_/g, ' ')}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Distance</span>
              <span class="data-tile__value">${
                typeof nearestProjectDistance === 'number'
                  ? `${nearestProjectDistance.toFixed(1)} km`
                  : 'N/A'
              }</span>
            </div>
          </div>
        </div>

        <div class="result-section">
          <div class="section-heading">Freight hubs within 30 minutes</div>
          <div class="pill-grid">
            ${
              hubs30List.length
                ? hubs30List
                    .map(
                      (hub: any) => `
                        <div class="hub-pill">
                          <span class="hub-pill__name">${hub.name}</span>
                          <span class="hub-pill__type">${String(hub.category).replace(/_/g, ' ')}</span>
                          <span class="hub-pill__meta">${hub.region}</span>
                        </div>
                      `
                    )
                    .join('')
                : `<span class="empty-state">None</span>`
            }
          </div>
        </div>

        <div class="result-section">
          <div class="section-heading">Freight hubs within 60 minutes</div>
          <div class="pill-grid">
            ${
              hubs60List.length
                ? hubs60List
                    .map(
                      (hub: any) => `
                        <div class="hub-pill">
                          <span class="hub-pill__name">${hub.name}</span>
                          <span class="hub-pill__type">${String(hub.category).replace(/_/g, ' ')}</span>
                          <span class="hub-pill__meta">${hub.region}</span>
                        </div>
                      `
                    )
                    .join('')
                : `<span class="empty-state">None</span>`
            }
          </div>
        </div>

        <div class="result-section">
          <div class="section-heading">Nearest motorway junction</div>
          <div class="info-card">
            <div class="info-card__title">${motorwayJunction}</div>
            <div class="info-card__sub">Road: ${motorwayRoad}</div>
            <div class="info-card__meta">Distance: ${motorwayDistance}</div>
          </div>
        </div>

        <div class="result-section">
          <div class="section-heading">Regional I&amp;L market</div>
          <div class="market-grid">
            <div class="data-tile">
              <span class="data-tile__label">Region</span>
              <span class="data-tile__value">${regionName || 'Unknown'}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Vacancy rate</span>
              <span class="data-tile__value">${vacancyRate}${
                vacancyRate !== 'N/A' ? '%' : ''
              }</span>
              <span class="data-tile__sub">Rank ${vacancyRateRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Vacancy change 1Y</span>
              <span class="data-tile__value">${vacancyChange1y}${
                vacancyChange1y !== 'N/A' ? ' pp' : ''
              }</span>
              <span class="data-tile__sub">Rank ${vacancyChange1yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Vacancy change 5Y</span>
              <span class="data-tile__value">${vacancyChange5y}${
                vacancyChange5y !== 'N/A' ? ' pp' : ''
              }</span>
              <span class="data-tile__sub">Rank ${vacancyChange5yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Average rent</span>
              <span class="data-tile__value">${
                avgRent !== 'N/A' ? `£${avgRent}/sq ft` : 'N/A'
              }</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Rental change 1Y</span>
              <span class="data-tile__value">${rentalChange1y}${
                rentalChange1y !== 'N/A' ? '%' : ''
              }</span>
              <span class="data-tile__sub">Rank ${rentalChange1yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Rental change 5Y</span>
              <span class="data-tile__value">${rentalChange5y}${
                rentalChange5y !== 'N/A' ? '%' : ''
              }</span>
              <span class="data-tile__sub">Rank ${rentalChange5yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Economic growth 1Y</span>
              <span class="data-tile__value">${economicGrowth1y}${
                economicGrowth1y !== 'N/A' ? '%' : ''
              }</span>
              <span class="data-tile__sub">Rank ${economicGrowth1yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Economic growth 5Y</span>
              <span class="data-tile__value">${economicGrowth5y}${
                economicGrowth5y !== 'N/A' ? '%' : ''
              }</span>
              <span class="data-tile__sub">Rank ${economicGrowth5yRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Foreign investment</span>
              <span class="data-tile__value">${fdiLastYear} projects</span>
              <span class="data-tile__sub">Rank ${fdiLastYearRank}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Rent trend</span>
              <span class="data-tile__value">${rentTrend}</span>
            </div>

            <div class="data-tile">
              <span class="data-tile__label">Market type</span>
              <span class="data-tile__value">${marketType}</span>
            </div>
          </div>
        </div>
      </div>
    `,
    popup: `
      <div class="popup-card">
        <div class="popup-card__label">Selected location</div>
        <div class="popup-card__title">${label}</div>

        <div class="popup-coords">
          <div class="popup-coord">
            <span>Latitude</span>
            <strong>${lat.toFixed(6)}</strong>
          </div>
          <div class="popup-coord">
            <span>Longitude</span>
            <strong>${lng.toFixed(6)}</strong>
          </div>
        </div>

        <div class="popup-line">
          <span>Region</span>
          <strong>${regionName || 'Unknown'}</strong>
        </div>
      </div>
    `
  }
}
