/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DatasetEntry {
  id: string;
  coordinates: {
    lat: number;
    lng: number;
    corner: string; // e.g., "Av. Mitre y España"
  };
  validation?: {
    distanceFromCenter: number; // in meters
    isOutlier: boolean;
    cornerMismatch?: boolean;
    suspiciousReason?: string;
    computedScore?: number;
    issues?: string[];
    h3Index?: string;
  };
  timestamp: string;
  lighting: {
    sunPosition: string;
    shadowDirection: string;
    shadowLength: string;
    description: string;
  };
  microPhysiognomy: {
    aerialCables: string;
    shutterStyle: string;
    treeType: string;
    graffiti: string;
    terrain: string;
    urbanElements: {
      furniture: string; // e.g. "Parada de colectivo 178"
      vegetationScore: number; // 0-1 confidence
      architectureStyle: string;
    };
    temporalWindow: string; // e.g. "2020-2024" (from guide section 10)
  };
  ocr: {
    detectedText: string[]; 
    confidence: number;
    rapidFuzzScore: number; // Token Set Ratio (from guide section 2)
  };
  exif: {
    fStop: string;
    iso: number;
    shutterSpeed: string;
    focalLength: string;
    make: string;
    model: string;
    lensModel: string;
    dateTimeOriginal: string;
  };
  locationContext?: string;
  category?: 'Parque' | 'Restaurante' | 'Atracción' | 'Comercial' | 'Calle/Intersección' | 'Transporte Público' | 'Otros';
  groundedFromAnchor?: string; // Nombre del hito real usado como ancla (Ground Truth)
}

import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      coordinates: {
        type: Type.OBJECT,
        properties: {
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          corner: { type: Type.STRING },
        },
        required: ["lat", "lng", "corner"],
      },
      timestamp: { type: Type.STRING },
      lighting: {
        type: Type.OBJECT,
        properties: {
          sunPosition: { type: Type.STRING },
          shadowDirection: { type: Type.STRING },
          shadowLength: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["sunPosition", "shadowDirection", "shadowLength", "description"],
      },
      microPhysiognomy: {
        type: Type.OBJECT,
        properties: {
          aerialCables: { type: Type.STRING },
          shutterStyle: { type: Type.STRING },
          treeType: { type: Type.STRING },
          graffiti: { type: Type.STRING },
          terrain: { type: Type.STRING },
          urbanElements: {
            type: Type.OBJECT,
            properties: {
              furniture: { type: Type.STRING },
              vegetationScore: { type: Type.NUMBER },
              architectureStyle: { type: Type.STRING },
            },
            required: ["furniture", "vegetationScore", "architectureStyle"],
          },
          temporalWindow: { type: Type.STRING },
        },
        required: ["aerialCables", "shutterStyle", "treeType", "graffiti", "terrain", "urbanElements", "temporalWindow"],
      },
      ocr: {
        type: Type.OBJECT,
        properties: {
          detectedText: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER },
          rapidFuzzScore: { type: Type.NUMBER },
        },
        required: ["detectedText", "confidence", "rapidFuzzScore"],
      },
      exif: {
        type: Type.OBJECT,
        properties: {
          fStop: { type: Type.STRING },
          iso: { type: Type.NUMBER },
          shutterSpeed: { type: Type.STRING },
          focalLength: { type: Type.STRING },
          make: { type: Type.STRING },
          model: { type: Type.STRING },
          lensModel: { type: Type.STRING },
          dateTimeOriginal: { type: Type.STRING },
        },
        required: ["fStop", "iso", "shutterSpeed", "focalLength", "make", "model", "lensModel", "dateTimeOriginal"],
      },
      category: { type: Type.STRING, description: "Categoría de la ubicación, e.g., 'Parque', 'Restaurante', 'Atracción', 'Comercial', 'Calle/Intersección', 'Transporte Público', 'Otros'" },
      groundedFromAnchor: { type: Type.STRING, description: "Nombre del hito real usado como ancla (puedes dejarlo vacío si no hay uno cerca)" },
    },
    required: ["id", "coordinates", "timestamp", "lighting", "microPhysiognomy", "ocr", "exif", "category"],
  },
};

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory session caches to avoid repeated identical calls
const locationParseCache: Record<string, string[]> = {};
const geocodeCache: Record<string, {lat: number, lng: number} | null> = {};

