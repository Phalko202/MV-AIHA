"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HospitalLocation } from "@/lib/mock-data";

// Fix default marker icons for Leaflet + webpack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const statusColors: Record<HospitalLocation["status"], string> = {
  operational: "#22c55e",
  busy: "#f59e0b",
  critical: "#ef4444",
};

function createColoredIcon(status: HospitalLocation["status"]) {
  const color = statusColors[status];
  return L.divIcon({
    html: `<div style="
      width: 18px; height: 18px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 8px ${color}80, 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

L.Marker.prototype.options.icon = defaultIcon;

interface HospitalMapProps {
  hospitals: HospitalLocation[];
}

export default function HospitalMap({ hospitals }: HospitalMapProps) {
  return (
    <MapContainer
      center={[4.1755, 73.5093]}
      zoom={11}
      className="h-full w-full"
      style={{ background: "#0c0a0f" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {hospitals.map((h) => (
        <Marker key={h.name} position={[h.lat, h.lng]} icon={createColoredIcon(h.status)}>
          <Popup>
            <div style={{ color: "#1e293b", fontFamily: "system-ui", minWidth: 180 }}>
              <strong style={{ fontSize: 13 }}>{h.name}</strong>
              <div style={{ fontSize: 11, marginTop: 4, color: "#64748b" }}>
                Status: <span style={{ color: statusColors[h.status], fontWeight: 600, textTransform: "uppercase" }}>{h.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Beds: {h.beds} | Occupancy: {h.occupancy}%
              </div>
              <div style={{
                marginTop: 6,
                height: 4,
                background: "#e2e8f0",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${h.occupancy}%`,
                  background: statusColors[h.status],
                  borderRadius: 2,
                }} />
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
