import { Store } from "@/data/stores";

// Haversine distance in km
export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStore(
  position: [number, number],
  stores: Store[]
): { store: Store; distance: number } | null {
  if (stores.length === 0) return null;
  let best = stores[0];
  let bestD = distanceKm(position, best.coords);
  for (const s of stores.slice(1)) {
    const d = distanceKm(position, s.coords);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { store: best, distance: bestD };
}
