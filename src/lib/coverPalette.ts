// Extrait une palette dominante d'une image (charge en CORS, downscale puis k-clusters simples).
// Renvoie 3 couleurs HSL prêtes à être injectées dans des variables CSS.

export interface HeroPalette {
  primary: string; // HSL "h s% l%"
  secondary: string;
  accent: string;
  foreground: string; // dark or light, pour le texte
}

const SAMPLE_SIZE = 80;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslString(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

export async function extractCoverPalette(
  imageUrl: string,
): Promise<HeroPalette | null> {
  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    const ratio = img.width / img.height || 1;
    canvas.width = SAMPLE_SIZE;
    canvas.height = Math.round(SAMPLE_SIZE / ratio);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Bucket par teinte (12 bins) + saturation/luminosité moyennes pondérées.
    const bins = new Map<
      number,
      { count: number; h: number; s: number; l: number }
    >();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      // Ignore quasi-noir, quasi-blanc et désaturé fade.
      if (l < 8 || l > 94) continue;
      if (s < 12) continue;
      const bin = Math.floor(h / 30); // 12 bins de 30°
      const cur = bins.get(bin) ?? { count: 0, h: 0, s: 0, l: 0 };
      cur.count += 1;
      cur.h += h;
      cur.s += s;
      cur.l += l;
      bins.set(bin, cur);
    }

    if (bins.size === 0) return null;

    const sorted = Array.from(bins.values())
      .map((b) => ({
        count: b.count,
        h: Math.round(b.h / b.count),
        s: Math.round(b.s / b.count),
        l: Math.round(b.l / b.count),
      }))
      .sort((a, b) => b.count - a.count);

    const top = sorted[0];
    const second = sorted[1] ?? top;
    // Accent : choix d'une teinte contrastée (h éloigné de top, ou complémentaire).
    const complementary = (top.h + 180) % 360;
    const accent =
      sorted.find((c) => Math.abs(c.h - complementary) < 40 && c.s > 30) ??
      sorted[2] ?? {
        h: complementary,
        s: Math.max(top.s, 60),
        l: 45,
      };

    // Normalise pour un fond lumineux mais chaleureux (clamp).
    const primary = {
      h: top.h,
      s: Math.min(95, Math.max(60, top.s)),
      l: Math.min(70, Math.max(48, top.l)),
    };
    const secondary = {
      h: second.h,
      s: Math.min(90, Math.max(45, second.s)),
      l: Math.min(75, Math.max(45, second.l)),
    };
    const accentN = {
      h: accent.h,
      s: Math.min(95, Math.max(50, accent.s)),
      l: Math.min(55, Math.max(35, accent.l)),
    };

    // Foreground : sombre si fond clair, clair si fond sombre.
    const fg = primary.l > 55 ? "20 14% 12%" : "0 0% 98%";

    return {
      primary: hslString(primary.h, primary.s, primary.l),
      secondary: hslString(secondary.h, secondary.s, secondary.l),
      accent: hslString(accentN.h, accentN.s, accentN.l),
      foreground: fg,
    };
  } catch (e) {
    console.warn("extractCoverPalette failed", e);
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}
