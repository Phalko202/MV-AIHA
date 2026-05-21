"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { FacilityStatus } from "@/lib/surveillance-api";

const statusColor: Record<FacilityStatus["status"], string> = {
  critical: "#ef4444",
  moderate: "#eab308",
  watch: "#0ea5e9",
  stable: "#22c55e",
};

const statusIcon: Record<FacilityStatus["status"], string> = {
  critical: "!",
  moderate: "+",
  watch: "•",
  stable: "✓",
};

function facilityPinIcon(facility: FacilityStatus) {
  const color = statusColor[facility.status];
  const size = facility.status === "critical" ? 48 : facility.status === "moderate" ? 44 : facility.type === "clinic" ? 38 : 42;
  return L.divIcon({
    className: "mv-aihs-map-pin",
    html: `
      <button class="mv-aihs-pin mv-aihs-pin-${facility.status}" style="--pin-color:${color};width:${size}px;height:${size}px" aria-label="${facility.name}">
        <span class="mv-aihs-pin-pulse"></span>
        <span class="mv-aihs-pin-head">
          <span class="mv-aihs-pin-glyph">${statusIcon[facility.status]}</span>
        </span>
        <span class="mv-aihs-pin-tail"></span>
      </button>
    `,
    iconSize: [size, size + 14],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -size],
  });
}

// Maldives bounding box — locked
const MALDIVES_BOUNDS: L.LatLngBoundsExpression = [
  [-1.2, 72.3], // SW
  [7.5, 74.2],  // NE
];
const MALDIVES_CENTER: [number, number] = [3.2, 73.2];

function ConstrainView({ facilities }: { facilities: FacilityStatus[] }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(MALDIVES_BOUNDS);
    map.setMinZoom(6);
    map.setMaxZoom(18);
    if (facilities.length > 0) {
      const lats = facilities.map((f) => f.lat);
      const lngs = facilities.map((f) => f.lng);
      map.fitBounds(
        [
          [Math.min(...lats) - 0.5, Math.min(...lngs) - 0.3],
          [Math.max(...lats) + 0.5, Math.max(...lngs) + 0.3],
        ],
        { padding: [25, 25], maxZoom: 8 }
      );
    }
  }, [map, facilities]);
  return null;
}

interface Props {
  facilities: FacilityStatus[];
  onFacilityClick: (f: FacilityStatus) => void;
  height?: string;
}

export default function SurveillanceMap({ facilities, onFacilityClick, height = "500px" }: Props) {
  const [mapKey, setMapKey] = useState<string | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMapKey(`mv-aihs-${Date.now()}`));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!mapKey) return <div style={{ height }} className="mv-map-stage bg-slate-100/70 animate-pulse" />;

  return (
    <div className="mv-map-stage" style={{ height }}>
      <MapContainer
        key={mapKey}
        center={MALDIVES_CENTER}
        zoom={7}
        minZoom={6}
        maxZoom={18}
        maxBounds={MALDIVES_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        attributionControl={false}
        worldCopyJump={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />

        <ConstrainView facilities={facilities} />

        {facilities.map((f) => {
          const color = statusColor[f.status];
          return (
            <Marker
              key={f.id}
              position={[f.lat, f.lng]}
              icon={facilityPinIcon(f)}
              eventHandlers={{ click: () => onFacilityClick(f) }}
          >
            <Popup>
              <div className="text-xs min-w-[220px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{f.status} signal</span>
                  <span className="ml-auto text-[10px] text-slate-400 uppercase">{f.type}</span>
                </div>
                <p className="font-bold text-sm">{f.name}</p>
                <p className="text-slate-500 text-[11px] mb-2">{f.island} · {f.atoll} Atoll</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-2">
                  <span className="text-slate-400">Disease episodes</span>
                  <span className="font-bold text-slate-900">{f.activeCases}</span>
                  <span className="text-slate-400">Same-day signals</span>
                  <span className="font-bold">{f.conditions.reduce((sum, item) => sum + item.last24h, 0)}</span>
                  <span className="text-slate-400">Top disease</span>
                  <span className="font-bold">{f.conditions.slice().sort((a, b) => b.last24h - a.last24h)[0]?.last24h ?? 0} today</span>
                </div>
                {f.alerts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
                    {f.alerts.map((a, i) => (
                      <p key={i} className="text-red-600 text-[10px] leading-snug">{a}</p>
                    ))}
                  </div>
                )}
                <p className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-blue-600 font-semibold">Click marker for disease detail</p>
              </div>
            </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
