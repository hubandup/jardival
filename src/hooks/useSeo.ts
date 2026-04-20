import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const JSONLD_ID = "seo-jsonld";

export function useSeo({ title, description, canonical, image, type = "website", jsonLd }: SeoOptions) {
  useEffect(() => {
    const trimmedTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = trimmedTitle;

    if (description) {
      const desc = description.length > 160 ? description.slice(0, 157) + "…" : description;
      upsertMeta("name", "description", desc);
      upsertMeta("property", "og:description", desc);
      upsertMeta("name", "twitter:description", desc);
    }

    upsertMeta("property", "og:title", trimmedTitle);
    upsertMeta("name", "twitter:title", trimmedTitle);
    upsertMeta("property", "og:type", type);
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");

    const url = canonical || window.location.href;
    upsertLink("canonical", url);
    upsertMeta("property", "og:url", url);

    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
    }

    if (jsonLd) {
      let script = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = JSONLD_ID;
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      const script = document.getElementById(JSONLD_ID);
      if (script) script.remove();
    };
  }, [title, description, canonical, image, type, JSON.stringify(jsonLd)]);
}
