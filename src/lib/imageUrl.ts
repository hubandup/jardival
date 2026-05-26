export const sanitizeImageUrl = (src: string) => {
  if (!src || src.startsWith("/") || src.startsWith("data:")) return src;
  try {
    const url = new URL(src);
    url.pathname = url.pathname
      .split("/")
      .map((segment) => {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
    return url.toString();
  } catch {
    return src.replace(/ /g, "%20");
  }
};

const normalizeImageName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const imageKey = (src: string) => {
  const rawName = (() => {
    try {
      return decodeURIComponent(new URL(src).pathname.split("/").pop() ?? src);
    } catch {
      return src.split("/").pop() ?? src;
    }
  })();
  return normalizeImageName(rawName.replace(/\.[^.]+$/, "").replace(/^\d{10,}-/, ""));
};

export interface ImageAssetCandidate {
  public_url: string;
  path?: string | null;
}

export const repairImageUrl = (src: string, assets: ImageAssetCandidate[] = []) => {
  if (!src) return src;
  const key = imageKey(src);
  const match = assets.find((asset) => {
    const assetKey = imageKey(asset.path || asset.public_url);
    return assetKey === key || assetKey.endsWith(key) || key.endsWith(assetKey);
  });
  return sanitizeImageUrl(match?.public_url ?? src);
};