export async function parseLocations(input: string, retries = 3): Promise<string[]> {
  const trimmedInput = input.trim();
  if (locationParseCache[trimmedInput]) return locationParseCache[trimmedInput];

  const fallback = () => {
    const res = input.split(',').map(l => l.trim()).filter(l => l);
    locationParseCache[trimmedInput] = res;
    return res;
  };

  // If explicitly separated by semicolon, use that (safest)
  if (input.includes(';')) {
    return input.split(';').map(l => l.trim()).filter(l => l);
  }
  
  // Otherwise, ask Gemini to intelligently split the comma-separated string into discrete distinct locations
  const prompt = `Divide la siguiente cadena de texto en una lista de ubicaciones geográficas o lugares independientes. 
  A veces las personas usan comas para partes de la MISMA dirección (ej: "Av. Corrientes, CABA", o "Rosario, Argentina"). NO separes esos casos. Solo separa cuando claramente cambia de lugar o hay varias entidades sin relación directa.
  
  Cadena: "${input}"
  
  Devuelve SOLO un array JSON válido de strings. No agregues markdown ni explicaciones.
  Ejemplo entrada: "Madrid, Barcelona, Av. Corrientes, CABA"
  Ejemplo salida: ["Madrid", "Barcelona", "Av. Corrientes, CABA"]`;
  
  const ai = getAI();
  if (!ai) return fallback();

  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      
      const parsed = JSON.parse(response.text || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return fallback();
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) + " " + String(error.message) : String(error);
      if (errorStr.includes("spending cap")) {
        isSpendingCapExceeded = true;
        return fallback();
      }

      const isRetryable = error.status === 429 || error.status === 503 || error.status === 504 || 
                          errorStr.includes("429") || errorStr.includes("503") || 
                          errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");

      if (isRetryable) {
        if (i < retries - 1) {
          const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000;
          await delay(waitTime);
          continue;
        }
      }
      // Internal parsing failure, silent fallback
      break;
    }
  }
  
  return fallback();
}
export let isSpendingCapExceeded = false;
let modelForbidden = false;

export async function validateGeocoordinatesBatch(batch: DatasetEntry[], location: string, usePro = false, retries = 3): Promise<Record<string, {isMismatch: boolean; reason: string}>> {
  if (!batch || batch.length === 0) return {};

  const payload = batch.map(e => ({
    id: e.id,
    corner: e.coordinates.corner,
    lat: e.coordinates.lat,
    lng: e.coordinates.lng,
    distanceFromCenter: e.validation?.distanceFromCenter,
    context: {
      architecture: e.microPhysiognomy.urbanElements.architectureStyle,
      furniture: e.microPhysiognomy.urbanElements.furniture,
      vegetation: e.microPhysiognomy.treeType,
      ocr: e.ocr.detectedText.slice(0, 3) 
    }
  }));

  const prompt = `Actúa como un experto cartógrafo, geógrafo y analista de fisionomía urbana. 
  Tu tarea es validar si el siguiente lote de datos sintéticos es REALMENTE COHERENTE con la ubicación solicitada: "${location}".
  
  Criterios de Validación (Peligro de Alucinación):
  1. COHERENCIA GEOGRÁFICA: ¿La dirección/intersección en 'corner' existe realmente en "${location}"? ¿Las coordenadas lat/lng coinciden razonablemente con esa dirección?
  2. COHERENCIA URBANA: ¿El estilo de arquitectura, mobiliario y vegetación descritos en 'context' son típicos de "${location}"? (Ej: No debería haber arquitectura colonial española en Tokyo, ni palmeras en el Ártico).
  3. RED VIAL Y LANDMARKS: ¿Los nombres de las calles o hitos mencionados en el 'furniture' u 'ocr' son verídicos para esa ciudad?
  4. CONSISTENCIA CULTURAL/IDIOMÁTICA: ¿El texto detectado en 'ocr' está en el idioma predominante de "${location}"? ¿Los nombres de mobiliario urbano (ej. "parada de bus") usan la terminología local correcta (ej: "colectivo" en Argentina vs "guagua" en Canarias)?
  
  ERROR CRÍTICO: Si detectas que los nombres de las calles o el uso de regionalismos CORRESPONDEN A OTRA CIUDAD o país distinto de "${location}", marca 'isMismatch: true' inmediatamente.
  
  Devuelve un objeto JSON donde las claves son los IDs ("REF-XXXX") y los valores son:
  { 
    "isMismatch": boolean, 
    "reason": "Explicación técnica detallada (max 15 palabras). Ej: 'Intersección inexistente en esta ciudad' o 'Estilo arquitectónico incompatible con la zona'." 
  }
  
  Lote de Datos:
  ${JSON.stringify(payload, null, 2)}`;

  for (let i = 0; i < retries; i++) {
      try {
        const ai = getAI();
        if (!ai) return {};
        let modelToUse = (usePro && !modelForbidden) ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
        // Even with a paid key, we prefer Flash for batch validation to save costs
        if (batch.length > 5) modelToUse = 'gemini-3-flash-preview'; 
        if (i > 0) modelToUse = 'gemini-3-flash-preview'; // fallback on retry
        const response = await ai.models.generateContent({
          model: modelToUse, 
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              additionalProperties: {
                type: Type.OBJECT,
                properties: {
                  isMismatch: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING }
                },
                required: ["isMismatch", "reason"]
              }
            }
          }
        });

        let text = response.text || "{}";
        text = text.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
        
        try {
          return JSON.parse(text) as Record<string, {isMismatch: boolean; reason: string}>;
        } catch (jsonErr) {
          // Truncation fix attempt
          if (text.lastIndexOf('}') < text.length - 1) {
             const fixed = text.substring(0, text.lastIndexOf('}') + 1);
             try { return JSON.parse(fixed); } catch(e) {}
          }
          throw jsonErr;
        }
      } catch (error: any) {
        const errorStr = String(error.message || error);
        
        if (usePro && (error.status === 404 || errorStr.includes("not found") || errorStr.includes("not supported"))) {
          modelForbidden = true; // Stop trying Pro for this session
          return validateGeocoordinatesBatch(batch, location, false, retries);
        }

        if (error.status === 429 || error.status === 503 || error.status === 504 || errorStr.includes("429") || errorStr.includes("503") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline")) {
          if (errorStr.includes("spending cap")) {
            isSpendingCapExceeded = true;
            return {};
          }
          if (i < retries - 1) {
            const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
            await delay(waitTime);
            continue;
          }
        }
        return {};
      }
  }
  return {};
}

