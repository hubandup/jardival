export interface Store {
  id: string;
  name: string;
  address: string;
  postalCode?: string;
  city: string;
  department: string;
  coords: [number, number];
}

export const STORES: Store[] = [
  { id: "arbois", name: "Jardival Arbois", address: "29 Route de Villeneuve", city: "Arbois", department: "39" },
  { id: "arinthod", name: "Jardival Arinthod", address: "Zone Artisanale", postalCode: "39240", city: "Arinthod", department: "39" },
  { id: "balanod", name: "Jardival Balanod", address: "ZAC La Maladière, Route de Franche Comté", postalCode: "39160", city: "Balanod", department: "39" },
  { id: "bletterans", name: "Jardival Bletterans", address: "3 Avenue Jean de Chalon-Arlay", postalCode: "39140", city: "Bletterans", department: "39" },
  { id: "bourguignon", name: "Jardival Bourguignon", address: "ZAC de la Champagne, Rue des Pruniers", postalCode: "25150", city: "Bourguignon", department: "25" },
  { id: "champagnole", name: "Jardival Champagnole", address: "30 Avenue Clémenceau", postalCode: "39300", city: "Champagnole", department: "39" },
  { id: "corbenay", name: "Jardival Corbenay", address: "9 Avenue Jacques Parisot", postalCode: "70320", city: "Corbenay", department: "70" },
  { id: "danjoutin", name: "Jardival Danjoutin", address: "32 rue des Nos", city: "Danjoutin", department: "90" },
  { id: "delle", name: "Jardival Delle", address: "4 Boulevard de la Liberté", postalCode: "90100", city: "Delle", department: "90" },
  { id: "dole", name: "Jardival Dole", address: "Rue Costes et Bellonte, Zone Portuaire", postalCode: "39100", city: "Dole", department: "39" },
  { id: "fougerolles", name: "Jardival Fougerolles", address: "27 Grande Rue", postalCode: "70220", city: "Fougerolles", department: "70" },
  { id: "fresne", name: "Jardival Fresne-Saint-Mames", address: "30 Avenue des Peupliers", postalCode: "70130", city: "Fresne-Saint-Mames", department: "70" },
  { id: "gray", name: "Jardival Gray", address: "Rue de la Gare", postalCode: "70100", city: "Gray", department: "70" },
  { id: "jussey", name: "Jardival Jussey", address: "Zone Ciale des 3 Provinces", postalCode: "70500", city: "Jussey", department: "70" },
  { id: "lure", name: "Jardival Lure", address: "ZAC de la Saline, Route de Belfort", postalCode: "70200", city: "Lure", department: "70" },
  { id: "luxeuil", name: "Jardival Luxeuil les Bains", address: "ZAC Espace du Lac, Avenue Maréchal Turenne", postalCode: "70300", city: "Luxeuil les Bains", department: "70" },
  { id: "marnay", name: "Jardival Marnay", address: "25 Avenue de la Gare", postalCode: "70150", city: "Marnay", department: "70" },
  { id: "noidans", name: "Jardival Noidans les Vesoul", address: "Rue des Faines, ZI Noidans", postalCode: "70000", city: "Noidans les Vesoul", department: "70" },
  { id: "orchamps", name: "Jardival Orchamps", address: "Zone Artisanale", postalCode: "39700", city: "Orchamps", department: "39" },
  { id: "orgelet", name: "Jardival Orgelet", address: "11 Chemin de l'Epinette", postalCode: "39270", city: "Orgelet", department: "39" },
  { id: "port-sur-saone", name: "Jardival Port sur Saône", address: "14 Route de Villers", postalCode: "70170", city: "Port sur Saône", department: "70" },
  { id: "rioz", name: "Jardival Rioz", address: "Parc d'Activité 3R, 1 Rue Alexander Graham", postalCode: "70190", city: "Rioz", department: "70" },
  { id: "ronchamp", name: "Jardival Ronchamp", address: "Rue du Plain", postalCode: "70250", city: "Ronchamp", department: "70" },
  { id: "saint-claude", name: "Jardival Saint-Claude", address: "27 Rue Carnot", postalCode: "39200", city: "Saint-Claude", department: "39" },
  { id: "saint-germain", name: "Jardival Saint-Germain", address: "Zone Artisanale", postalCode: "71330", city: "Saint-Germain", department: "71" },
  { id: "salins", name: "Jardival Salins les Bains", address: "Route de Champagnole", postalCode: "39110", city: "Salins les Bains", department: "39" },
  { id: "villersexel", name: "Jardival Villersexel", address: "20 Rue de la Croix Marmin", postalCode: "70110", city: "Villersexel", department: "70" },
  { id: "perrigny", name: "Point Vert Jardival Perrigny", address: "705 rue de la Lieme", city: "Perrigny", department: "39" },
];

export const DEPARTMENTS: Record<string, string> = {
  "25": "Doubs",
  "39": "Jura",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "90": "Territoire de Belfort",
};

export function mapsUrl(store: Store) {
  const q = encodeURIComponent(`${store.name}, ${store.address}, ${store.postalCode ?? ""} ${store.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
