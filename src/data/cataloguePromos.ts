// Promotions extraites du catalogue PDF "Jardinales" (jusqu'au 16 mai 2026).
// Tarifs alignés avec le prospectus papier — prioritaires sur les prix génériques
// du dataset products.json.
import { Product } from "@/types/product";

import bbqSerena from "@/assets/catalogue/bbq-serena.jpg";
import geraniums from "@/assets/catalogue/geraniums.jpg";
import rosiers from "@/assets/catalogue/rosiers.jpg";
import aromatiques from "@/assets/catalogue/aromatiques.jpg";
import olivier from "@/assets/catalogue/olivier.jpg";
import terreauFleuries from "@/assets/catalogue/terreau-fleuries.jpg";
import fulgosol from "@/assets/catalogue/fulgosol.jpg";
import terreauAgrumes from "@/assets/catalogue/terreau-agrumes.jpg";
import ecorcesPin from "@/assets/catalogue/ecorces-pin.jpg";
import terreauGeraniums from "@/assets/catalogue/terreau-geraniums.jpg";
import eolienne from "@/assets/catalogue/eolienne.jpg";
import pulverisateur from "@/assets/catalogue/pulverisateur.jpg";
import desherbantGlyper from "@/assets/catalogue/desherbant-glyper.jpg";
import bbqNestor from "@/assets/catalogue/bbq-nestor.jpg";
import charbon from "@/assets/catalogue/charbon.jpg";
import plancha from "@/assets/catalogue/plancha.jpg";
import croquettesChat from "@/assets/catalogue/croquettes-chat.jpg";
import croquettesChien from "@/assets/catalogue/croquettes-chien.jpg";
import jerrycan from "@/assets/catalogue/jerrycan.jpg";
import haricotVilmorin from "@/assets/catalogue/haricot-vilmorin.jpg";

