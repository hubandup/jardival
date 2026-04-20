export interface StoreHours {
  day: string;
  morning?: string;
  afternoon?: string;
  closed?: boolean;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  postalCode?: string;
  city: string;
  department: string;
  coords: [number, number];
  phone?: string;
  hours?: StoreHours[];
  services?: string[];
  /** Image de couverture importée via `import` ou URL publique. */
  image?: string;
}

// Horaires types appliqués par défaut à tous les magasins
// (à personnaliser magasin par magasin plus tard)
export const DEFAULT_HOURS: StoreHours[] = [
  { day: "Lundi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Mardi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Mercredi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Jeudi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Vendredi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Samedi", morning: "9h00 – 12h00", afternoon: "14h00 – 19h00" },
  { day: "Dimanche", closed: true },
];

// Services types proposés dans tous les magasins du réseau
export const DEFAULT_SERVICES: string[] = [
  "Pépinière & Plantes",
  "Jardin & Outillage",
  "Animalerie",
  "Mobilier de jardin",
  "Barbecue & Plancha",
  "Conseils experts",
  "Carte fidélité",
  "Parking gratuit",
];

export const STORES: Store[] = [
  { id: "arbois", name: "Jardival Arbois", address: "29 Route de Villeneuve", city: "Arbois", department: "39", coords: [46.92013, 5.76592] },
  { id: "arinthod", name: "Jardival Arinthod", address: "Zone Artisanale", postalCode: "39240", city: "Arinthod", department: "39", coords: [46.3932567, 5.5683496] },
  { id: "balanod", name: "Jardival Balanod", address: "ZAC La Maladière, Route de Franche Comté", postalCode: "39160", city: "Balanod", department: "39", coords: [46.455666, 5.3568493] },
  { id: "bletterans", name: "Jardival Bletterans", address: "3 Avenue Jean de Chalon-Arlay", postalCode: "39140", city: "Bletterans", department: "39", coords: [46.7475958, 5.458532] },
  { id: "bourguignon", name: "Jardival Bourguignon", address: "ZAC de la Champagne, Rue des Pruniers", postalCode: "25150", city: "Bourguignon", department: "25", coords: [47.4139865, 6.7796701] },
  { id: "champagnole", name: "Jardival Champagnole", address: "30 Avenue Clémenceau", postalCode: "39300", city: "Champagnole", department: "39", coords: [46.755739, 5.9032139] },
  { id: "corbenay", name: "Jardival Corbenay", address: "9 Avenue Jacques Parisot", postalCode: "70320", city: "Corbenay", department: "70", coords: [47.8840374, 6.3131644] },
  { id: "danjoutin", name: "Jardival Danjoutin", address: "32 rue des Nos", city: "Danjoutin", department: "90", coords: [47.6154965, 6.8485528] },
  { id: "delle", name: "Jardival Delle", address: "4 Boulevard de la Liberté", postalCode: "90100", city: "Delle", department: "90", coords: [47.5133095, 6.9988382] },
  { id: "dole", name: "Jardival Dole", address: "Rue Costes et Bellonte, Zone Portuaire", postalCode: "39100", city: "Dole", department: "39", coords: [47.0813863, 5.4883767] },
  { id: "fougerolles", name: "Jardival Fougerolles", address: "27 Grande Rue", postalCode: "70220", city: "Fougerolles", department: "70", coords: [47.8873774, 6.4050992] },
  { id: "fresne", name: "Jardival Fresne-Saint-Mames", address: "30 Avenue des Peupliers", postalCode: "70130", city: "Fresne-Saint-Mames", department: "70", coords: [47.5519823, 5.8541072] },
  { id: "gray", name: "Jardival Gray", address: "Rue de la Gare", postalCode: "70100", city: "Gray", department: "70", coords: [47.4921076, 5.6552308] },
  { id: "jussey", name: "Jardival Jussey", address: "Zone Ciale des 3 Provinces", postalCode: "70500", city: "Jussey", department: "70", coords: [47.8211, 5.9] },
  { id: "lure", name: "Jardival Lure", address: "ZAC de la Saline, Route de Belfort", postalCode: "70200", city: "Lure", department: "70", coords: [47.6740515, 6.5125151] },
  { id: "luxeuil", name: "Jardival Luxeuil les Bains", address: "ZAC Espace du Lac, Avenue Maréchal Turenne", postalCode: "70300", city: "Luxeuil les Bains", department: "70", coords: [47.8123395, 6.3645783] },
  { id: "marnay", name: "Jardival Marnay", address: "25 Avenue de la Gare", postalCode: "70150", city: "Marnay", department: "70", coords: [47.2927672, 5.7781464] },
  { id: "noidans", name: "Jardival Noidans les Vesoul", address: "Rue des Faines, ZI Noidans", postalCode: "70000", city: "Noidans les Vesoul", department: "70", coords: [47.6224314, 6.1391562] },
  { id: "orchamps", name: "Jardival Orchamps", address: "Zone Artisanale", postalCode: "39700", city: "Orchamps", department: "39", coords: [47.1475502, 5.6581857] },
  { id: "orgelet", name: "Jardival Orgelet", address: "11 Chemin de l'Epinette", postalCode: "39270", city: "Orgelet", department: "39", coords: [46.5285842, 5.6038679] },
  { id: "port-sur-saone", name: "Jardival Port sur Saône", address: "14 Route de Villers", postalCode: "70170", city: "Port sur Saône", department: "70", coords: [47.6928462, 6.0533366] },
  { id: "rioz", name: "Jardival Rioz", address: "Parc d'Activité 3R, 1 Rue Alexander Graham", postalCode: "70190", city: "Rioz", department: "70", coords: [47.4326394, 6.0649374] },
  { id: "ronchamp", name: "Jardival Ronchamp", address: "Rue du Plain", postalCode: "70250", city: "Ronchamp", department: "70", coords: [47.697318, 6.6443901] },
  { id: "saint-claude", name: "Jardival Saint-Claude", address: "27 Rue Carnot", postalCode: "39200", city: "Saint-Claude", department: "39", coords: [46.3807772, 5.8572088] },
  { id: "saint-germain", name: "Jardival Saint-Germain", address: "Zone Artisanale", postalCode: "71330", city: "Saint-Germain", department: "71", coords: [46.7502797, 5.2586496] },
  { id: "salins", name: "Jardival Salins les Bains", address: "Route de Champagnole", postalCode: "39110", city: "Salins les Bains", department: "39", coords: [46.927359, 5.8865218] },
  { id: "villersexel", name: "Jardival Villersexel", address: "20 Rue de la Croix Marmin", postalCode: "70110", city: "Villersexel", department: "70", coords: [47.5494989, 6.432018] },
  { id: "perrigny", name: "Point Vert Jardival Perrigny", address: "705 rue de la Lieme", city: "Perrigny", department: "39", coords: [46.6767077, 5.583422] },
];

