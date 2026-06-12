import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"

// --- Helpers ---

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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

function loadMilestones() {
  try {
    return JSON.parse(localStorage.getItem("milestones") || "[]")
  } catch {
    return []
  }
}

function saveMilestones(milestones) {
  localStorage.setItem("milestones", JSON.stringify(milestones))
}

// --- Sub-components ---

// Moves the map to a given position - must be used inside MapContainer
function RecenterMap({ position }) {
  const map = useMap()
  const hasRecentered = useRef(false)
  useEffect(() => {
    if (position && !hasRecentered.current) {
      map.setView(position, map.getZoom())
      hasRecentered.current = true
    }
  }, [position, map])
  return null
}

// Handles map click events for placing milestones
// Must live inside MapContainer to access map context
function MapClickHandler({ mode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mode === "add") {
        onMapClick(e.latlng)
      }
    },
  })
  return null
}

// Changes the map cursor depending on the current mode
function MapCursor({ mode }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    if (mode === "add") container.style.cursor = "crosshair"
    else if (mode === "delete") container.style.cursor = "not-allowed"
    else container.style.cursor = ""
  }, [mode, map])
  return null
}

// --- Main component ---

export default function Map() {
  const [userPosition, setUserPosition] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [nearest, setNearest] = useState(null)
  const [milestones, setMilestones] = useState(loadMilestones)
  const [mode, setMode] = useState("none") // "none" | "add" | "delete"

  // Popup state for naming a new milestone
  const [pendingPosition, setPendingPosition] = useState(null)
  const [pendingName, setPendingName] = useState("")
  const [pendingPoints, setPendingPoints] = useState("")

  // Watch GPS position
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.")
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => setLocationError("Unable to retrieve your location."),
      { enableHighAccuracy: true }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Recalculate nearest milestone whenever user moves or milestones change
  useEffect(() => {
    if (!userPosition || milestones.length === 0) {
      setNearest(null)
      return
    }
    const [lat, lon] = userPosition
    let closest = null
    let minDist = Infinity
    milestones.forEach((m) => {
      const dist = getDistance(lat, lon, m.position[0], m.position[1])
      if (dist < minDist) {
        minDist = dist
        closest = {
          ...m,
          distance: Math.round(dist),
          bearing: getBearing(lat, lon, m.position[0], m.position[1]),
        }
      }
    })
    setNearest(closest)
  }, [userPosition, milestones])

  // Called when user clicks the map in "add" mode
  function handleMapClick(latlng) {
    setPendingPosition([latlng.lat, latlng.lng])
    setPendingName("")
    setPendingPoints("")
    setMode("none")
  }

  // Called when user confirms the new milestone popup
  function handleConfirmMilestone() {
    if (!pendingName.trim() || !pendingPoints) return
    const newMilestone = {
      id: Date.now(),
      name: pendingName.trim(),
      points: parseInt(pendingPoints),
      position: pendingPosition,
    }
    const updated = [...milestones, newMilestone]
    setMilestones(updated)
    saveMilestones(updated)
    setPendingPosition(null)
  }

  // Called when user clicks a milestone marker in "delete" mode
  function handleDeleteMilestone(id) {
    const updated = milestones.filter((m) => m.id !== id)
    setMilestones(updated)
    saveMilestones(updated)
    setMode("none")
  }

  function toggleMode(newMode) {
    setMode((prev) => (prev === newMode ? "none" : newMode))
  }

  // Icons
  const userIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

  const milestoneIcon = L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

  const deleteMilestoneIcon = L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

  const defaultCenter = [57.2847, 10.9880]

  return (
    <div className="relative w-screen h-screen">

      {/* Top toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
        <button
          onClick={() => toggleMode("add")}
          className={`px-4 py-2 rounded-full text-sm font-medium shadow-md transition-colors ${
            mode === "add"
              ? "bg-amber-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {mode === "add" ? "Tap map to place…" : "＋ New Milestone"}
        </button>
        <button
          onClick={() => toggleMode("delete")}
          className={`px-4 py-2 rounded-full text-sm font-medium shadow-md transition-colors ${
            mode === "delete"
              ? "bg-red-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {mode === "delete" ? "Tap marker to delete…" : "✕ Delete Milestone"}
        </button>
      </div>

      {/* New milestone popup */}
      {pendingPosition && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-72">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">New Milestone</h2>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g. Hilltop marker"
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">Points</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g. 10"
                type="number"
                min="1"
                value={pendingPoints}
                onChange={(e) => setPendingPoints(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingPosition(null)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMilestone}
                disabled={!pendingName.trim() || !pendingPoints}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom info panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white border-t border-gray-200 p-4 shadow-lg">
        {locationError ? (
          <p className="text-red-500 text-sm">{locationError}</p>
        ) : !userPosition ? (
          <p className="text-gray-500 text-sm">Acquiring GPS position...</p>
        ) : milestones.length === 0 ? (
          <p className="text-gray-400 text-sm">No milestones yet — add one using the button above.</p>
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
                {bearingToCardinal(nearest.bearing)}&nbsp;
                <span style={{ display: "inline-block", transform: `rotate(${nearest.bearing}deg)` }}>↑</span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Map */}
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

        <MapClickHandler mode={mode} onMapClick={handleMapClick} />
        <MapCursor mode={mode} />
        {userPosition && <RecenterMap position={userPosition} />}

        {/* User position */}
        {userPosition && (
          <Marker position={userPosition} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Milestones */}
        {milestones.map((m) => (
          <Marker
            key={m.id}
            position={m.position}
            icon={mode === "delete" ? deleteMilestoneIcon : milestoneIcon}
            eventHandlers={{
              click() {
                if (mode === "delete") handleDeleteMilestone(m.id)
              },
            }}
          >
            {mode !== "delete" && (
              <Popup>
                <strong>{m.name}</strong><br />
                {m.points} points
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}