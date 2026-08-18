import { createContext, useContext, type ReactNode } from "react";
import { BRANDS, DEFAULT_BRAND_ID, resolveBrand, type Brand } from "@/config/brands";

const STORAGE_KEY = "ux-diagnostic:brand";

/**
 * La marca llega en la URL del iframe (`?brand=idp`), pero solo en la primera carga:
 * al navegar al formulario o al abrir el informe desde el correo, el parámetro se pierde.
 * Por eso se resuelve una sola vez al arrancar y se guarda en sessionStorage, de modo que
 * el resto de la sesión conserve los colores de la agencia correcta.
 */
function readPersistedBrand(): Brand | null {
  try {
    const id = sessionStorage.getItem(STORAGE_KEY);
    return id && BRANDS[id] ? BRANDS[id] : null;
  } catch {
    // sessionStorage puede fallar dentro de un iframe con cookies de terceros bloqueadas.
    return null;
  }
}

function persistBrand(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Sin persistencia se cae al id por defecto: degradado aceptable, no vale romper la app.
  }
}

let activeBrand: Brand = BRANDS[DEFAULT_BRAND_ID];

/**
 * Aplica los tokens de la marca sobre :root. Se llama antes del primer render para que
 * no haya un parpadeo con la paleta anterior.
 */
export function initBrand(): Brand {
  const hasExplicitBrand = new URLSearchParams(window.location.search).has("brand");
  const brand = hasExplicitBrand
    ? resolveBrand(window.location.search)
    : (readPersistedBrand() ?? resolveBrand(window.location.search));

  activeBrand = brand;
  persistBrand(brand.id);

  const root = document.documentElement;
  for (const [token, value] of Object.entries(brand.tokens)) {
    root.style.setProperty(token, value);
  }
  root.dataset.brand = brand.id;

  return brand;
}

export function getActiveBrand(): Brand {
  return activeBrand;
}

const BrandContext = createContext<Brand>(BRANDS[DEFAULT_BRAND_ID]);

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
