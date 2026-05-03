import { useCallback, useEffect, useState } from "react";
import type { Store } from "@/data/stores";

const STORAGE_KEY = "jardival:selectedStore";

const read = (): Store | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Store;
  } catch {
    return null;
  }
};

const write = (store: Store | null) => {
  try {
    if (store) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent("selectedStore:change"));
  } catch {
    // ignore
  }
};

export const useSelectedStore = () => {
  const [store, setStore] = useState<Store | null>(() => read());

  useEffect(() => {
    const sync = () => setStore(read());
    window.addEventListener("selectedStore:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("selectedStore:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((s: Store | null) => {
    write(s);
    setStore(s);
  }, []);

  return { store, select };
};
