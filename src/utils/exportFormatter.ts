import { DatasetEntry } from '../services/geminiService';

export interface FormattedPOI {
  name: string;
  title: string;
  category: 'monumento' | 'hotel' | 'restaurante' | 'transporte' | 'actividad' | 'naturaleza';
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  address: string;
  date: string;
  [key: string]: any;
}

export function parseCityAndCountry(locationStr: string): { city: string; country: string } {
  if (!locationStr || !locationStr.trim()) {
    return { city: 'Ciudad General', country: 'País de Referencia' };
  }
  const parts = locationStr.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { city: parts[0], country: parts[parts.length - 1] };
  } else if (parts.length === 2) {
    return { city: parts[0], country: parts[1] };
  } else if (parts.length === 1) {
    return { city: parts[0], country: parts[0] };
  }
  return { city: 'Ubicación Local', country: 'País de Referencia' };
}

export function normalizeCategory(cat?: string): 'monumento' | 'hotel' | 'restaurante' | 'transporte' | 'actividad' | 'naturaleza' {
  if (!cat) return 'monumento';
  const c = cat.toLowerCase().trim();
  if (c.includes('hotel') || c.includes('alojamiento') || c.includes('hostal') || c.includes('resort') || c.includes('inn')) {
    return 'hotel';
  }
  if (c.includes('restaurante') || c.includes('cafe') || c.includes('café') || c.includes('bar') || c.includes('comida') || c.includes('gastronom') || c.includes('food')) {
    return 'restaurante';
  }
  if (c.includes('transporte') || c.includes('calle') || c.includes('interseccion') || c.includes('intersección') || c.includes('estacion') || c.includes('estación') || c.includes('metro') || c.includes('tren') || c.includes('avenida')) {
    return 'transporte';
  }
  if (c.includes('naturaleza') || c.includes('parque') || c.includes('plaza') || c.includes('jardin') || c.includes('jardín') || c.includes('bosque') || c.includes('rio') || c.includes('río') || c.includes('playa') || c.includes('reserva')) {
    return 'naturaleza';
  }
  if (c.includes('monumento') || c.includes('museo') || c.includes('iglesia') || c.includes('catedral') || c.includes('castillo') || c.includes('palacio') || c.includes('atraccion') || c.includes('atracción') || c.includes('historico') || c.includes('histórico')) {
    return 'monumento';
  }
  if (c.includes('actividad') || c.includes('comercial') || c.includes('tienda') || c.includes('comercio') || c.includes('shopping') || c.includes('tour') || c.includes('ocio')) {
    return 'actividad';
  }
  return 'monumento';
}

