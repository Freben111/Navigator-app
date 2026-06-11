import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"

// Dummy milestones - replace these with real coordinates later
const MILESTONES = [
  { id: 1, name: "Milestone 1", points: 10, position: [57.2847, 10.9880] },
  { id: 2, name: "Milestone 2", points: 20, position: [57.2901, 10.9750] },
  { id: 3, name: "Milestone 3", points: 15, position: [57.2780, 10.9950] },
]

// Haversine formula - calculates distance in meters between two GPS coordinates
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns a compass bearing in degrees (0–360) from one point to another
function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180
  const toDeg = (x) => (x * 180) / Math.PI
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function bearingToCardinal(bearing) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(bearing / 45) % 8]
}

// Moves the map to a given position - must be used inside MapContainer
function RecenterMap({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, map.getZoom())
  }, [position, map])
  return null
}

export default function Map() {
  const [userPosition, setUserPosition] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [nearest, setNearest] = useState(null)

  // Watch the user's GPS position continuously
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserPosition([latitude, longitude])
      },
      () => setLocationError("Unable to retrieve your location."),
      { enableHighAccuracy: true }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Recalculate nearest milestone whenever the user moves
  useEffect(() => {
    if (!userPosition) return

    const [lat, lon] = userPosition
    let closest = null
    let minDist = Infinity

    MILESTONES.forEach((m) => {
      const dist = getDistance(lat, lon, m.position[0], m.position[1])
      if (dist < minDist) {
        minDist = dist
        closest = { ...m, distance: Math.round(dist), bearing: getBearing(lat, lon, m.position[0], m.position[1]) }
      }
    })

    setNearest(closest)
  }, [userPosition])

  // Custom icon for the user's own position
  const userIcon = L.divIcon({
    className: "",
    html: `<div style="
      width: 18px; height: 18px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

  // Default map center (Læsø) used before GPS kicks in
  const defaultCenter = [57.2847, 10.9880]

  return (
    <div className="relative w-screen h-screen">

      {/* Info panel at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white border-t border-gray-200 p-4 shadow-lg">
        {locationError ? (
          <p className="text-red-500 text-sm">{locationError}</p>
        ) : !userPosition ? (
          <p className="text-gray-500 text-sm">Acquiring GPS position...</p>
        ) : nearest ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Nearest milestone</p>
              <p className="font-semibold text-gray-800">{nearest.name}</p>
              <p className="text-xs text-gray-500">{nearest.points} points</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {nearest.distance >= 1000
                  ? `${(nearest.distance / 1000).toFixed(1)} km`
                  : `${nearest.distance} m`}
              </p>
              <p className="text-sm text-gray-600">
                {bearingToCardinal(nearest.bearing)} &nbsp;
                <span style={{ display: "inline-block", transform: `rotate(${nearest.bearing}deg)` }}>↑</span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* The map itself */}
      <MapContainer
        center={userPosition ?? defaultCenter}
        zoom={14}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Re-center map when GPS position is first acquired */}
        {userPosition && <RecenterMap position={userPosition} />}

        {/* User position marker */}
        {userPosition && (
          <Marker position={userPosition} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Milestone markers */}
        {MILESTONES.map((m) => (
          <Marker key={m.id} position={m.position}>
            <Popup>
              <strong>{m.name}</strong><br />
              {m.points} points
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}