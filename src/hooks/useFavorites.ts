import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jardival:favorites";

const read = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const write = (ids: string[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("favorites:change"));
  } catch {
    // ignore
  }
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>(() => read());

  useEffect(() => {
    const sync = () => setFavorites(read());
    window.addEventListener("favorites:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("favorites:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id)
      ? current.filter((v) => v !== id)
      : [...current, id];
    write(next);
    setFavorites(next);
    return next.includes(id);
  }, []);

  return { favorites, isFavorite, toggle };
};