export async function geocodeLocation(location: string, retries = 3): Promise<{lat: number, lng: number} | null> {
  const trimmed = location.trim().toLowerCase();
  if (geocodeCache[trimmed]) return geocodeCache[trimmed];

  const ai = getAI();
  if (!ai) return fallbackNominatim(location);

  for (let i = 0; i < retries; i++) {
    try {
      const modelToUse = 'gemini-3-flash-preview';
      const aiResponse = await ai.models.generateContent({
        model: modelToUse,
        contents: `TAREA: Geolocalización de PRECISIÓN EXTREMA (Error máximo permitido: 20 metros).
        UBICACIÓN SOLICITADA: "${location}"
        
        INSTRUCCIONES CRÍTICAS:
        1. Usa GOOGLE SEARCH para encontrar la ubicación exacta.
        2. Si es una INTERSECCIÓN o CRUCE (ej: "Calle X y Calle Y"):
           - NO devuelvas el centro de la ciudad.
           - NO devuelvas un edificio a la redonda si no es el punto exacto.
           - Busca el cruce de ejes de ambas calles.
        3. Si hay varias ciudades con el mismo nombre de calle, prioriza la ciudad de CORRIENTES, ARGENTINA (o la provincia mencionada en la búsqueda).
        4. Extrae las coordenadas directamente de los fragmentos de Google Maps o resultados de OpenStreetMap que aparezcan en la búsqueda.
        
        Devuelve un objeto JSON con el formato {"lat": número, "lng": número}.`,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER }
            },
            required: ["lat", "lng"]
          }
        }
      });

      // Strip markdown formatting if any
      let text = aiResponse.text || "{}";
      text = text.replace(/```[A-Za-z0-9]*\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        const result = { lat: parsed.lat, lng: parsed.lng };
        geocodeCache[trimmed] = result;
        return result;
      }
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) + " " + String(error.message) : String(error);
      if (errorStr.includes("spending cap")) {
        isSpendingCapExceeded = true;
        return null;
      }
      
      const isRetryable = error.status === 429 || error.status === 503 || error.status === 504 || 
                          errorStr.includes("429") || errorStr.includes("503") || 
                          errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");

      if (isRetryable) {
        if (i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1500 + Math.random() * 500;
          await delay(waitTime);
          continue;
        }
      }
      
      console.error('Gemini geocoding failed, falling back to nominatim', error);
      break;
    }
  }

  return fallbackNominatim(location);
}

async function fallbackNominatim(location: string): Promise<{lat: number, lng: number} | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'Reverse-Geocoding-Applet/1.0'
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.warn('Geocoding fallback failed', error);
  }
  return null;
}

export interface LocationAnchor {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

export async function researchLocationAnchors(location: string, usePro = false): Promise<LocationAnchor[]> {
  const ai = getAI();
  if (!ai) return [];

  const modelToUse = (usePro && !modelForbidden) ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
  const prompt = `Actúa como un experto en SIG (Sistemas de Información Geográfica). 
  Para la ubicación: "${location}", identifica 5-8 puntos de interés REALES (monumentos, plazas, intersecciones famosas, edificios públicos).
  Devuelve un array JSON de objetos con: { "name": string, "lat": number, "lng": number, "type": string }.
  Asegúrate de que las coordenadas sean lo más precisas posible según tu base de datos de conocimiento (OpenStreetMap/Wiki).`;

  try {
    const result = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              type: { type: Type.STRING }
            },
            required: ["name", "lat", "lng", "type"]
          }
        }
      }
    });

    if (!result.text) return [];
    return JSON.parse(result.text);
  } catch (e) {
    console.error("Error researching anchors:", e);
    return [];
  }
}

export async function generateDatasetBatch(
  count: number, 
  startIndex: number, 
  location: string, 
  centerCoordinates: {lat: number, lng: number} | null = null, 
  usePro = false, 
  retries = 3,
  customCenters?: {lat: number, lng: number}[],
  anchors?: LocationAnchor[]
): Promise<DatasetEntry[]> {
  let precalculatedCoordinates = '';
  let anchorContext = '';
  
  if (anchors && anchors.length > 0) {
    anchorContext = "\n\nHITOS DE VERDAD (GROUND TRUTH) DE REFERENCIA EN LA ZONA:\n";
    anchors.forEach(a => {
      anchorContext += `- ${a.name} (${a.type}) en Lat: ${a.lat}, Lng: ${a.lng}\n`;
    });
    anchorContext += "\nUSA ESTOS HITOS PARA GENERAR DETALLES REALISTAS (OCR, fisionomía) SI LOS PUNTOS ESTÁN CERCA DE ELLOS. Incluye el nombre del hito en 'groundedFromAnchor' si el punto está a menos de 50m.";
  }

  if (customCenters && customCenters.length > 0) {
    precalculatedCoordinates = "\n\nLISTA DE COORDENADAS PRECALCULADAS A USAR OBLIGATORIAMENTE PARA CADA ID:\n";
    customCenters.forEach((center, i) => {
      precalculatedCoordinates += `- ID: REF-${startIndex + i} -> Lat: ${center.lat.toFixed(6)}, Lng: ${center.lng.toFixed(6)}\n`;
    });
  } else if (centerCoordinates) {
    const isCorner = /esquina|cruce|intersecci|y /i.test(location);
    const variationMax = isCorner ? 0.0001 : (/barrio|zona/i.test(location) ? 0.0013 : 0.0003);
    
    precalculatedCoordinates = "\n\nLISTA DE COORDENADAS PRECALCULADAS A USAR OBLIGATORIAMENTE PARA CADA ID:\n";
    for(let i=0; i<count; i++) {
        const r = variationMax * Math.sqrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const lat = centerCoordinates.lat + r * Math.cos(theta);
        const lng = centerCoordinates.lng + r * Math.sin(theta);
        precalculatedCoordinates += `- ID: REF-${startIndex + i} -> Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}\n`;
    }
  }

  const centerText = (customCenters && customCenters.length > 0)
    ? `\n  - PASO 1 (GEOVALLA): El usuario ha definido una geovalla específica. DEBES usar EXACTAMENTE las coordenadas asignadas a cada ID en la lista precalculada.`
    : centerCoordinates 
      ? `\n  - PASO 1 (BLOQUEADO): La ubicación "${location}" corresponde EXACTAMENTE a las coordenadas centrales Lat: ${centerCoordinates.lat}, Lng: ${centerCoordinates.lng}.\n  - PASO 2: Tienes una LISTA DE COORDENADAS PRECALCULADAS abajo. DEBES usar EXACTAMENTE las coordenadas asignadas a cada ID. NO INVENTES COORDENADAS NUEVAS.`
      : `\n  - Paso 1: Determina la latitud y longitud central ("centerLat" y "centerLng") exacta para "${location}".\n  - Paso 2: Para generar cada punto del dataset, aplica una pequeña variación matemática a las coordenadas centrales.`;

  const prompt = `Actúa como un experto en geomática y visión artificial. Genera un dataset sintético de EXACTAMENTE ${count} entradas (id: REF-${startIndex} en adelante) para entrenamiento de Reverse-Geocoding en: ${location}.
  Es MANDATORIO devolver ${count} objetos en el array JSON, no omitas ni resumas ninguna entrada.
  
  REGLAS CRÍTICAS DE GEOLOCALIZACIÓN:${centerText}${anchorContext}
  - ABSOLUTAMENTE PROHIBIDO devolver lugares, calles, intersecciones o coordenadas de otras ciudades. Si el usuario pide Rosario, NO devuelvas Buenos Aires.${precalculatedCoordinates}
  
  CLAVE PARA EL FRONTEND:
  - Clasifica cada ubicación generada en una de estas categorías ("category"): 'Parque', 'Restaurante', 'Atracción', 'Comercial', 'Calle/Intersección', 'Transporte Público' u 'Otros'.
  
  Sigue la "Guía de Programación: Ingeniería Inversa Geográfica":
  1. OCR (Sección 1 & 2): Simula textos reales detectados en carteles de calles y locales verídicos de ${location} (siempre muy cerca de las coordenadas de cada ID). Genera un "rapidFuzzScore" (0-100) comparando el texto con la base oficial.
  2. Micro-fisionomía (Sección 8): Describe mobiliario, vegetación y arquitectura característica de la ubicación.
  3. Ventanas Temporales (Sección 10): Genera un campo "temporalWindow" (ej. "2018-2022") coherente.
  4. Coordenadas reales: USA LA LISTA PRECALCULADA SI EXISTE. De lo contrario, calcula una aleatorización pequeña alrededor del centro.
  5. Iluminación: Sombras exactas según posición solar correspondiente a la latitud/longitud real.
  6. EXIF: Sin GPS.
  
  Céntrate en la fisionomía específica del entorno: si es zona residencial, comercial o industrial, respetando la estética urbana local de ese país/región.`;

  for (let i = 0; i < retries; i++) {
    try {
      const ai = getAI();
      if (!ai) throw new Error("No API Key");
      let modelToUse = (usePro && !modelForbidden) ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      // Force Flash for large batches to avoid cost spikes
      if (count > 10) modelToUse = "gemini-3-flash-preview";
      if (i > 0) modelToUse = "gemini-3-flash-preview"; // fallback to flash on retry

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      if (!response.text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(response.text);
    } catch (error: any) {
        const errorStr = typeof error === 'object' ? JSON.stringify(error) + " " + String(error.message) : String(error);
        
        // Fallback to flash if Pro is not found
        if (usePro && (error.status === 404 || errorStr.includes("not found") || errorStr.includes("not supported"))) {
            modelForbidden = true;
            return generateDatasetBatch(count, startIndex, location, centerCoordinates, false, retries);
        }

        const isRetryable = error.status === 429 || error.status === 503 || error.status === 504 || 
                            errorStr.includes("429") || errorStr.includes("503") || 
                            errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");

        if (isRetryable) {
            if (errorStr.includes("spending cap")) {
                isSpendingCapExceeded = true;
                return [];
            }
            if (i < retries - 1) {
              const waitTime = Math.pow(2, i) * 2000 + Math.random() * 1000;
              await delay(waitTime);
              continue;
            }
        }
        throw error;
    }
  }
  throw new Error("Max retries reached for dataset generation due to rate limits.");
}

export async function getGeographySuggestions(query: string, retries = 3): Promise<string[]> {
  if (!query || query.length < 3) return [];

  const prompt = `Actúa como un experto en geografía. Basándote en el prefijo o consulta: "${query}", proporciona una lista de 5 nombres de lugares REALES (ej: "Palermo, Buenos Aires", "Shibuya, Tokyo", "Madrid, España"). 
  Prioriza ciudades, barrios importantes y puntos de interés famosos.
  Devuelve SOLO un array de strings en formato JSON.`;

  for (let i = 0; i < retries; i++) {
    try {
      const ai = getAI();
      if (!ai) return [];
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
        },
      });

      if (!response.text) return [];
      const cleaned = response.text.trim();
      return JSON.parse(cleaned);
    } catch (error: any) {
        const errorStr = String(error.message || error);
        
        const isRetryable = error.status === 429 || error.status === 503 || error.status === 504 || 
                            errorStr.includes("429") || errorStr.includes("503") || 
                            errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("Deadline");

        if (isRetryable) {
            if (errorStr.includes("spending cap")) {
                isSpendingCapExceeded = true;
                return [];
            }
            if (i < retries - 1) {
              const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
              await delay(waitTime);
              continue;
            }
        }
        console.warn("Suggestions error:", errorStr);
        return [];
    }
  }
  return [];
}