export function formatDateTime(rawDate?: string): string {
  if (!rawDate) {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(rawDate.trim())) {
    return rawDate.trim();
  }

  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const YYYY = d.getUTCFullYear();
      const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
      const DD = String(d.getUTCDate()).padStart(2, '0');
      const HH = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${YYYY}-${MM}-${DD} ${HH}:${mm}`;
    }
  } catch {}

  const match = rawDate.match(/(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  }

  const now = new Date();
  return `${now.getFullYear()}-01-15 10:30`;
}

export function formatEntryForExport(entry: DatasetEntry, defaultLocation = ''): FormattedPOI {
  const locCtx = entry.locationContext || defaultLocation;
  const { city: parsedCity, country: parsedCountry } = parseCityAndCountry(locCtx);

  // 1. "name": Nombre completo y preciso del lugar/comercio/monumento (NUNCA dejar vacío o "Desconocido").
  let name = (entry.name || '').trim();
  if (!name || name.toLowerCase() === 'desconocido' || name.toLowerCase() === 'unknown') {
    if (entry.groundedFromAnchor && entry.groundedFromAnchor.trim() && entry.groundedFromAnchor.toLowerCase() !== 'desconocido') {
      name = entry.groundedFromAnchor.trim();
    } else if (entry.ocr?.detectedText && entry.ocr.detectedText.length > 0) {
      const validOcr = entry.ocr.detectedText.find(t => t && t.trim().length >= 3 && !t.toLowerCase().includes('desconocido'));
      if (validOcr) name = validOcr.trim();
    }
  }
  if (!name || name.toLowerCase() === 'desconocido' || name.toLowerCase() === 'unknown') {
    if (entry.coordinates?.corner && entry.coordinates.corner.trim()) {
      name = entry.coordinates.corner.trim();
    } else {
      name = `Hito en ${parsedCity} #${entry.id}`;
    }
  }

  // 2. "title": Título descriptivo corto del hito.
  let title = (entry.title || '').trim();
  if (!title) {
    if (entry.coordinates?.corner && entry.coordinates.corner.trim()) {
      title = entry.coordinates.corner.trim();
    } else {
      title = `${name} (${entry.id})`;
    }
  }

  // 3. "category": Categoría (monumento, hotel, restaurante, transporte, actividad, naturaleza).
  const category = normalizeCategory(entry.category);

  // 4. "latitude": Latitud en formato decimal WGS84.
  const latitude = typeof entry.coordinates?.lat === 'number' 
    ? entry.coordinates.lat 
    : typeof entry.latitude === 'number' 
    ? entry.latitude 
    : 0;

  // 5. "longitude": Longitud en formato decimal WGS84.
  const longitude = typeof entry.coordinates?.lng === 'number' 
    ? entry.coordinates.lng 
    : typeof entry.longitude === 'number' 
    ? entry.longitude 
    : 0;

  // 6. "city": Ciudad o municipio correspondiente.
  const city = (entry.city || parsedCity || 'Ciudad').trim();

  // 7. "country": País correspondiente.
  const country = (entry.country || parsedCountry || 'País').trim();

  // 8. "address": Dirección o referencia de ubicación.
  let address = (entry.address || '').trim();
  if (!address) {
    if (entry.coordinates?.corner && entry.coordinates.corner.trim()) {
      address = `${entry.coordinates.corner.trim()}, ${city}`;
    } else {
      address = `${name}, ${city}, ${country}`;
    }
  }

  // 9. "date": Fecha/hora si está vinculada a un itinerario o reserva (formato YYYY-MM-DD HH:MM).
  const rawDate = entry.date || entry.timestamp || entry.exif?.dateTimeOriginal;
  const date = formatDateTime(rawDate);

  return {
    name,
    title,
    category,
    latitude,
    longitude,
    city,
    country,
    address,
    date,
    id: entry.id,
    validation: entry.validation,
    ocr: entry.ocr,
    exif: entry.exif,
    microPhysiognomy: entry.microPhysiognomy,
    lighting: entry.lighting,
    locationContext: locCtx,
    groundedFromAnchor: entry.groundedFromAnchor
  };
}

export function generateGeoJson(entries: DatasetEntry[], defaultLocation = '') {
  const formatted = entries.map(e => formatEntryForExport(e, defaultLocation));
  return {
    type: "FeatureCollection",
    features: formatted.map(item => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude] // standard GeoJSON [longitude, latitude]
      },
      properties: {
        name: item.name,
        title: item.title,
        category: item.category,
        latitude: item.latitude,
        longitude: item.longitude,
        city: item.city,
        country: item.country,
        address: item.address,
        date: item.date,
        id: item.id,
        groundedFromAnchor: item.groundedFromAnchor,
        computedScore: item.validation?.computedScore ?? 0,
        h3Index: item.validation?.h3Index ?? ''
      }
    }))
  };
}

export function generateJson(entries: DatasetEntry[], defaultLocation = '') {
  return entries.map(e => {
    const item = formatEntryForExport(e, defaultLocation);
    // Guarantee mandatory fields are listed first in exact required order
    return {
      name: item.name,
      title: item.title,
      category: item.category,
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city,
      country: item.country,
      address: item.address,
      date: item.date,
      id: item.id,
      validation: item.validation,
      ocr: item.ocr,
      exif: item.exif,
      microPhysiognomy: item.microPhysiognomy,
      lighting: item.lighting
    };
  });
}

export function generateCsv(entries: DatasetEntry[], defaultLocation = ''): string {
  if (entries.length === 0) return '';
  const mandatoryHeaders = [
    'name',
    'title',
    'category',
    'latitude',
    'longitude',
    'city',
    'country',
    'address',
    'date'
  ];
  const additionalHeaders = ['id', 'score', 'h3Index'];
  const allHeaders = [...mandatoryHeaders, ...additionalHeaders];

  const escapeCsv = (val: any): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = entries.map(entry => {
    const item = formatEntryForExport(entry, defaultLocation);
    return [
      escapeCsv(item.name),
      escapeCsv(item.title),
      escapeCsv(item.category),
      escapeCsv(item.latitude),
      escapeCsv(item.longitude),
      escapeCsv(item.city),
      escapeCsv(item.country),
      escapeCsv(item.address),
      escapeCsv(item.date),
      escapeCsv(item.id),
      escapeCsv(item.validation?.computedScore ?? ''),
      escapeCsv(item.validation?.h3Index ?? '')
    ].join(',');
  });

  return [allHeaders.join(','), ...rows].join('\n');
}