export const CATALOGUE_PROMOS: Product[] = [
  // ============ Plein tarif catalogue (vedettes) ============
  {
    id: "cat-199370",
    ref: "199370",
    name: "Barbecue Charbon Serena",
    category: "Barbecue & Plancha",
    image: bbqSerena,
    images: [bbqSerena],
    price: 99.9,
    discount: 0,
  },
  {
    id: "cat-152043",
    ref: "152043",
    name: "Plancha sur chariot 3 brûleurs",
    category: "Barbecue & Plancha",
    image: plancha,
    images: [plancha],
    price: 299,
    discount: 0,
  },
  {
    id: "cat-198137",
    ref: "198137",
    name: "Éolienne Abeille Fleurs solaire",
    category: "Décoration jardin",
    image: eolienne,
    images: [eolienne],
    price: 35.9,
    discount: 0,
  },

  // ============ Vraies promos (oldPrice + discount) ============
  {
    id: "cat-160842",
    ref: "160842 / 199373",
    name: "Barbecue Nestor Original — Barbecook",
    category: "Barbecue & Plancha",
    image: bbqNestor,
    images: [bbqNestor],
    price: 759,
    oldPrice: 849,
    discount: 11,
  },
  {
    id: "cat-012519",
    ref: "012519",
    name: "Charbon de bois 50 L",
    category: "Barbecue & Plancha",
    image: charbon,
    images: [charbon],
    price: 17.9,
    oldPrice: 19.95,
    discount: 10,
  },
  {
    id: "cat-079941",
    ref: "079941",
    name: "Désherbant polyvalent Glyper 900 ml",
    category: "Désherbants",
    image: desherbantGlyper,
    images: [desherbantGlyper],
    price: 37.9,
    oldPrice: 49.95,
    discount: 24,
  },
  {
    id: "cat-052315",
    ref: "052315",
    name: "Croquettes pour chat Yock 15 kg",
    category: "Animalerie",
    image: croquettesChat,
    images: [croquettesChat],
    price: 29.95,
    oldPrice: 34.5,
    discount: 13,
  },
  {
    id: "cat-194592",
    ref: "194592",
    name: "Repas complet chien Yock 25 kg",
    category: "Animalerie",
    image: croquettesChien,
    images: [croquettesChien],
    price: 33.95,
    oldPrice: 36.7,
    discount: 7,
  },
  {
    id: "cat-027501",
    ref: "027501",
    name: "Jerrycan hydrocarbure 10 L Pressol",
    category: "Motoculture",
    image: jerrycan,
    images: [jerrycan],
    price: 14.9,
    oldPrice: 18.1,
    discount: 18,
  },

  // ============ Remises catégorie (-X% sur famille) ============
  {
    id: "cat-geraniums",
    ref: "Géraniums",
    name: "Géraniums & plantes fleuries annuelles (godet 7-9 cm)",
    category: "Végétaux",
    image: geraniums,
    images: [geraniums],
    price: 0,
    discount: 20,
  },
  {
    id: "cat-rosiers",
    ref: "Rosiers",
    name: "Rosiers Laperrière — Domaine de Chapelan",
    category: "Végétaux",
    image: rosiers,
    images: [rosiers],
    price: 0,
    discount: 15,
  },
  {
    id: "cat-aromatiques",
    ref: "005363 → 071491",
    name: "Plantes aromatiques (pot 13-14 cm)",
    category: "Végétaux",
    image: aromatiques,
    images: [aromatiques],
    price: 0,
    discount: 20,
  },
  {
    id: "cat-mediterraneennes",
    ref: "Méditerranéennes",
    name: "Plantes méditerranéennes & agrumes (olivier, citronnier…)",
    category: "Végétaux",
    image: olivier,
    images: [olivier],
    price: 0,
    discount: 15,
  },

  // ============ Tarifs catalogue à l'unité ============
  {
    id: "cat-175354",
    ref: "175354",
    name: "Terreau plantes fleuries 40 L — Fertiligène (2+1)",
    category: "Terreaux & Paillage",
    image: terreauFleuries,
    images: [terreauFleuries],
    price: 12.95,
    oldPrice: 12.96,
    discount: 33,
  },
  {
    id: "cat-187261",
    ref: "187261",
    name: "Terreau horticole 70 L — AlgoFlash (2+1)",
    category: "Terreaux & Paillage",
    image: terreauFleuries,
    images: [terreauFleuries],
    price: 16.95,
    oldPrice: 16.96,
    discount: 33,
  },
  {
    id: "cat-192063",
    ref: "192063",
    name: "Écorces de pin 80 L — Teragile (2+1)",
    category: "Terreaux & Paillage",
    image: ecorcesPin,
    images: [ecorcesPin],
    price: 17.5,
    oldPrice: 17.51,
    discount: 33,
  },
  {
    id: "cat-048199",
    ref: "048199",
    name: "Fulgosol 20 kg — amendement organique",
    category: "Terreaux & Paillage",
    image: fulgosol,
    images: [fulgosol],
    price: 12.9,
    discount: 0,
  },
  {
    id: "cat-079532",
    ref: "079532",
    name: "Terreau Géraniums & plantes fleuries 50 L",
    category: "Terreaux & Paillage",
    image: terreauGeraniums,
    images: [terreauGeraniums],
    price: 7.95,
    discount: 0,
  },
  {
    id: "cat-020645",
    ref: "020645",
    name: "Terreau agrumes & plantes méditerranéennes 40 L",
    category: "Terreaux & Paillage",
    image: terreauAgrumes,
    images: [terreauAgrumes],
    price: 8.5,
    discount: 0,
  },
  {
    id: "cat-145342",
    ref: "145342",
    name: "Pulvérisateur 7 désherbage 5 L — Teragile",
    category: "Outillage",
    image: pulverisateur,
    images: [pulverisateur],
    price: 33.9,
    discount: 0,
  },
  {
    id: "cat-140198",
    ref: "140198",
    name: "Haricot vert Oxinel 220 g — Vilmorin",
    category: "Graines & Semences",
    image: haricotVilmorin,
    images: [haricotVilmorin],
    price: 12.95,
    discount: 0,
  },
];
