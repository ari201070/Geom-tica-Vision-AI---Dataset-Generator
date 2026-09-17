import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

const getAI = (customKey?: string) => {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Error handling helper
const handleApiError = (res: express.Response, error: any) => {
  const status = error.status || 500;
  const message = error.message || String(error);
  
  if (status === 400 || status === 401 || status === 403 || status === 429 || message.includes("400") || message.includes("401") || message.includes("403") || message.includes("429") || message.includes("API key not valid") || message.includes("API_KEY_INVALID") || message.includes("INVALID_ARGUMENT") || message.includes("UNAUTHENTICATED") || message.includes("invalid authentication") || message.includes("PERMISSION_DENIED") || message.includes("RESOURCE_EXHAUSTED") || message.includes("leaked")) {
    // Intentionally silence the server log for these expected rate-limit/auth errors
    // so the AI Studio error catcher doesn't trigger a "Fix it" prompt.
  } else {
    console.error("API Error:", error);
  }
  
  res.status(status).json({ error: message, status });
};

// Endpoints
app.post("/api/suggestions", async (req, res) => {
  try {
    const { query, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `Actúa como un experto en geografía. Basándote en el prefijo o consulta: "${query}", proporciona una lista de 5 nombres de lugares REALES (ej: "Palermo, Buenos Aires", "Shibuya, Tokyo", "Madrid, España"). 
  Prioriza ciudades, barrios importantes y puntos de interés famosos.
  Devuelve SOLO un array de strings en formato JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });

    const cleaned = response.text?.trim() || "[]";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/geocode", async (req, res) => {
  try {
    const { location, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `TAREA: Geolocalización de PRECISIÓN EXTREMA (Error máximo permitido: 20 metros).
        UBICACIÓN SOLICITADA: "${location}"
        
        INSTRUCCIONES CRÍTICAS:
        1. Usa GOOGLE SEARCH para encontrar la ubicación exacta.
        2. Si es una INTERSECCIÓN o CRUCE (ej: "Calle X y Calle Y"):
           - NO devuelvas el centro de la ciudad.
           - NO devuelvas un edificio a la redonda si no es el punto exacto.
           - Devuelve la coordenada EXACTA donde se cruzan ambas calles.
        3. Si es una PLAZA o PARQUE:
           - Devuelve el centro geométrico del parque.
        4. Si es un EDIFICIO o COMERCIO:
           - Devuelve la coordenada exacta de la puerta de entrada.
           
        Devuelve SOLO un JSON con "lat" y "lng". NO agregues markdown ni explicaciones.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } }
        },
      },
    });

    const cleaned = response.text?.trim() || "{}";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/anchors", async (req, res) => {
  try {
    const { location, usePro, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `Actúa como un experto en SIG (Sistemas de Información Geográfica). 
  Para la ubicación: "${location}", identifica 5-8 puntos de interés REALES (monumentos, plazas, intersecciones famosas, edificios públicos).
  Devuelve un array JSON de objetos con: { "name": string, "lat": number, "lng": number, "type": string }.
  Asegúrate de que las coordenadas sean lo más precisas posible según tu base de datos de conocimiento (OpenStreetMap/Wiki).`;

    const response = await ai.models.generateContent({
      model: usePro ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview",
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
            }
          }
        },
      },
    });

    const cleaned = response.text?.trim() || "[]";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/validate", async (req, res) => {
  try {
    const { batch, location, usePro, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `Actúa como un auditor senior de Sistemas de Información Geográfica (SIG).
  Tu tarea es auditar un lote de coordenadas y metadata generados para la ubicación general "${location}".
  
  Lote de Datos:
  ${JSON.stringify(batch, null, 2)}`;

    const response = await ai.models.generateContent({
      model: (usePro && batch.length <= 5) ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview",
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
            }
          }
        }
      },
    });

    const cleaned = response.text?.trim() || "{}";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { count, startIdx, location, centerCoord, usePro, customCenters, anchors, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `Actúa como un motor de ingeniería inversa de geocodificación.
    Genera un lote de ${count} registros simulando coordenadas reales en "${location}".
    ${centerCoord ? `Centro de referencia geográfico (coordenadas aproximadas de la zona): Lat ${centerCoord.lat}, Lng ${centerCoord.lng}. ` : ''}
    ${customCenters?.length ? `Distribuye las ubicaciones alrededor de estas coordenadas exactas: ${JSON.stringify(customCenters)}. ` : ''}
    ${anchors?.length ? `Utiliza estos puntos clave o anclas (Ground Truth): ${JSON.stringify(anchors)}. ` : ''}
    
    Genera datos hiperrealistas de micro-fisionomía, OCR (textos visibles), y condiciones de iluminación.`;

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
              detectedText: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
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
          category: { type: Type.STRING },
          groundedFromAnchor: { type: Type.STRING }
        },
        required: ["id", "coordinates", "timestamp", "lighting", "microPhysiognomy", "ocr", "exif", "category"],
      }
    };

    const response = await ai.models.generateContent({
      model: (usePro && count <= 10) ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const cleaned = response.text?.trim() || "[]";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.post("/api/parse", async (req, res) => {
  try {
    const { input, customKey } = req.body;
    const ai = getAI(customKey);
    if (!ai) return res.status(500).json({ error: "No API Key" });

    const prompt = `Analiza la siguiente cadena de texto y extrae una lista de ubicaciones o zonas de interés separadas. 
  Cadena: "${input}"
  Devuelve SOLO un array JSON válido de strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });

    const cleaned = response.text?.trim() || "[]";
    res.json(JSON.parse(cleaned));
  } catch (error) {
    handleApiError(res, error);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
