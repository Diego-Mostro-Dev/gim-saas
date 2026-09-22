import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function FitPolyline({ polyline }) {
  const map = useMap();
  useEffect(() => {
    if (!polyline?.length) return;
    const bounds = polyline.map(([lat, lng]) => [lat, lng]);
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, polyline]);
  return null;
}

function OutingRouteMap({ polyline, height = "11rem" }) {
  const coords = Array.isArray(polyline) ? polyline : [];
  if (coords.length < 2) return null;
  const [startLat, startLng] = coords[0];
  const [endLat, endLng] = coords[coords.length - 1];
  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-border"
      style={{ height }}
      data-testid="outing-route-map"
    >
      <MapContainer
        center={[(startLat + endLat) / 2, (startLng + endLng) / 2]}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Polyline
          positions={coords}
          pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.9 }}
        />
        <CircleMarker
          center={[startLat, startLng]}
          radius={6}
          pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }}
        />
        <CircleMarker
          center={[endLat, endLng]}
          radius={6}
          pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }}
        />
        <FitPolyline polyline={coords} />
      </MapContainer>
    </div>
  );
}

export default OutingRouteMap;