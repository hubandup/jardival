import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Store, directionsUrlFor } from "@/data/stores";

interface Props {
  stores: Store[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}

// Custom marker icon using design system colors (no external image deps)
const makePin = (active: boolean) => {
  const color = active ? "hsl(354, 78%, 48%)" : "hsl(142, 65%, 28%)";
  const size = active ? 42 : 34;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;transform:translate(-50%,-100%);">
      <svg viewBox="0 0 32 44" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 28 16 28s16-17 16-28c0-8.84-7.16-16-16-16z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    </div>`;
  return L.divIcon({
    html,
    className: "jardival-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

export const StoresMap = ({ stores, activeId, onSelect }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([47.2, 6.0], 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Sync markers with stores list
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (stores.length === 0) return;

    stores.forEach((s) => {
      const marker = L.marker(s.coords, { icon: makePin(false) }).addTo(map);
      const linkStyle =
        "display:inline-block;padding:5px 10px;background:hsl(142,65%,28%);color:white;border-radius:999px;font-size:11px;font-weight:600;text-decoration:none";
      const popupHtml = `
        <div style="font-family:Inter,sans-serif;min-width:220px">
          <div style="font-weight:600;font-size:14px;color:hsl(150,20%,12%)">${s.name}</div>
          <div style="color:hsl(150,8%,42%);font-size:12px;margin-top:4px">${s.address}<br/>${s.postalCode ? s.postalCode + " " : ""}${s.city}</div>
          <a href="/magasins/${s.slug || s.id}" style="display:inline-block;margin-top:10px;padding:6px 12px;background:hsl(142,65%,28%);color:white;border-radius:999px;font-size:12px;font-weight:600;text-decoration:none">Voir le magasin →</a>
          <div style="margin-top:10px;font-size:10px;color:hsl(150,8%,42%);text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Itinéraire — ouvrir avec</div>
          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
            <a href="${directionsUrlFor(s, "google")}" target="_blank" rel="noopener" style="${linkStyle}">Google Maps</a>
            <a href="${directionsUrlFor(s, "apple")}" target="_blank" rel="noopener" style="${linkStyle}">Plans</a>
            <a href="${directionsUrlFor(s, "waze")}" target="_blank" rel="noopener" style="${linkStyle}">Waze</a>
            <a href="${directionsUrlFor(s, "osm")}" target="_blank" rel="noopener" style="${linkStyle}">OSM</a>
          </div>
        </div>`;
      marker.bindPopup(popupHtml);
      marker.on("click", () => onSelect?.(s.id));
      markersRef.current[s.id] = marker;
    });

    // Fit bounds
    const bounds = L.latLngBounds(stores.map((s) => s.coords));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [stores, onSelect]);

  // Highlight active marker
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]) => {
      m.setIcon(makePin(id === activeId));
    });
    if (activeId && markersRef.current[activeId] && mapRef.current) {
      const m = markersRef.current[activeId];
      mapRef.current.flyTo(m.getLatLng(), 13, { duration: 0.8 });
      m.openPopup();
    }
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full overflow-hidden rounded-2xl border border-border shadow-card"
      style={{ background: "hsl(var(--secondary))" }}
    />
  );
};
