/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DatasetEntry {
  id: string;
  coordinates: { lat: number; lng: number; corner: string; };
  validation?: { distanceFromCenter: number; isOutlier: boolean; cornerMismatch?: boolean; suspiciousReason?: string; computedScore?: number; issues?: string[]; h3Index?: string; };
  timestamp: string;
  lighting: { sunPosition: string; shadowDirection: string; shadowLength: string; description: string; };
  microPhysiognomy: { aerialCables: string; shutterStyle: string; treeType: string; graffiti: string; terrain: string; urbanElements: { furniture: string; vegetationScore: number; architectureStyle: string; }; temporalWindow: string; };
  ocr: { detectedText: string[]; confidence: number; rapidFuzzScore: number; };
  exif: { fStop: string; iso: number; shutterSpeed: string; focalLength: string; make: string; model: string; lensModel: string; dateTimeOriginal: string; };
  locationContext?: string;
  category?: 'Parque' | 'Restaurante' | 'Atracción' | 'Comercial' | 'Calle/Intersección' | 'Transporte Público' | 'Otros';
  groundedFromAnchor?: string;
}

export interface LocationAnchor {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

export let isSpendingCapExceeded = false;
let userProvidedApiKey = localStorage.getItem('user_api_key') || undefined;

export function setCustomApiKey(key: string | undefined) {
  userProvidedApiKey = key;
  if (key) {
    localStorage.setItem('user_api_key', key);
  } else {
    localStorage.removeItem('user_api_key');
  }
}

export function getCustomApiKey() {
  return userProvidedApiKey;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const geocodeCache: Record<string, {lat: number, lng: number}> = {};

async function fetchFromApi(endpoint: string, body: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, customKey: userProvidedApiKey })
      });

      if (!res.ok) {
        let errStr = "";
        try {
          const errJSON = await res.json();
          errStr = String(errJSON.error || errJSON.message || JSON.stringify(errJSON));
        } catch (parseError) {
          errStr = await res.text();
        }
        const status = res.status;
        const errorStr = String(errStr || status);
        
        const isRetryable = status === 429 || status === 503 || status === 504 || 
                           errorStr.includes("429") || errorStr.includes("503") || 
                           errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");
                           
        if (isRetryable) {
          if (errorStr.includes("spending cap")) {
            isSpendingCapExceeded = true;
            throw new Error("EXCEEDED_SPENDING_CAP");
          }
          if (i < retries - 1) {
            await delay(Math.pow(2, i) * 1000 + Math.random() * 500);
            continue;
          }
        } else {
          // If not retryable, throw immediately so we don't delay and retry 3 times
          throw new Error(errorStr);
        }
        throw new Error(errorStr);
      }
      const responseText = await res.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 50)}...`);
      }
    } catch (e: any) {
      if (e.message === "EXCEEDED_SPENDING_CAP" || e.message?.includes("Invalid JSON response")) throw e;
      if (i === retries - 1) throw e;
      await delay(Math.pow(2, i) * 1000 + Math.random() * 500);
    }
  }
  throw new Error("API request failed after retries.");
}

export async function parseLocations(input: string, retries = 3): Promise<string[]> {
  try {
    return await fetchFromApi("/api/parse", { input }, retries);
  } catch (e) {
    return input.split(";").map(s => s.trim()).filter(Boolean);
  }
}

export async function validateGeocoordinatesBatch(
  batch: DatasetEntry[], 
  location: string, 
  usePro = false, 
  retries = 3
): Promise<Record<string, {isMismatch: boolean, reason?: string}>> {
  try {
    return await fetchFromApi("/api/validate", { batch, location, usePro }, retries);
  } catch (e) {
    return {};
  }
}

async function fallbackNominatim(location: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.warn('Geocoding fallback failed', error);
  }
  return null;
}

export async function geocodeLocation(location: string, retries = 3): Promise<{lat: number, lng: number} | null> {
  const trimmed = location.trim().toLowerCase();
  if (geocodeCache[trimmed]) return geocodeCache[trimmed];

  try {
    const coords = await fetchFromApi("/api/geocode", { location }, retries);
    if (coords && coords.lat && coords.lng) {
      geocodeCache[trimmed] = coords;
      return coords;
    }
  } catch (e) {
    return fallbackNominatim(location);
  }
  return fallbackNominatim(location);
}

export async function researchLocationAnchors(location: string, usePro = false): Promise<LocationAnchor[]> {
  try {
    return await fetchFromApi("/api/anchors", { location, usePro }, 1);
  } catch (e) {
    return [];
  }
}

export async function generateDatasetBatch(
  count: number,
  startIdx: number,
  location: string,
  centerCoord: { lat: number, lng: number } | null,
  usePro: boolean = false,
  retries: number = 3,
  customCenters?: { lat: number, lng: number }[],
  anchors: LocationAnchor[] = []
): Promise<DatasetEntry[]> {
  return await fetchFromApi("/api/generate", { 
    count, startIdx, location, centerCoord, usePro, customCenters, anchors 
  }, retries);
}

export async function getGeographySuggestions(query: string, retries = 3): Promise<string[]> {
  if (!query || query.length < 3) return [];
  try {
    return await fetchFromApi("/api/suggestions", { query }, retries);
  } catch (e) {
    return [];
  }
}
