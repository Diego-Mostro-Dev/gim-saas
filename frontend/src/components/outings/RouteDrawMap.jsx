import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { haversineKm } from "../../utils/geo";

const DEFAULT_CENTER = [-34.6037, -58.3816];

function FitRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points, { padding: [24, 24] });
  }, [map, points]);
  return null;
}

function ClickHandler({ onAdd }) {
  useMapEvents({
    click: (e) => onAdd([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

function RouteDrawMap({ value, onChange }) {
  const points = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const lastAddRef = useRef(null);
  const distance = haversineKm(points);

  function handleAdd([lat, lng]) {
    const last = lastAddRef.current;
    if (last && Math.abs(last[0] - lat) < 1e-6 && Math.abs(last[1] - lng) < 1e-6) {
      return;
    }
    lastAddRef.current = [lat, lng];
    onChange([...points, [lat, lng]]);
  }

  function handleUndo() {
    if (points.length > 0) onChange(points.slice(0, -1));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        scrollWheelZoom
        style={{ height: "18rem", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onAdd={handleAdd} />
        {points.length > 0 && (
          <>
            <Polyline
              positions={points}
              pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.9 }}
            />
            <CircleMarker
              center={points[0]}
              radius={6}
              pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }}
            />
            {points.length > 1 && (
              <CircleMarker
                center={points[points.length - 1]}
                radius={6}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }}
              />
            )}
          </>
        )}
        <FitRoute points={points} />
      </MapContainer>

      <div className="flex flex-col gap-2 border-t border-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-secondary">
          {points.length === 0 ? (
            "Hacé clic en el mapa para marcar el recorrido."
          ) : (
            <>
              {points.length} {points.length === 1 ? "punto" : "puntos"} ·{" "}
              {distance.toLocaleString("es-AR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              km
            </>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={points.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger-text transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Borrar ruta
          </button>
        </div>
      </div>
    </div>
  );
}

export default RouteDrawMap;