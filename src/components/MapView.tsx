"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Person, Place } from "@/lib/types";

export type CityCluster = { key: string; city: string; region: string; country: string; lat: number; lon: number; count: number; requested: number; people: Person[] };

export function clusterByCity(people: Person[]): CityCluster[] {
  const m = new Map<string, CityCluster>();
  for (const p of people) {
    if (p.lat == null || p.lon == null) continue;
    const key = `${p.city}|${p.region}|${p.country}`;
    let c = m.get(key);
    if (!c) {
      c = { key, city: p.city, region: p.region, country: p.country, lat: p.lat, lon: p.lon, count: 0, requested: 0, people: [] };
      m.set(key, c);
    }
    c.count++;
    if (p.locationKind === "requested") c.requested++;
    c.people.push(p);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export default function MapView({
  clusters,
  center,
  radiusMiles,
  onPickCity,
}: {
  clusters: CityCluster[];
  center: Place | null;
  radiusMiles: number;
  onPickCity: (c: CityCluster) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const circle = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { center: [38, -96], zoom: 4, scrollWheelZoom: true, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "rotr-tiles",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    for (const c of clusters) {
      const kind = c.requested > c.count / 2 ? "requested" : "recorded";
      const big = c.count >= 10;
      const icon = L.divIcon({ className: "", html: `<div class="marker-pin ${kind} ${big ? "big" : ""}">${c.count}</div>`, iconSize: big ? [36, 36] : [28, 28], iconAnchor: big ? [18, 18] : [14, 14] });
      const mk = L.marker([c.lat, c.lon], { icon, title: c.city });
      mk.bindTooltip(`<strong>${c.city}</strong>${c.region ? ", " + c.region : ""}<br>${c.count} ${c.count === 1 ? "person" : "people"}${c.requested ? ` · ${c.requested} asked for a show` : ""}`, { direction: "top", offset: [0, -14] });
      mk.on("click", () => onPickCity(c));
      mk.addTo(layer.current!);
    }
  }, [clusters, onPickCity]);

  useEffect(() => {
    if (!map.current) return;
    circle.current?.remove();
    circle.current = null;
    if (center) {
      circle.current = L.circle([center.lat, center.lon], { radius: radiusMiles * 1609.34, color: "#e23d7b", weight: 2, fillColor: "#e23d7b", fillOpacity: 0.08 }).addTo(map.current);
      map.current.fitBounds(circle.current.getBounds().pad(0.4), { animate: true });
    }
  }, [center, radiusMiles]);

  return <div ref={el} className="w-full h-[460px] rounded-2xl overflow-hidden border border-line" />;
}