export const DEPARTMENTS: Record<string, string> = {
  "25": "Doubs",
  "39": "Jura",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "90": "Territoire de Belfort",
};

// OpenStreetMap URL — never blocked by ad-blockers (unlike google.com/maps/search
// which is often blocked as a tracking URL by uBlock/Brave/etc).
export function mapsUrl(store: Store) {
  const [lat, lon] = store.coords;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

// Directions URL using the universal "geo:" intent on mobile, with an OSM fallback.
// We keep OSM here too because google.com/maps/dir is sometimes blocked.
export function directionsUrl(store: Store) {
  const [lat, lon] = store.coords;
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lon}`;
}

// Multi-provider directions URLs. Used by the "Ouvrir avec…" dropdown so
// users can pick their preferred navigation app.
export type DirectionsProvider = "google" | "apple" | "waze" | "osm";

export function directionsUrlFor(store: Store, provider: DirectionsProvider) {
  const [lat, lon] = store.coords;
  const label = encodeURIComponent(`${store.name} — ${store.city}`);
  switch (provider) {
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${label}`;
    case "apple":
      return `https://maps.apple.com/?daddr=${lat},${lon}&q=${label}`;
    case "waze":
      return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    case "osm":
    default:
      return `https://www.openstreetmap.org/directions?to=${lat}%2C${lon}`;
  }
}

// Récupère un magasin par son id avec horaires/services par défaut appliqués
export function getStore(id: string | undefined): Store | undefined {
  if (!id) return undefined;
  const s = STORES.find((x) => x.id === id);
  if (!s) return undefined;
  return {
    ...s,
    phone: s.phone ?? "+33 0 00 00 00 00",
    hours: s.hours ?? DEFAULT_HOURS,
    services: s.services ?? DEFAULT_SERVICES,
  };
}

// Calcule la distance haversine en km entre deux points
export function distanceKm(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
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

// Renvoie les N magasins les plus proches d'un magasin donné
export function nearbyStores(store: Store, n = 3): Array<Store & { distance: number }> {
  return STORES.filter((s) => s.id !== store.id)
    .map((s) => ({ ...s, distance: distanceKm(store.coords, s.coords) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}
