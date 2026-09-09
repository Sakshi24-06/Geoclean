export interface GeoLocationDetails {
  area?: string;
  locality?: string;
  landmark?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  formattedAddress: string;
}

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  readableAddress: string;
  details?: GeoLocationDetails;
  reverseGeocodingFailed?: boolean;
  accuracy?: number;
  timestamp: string;
}

export interface AddressLookupResult {
  pincode?: string;
  latitude?: number;
  longitude?: number;
  resolvedAddress?: string;
}

/**
 * Reverse geocodes latitude and longitude into structured human-readable location details.
 * Uses OpenStreetMap Nominatim with free/open structured API.
 */
export async function reverseGeocodeDetails(latitude: number, longitude: number): Promise<GeoLocationDetails | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GeoClean-Civic-App/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
        const area = addr.suburb || addr.neighbourhood || addr.residential || addr.subdivision || addr.quarter || addr.village || addr.hamlet || '';
        const locality = addr.city || addr.town || addr.municipality || addr.city_district || addr.suburb || '';
        const city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || '';
        const district = addr.state_district || addr.district || addr.county || city || '';
        const state = addr.state || '';
        const rawPin = addr.postcode ? String(addr.postcode).replace(/\D/g, '').slice(0, 6) : '';
        const pincode = rawPin.length === 6 ? rawPin : undefined;
        const country = addr.country || 'India';

        // Build clean formatted address
        const parts = [street, area, locality || city, [state, pincode].filter(Boolean).join(' '), country].filter(Boolean);
        const formattedAddress = parts.length >= 2 ? parts.join(', ') : (data.display_name || 'Location Address');

        return {
          street: street || undefined,
          area: area || undefined,
          locality: locality || city || undefined,
          city: city || undefined,
          district: district || undefined,
          state: state || undefined,
          pincode,
          country,
          formattedAddress,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Free asynchronous address & PIN code lookup using OpenStreetMap Nominatim.
 */
export async function lookupPostalCodeFromAddress(fields: {
  street?: string;
  landmark?: string;
  area?: string;
  locality?: string;
  district?: string;
  state?: string;
  country?: string;
}): Promise<AddressLookupResult | null> {
  const parts = [fields.street, fields.area, fields.locality, fields.district, fields.state, fields.country || 'India'].filter(Boolean);
  if (parts.length < 2) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const query = parts.join(', ');
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=3&q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GeoClean-Civic-App/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const rawPostcode = item.address?.postcode;
          if (rawPostcode) {
            const cleanPin = String(rawPostcode).replace(/\D/g, '').slice(0, 6);
            if (cleanPin.length === 6) {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              return {
                pincode: cleanPin,
                latitude: !isNaN(lat) ? lat : undefined,
                longitude: !isNaN(lon) ? lon : undefined,
                resolvedAddress: item.display_name,
              };
            }
          }
        }
      }
    }
  } catch {}

  // Fallback broader search with area + district + state
  if (fields.area || fields.locality || fields.district) {
    try {
      const fallbackParts = [fields.area || fields.locality, fields.district, fields.state, 'India'].filter(Boolean);
      if (fallbackParts.length >= 2) {
        const query2 = fallbackParts.join(', ');
        const url2 = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=3&q=${encodeURIComponent(query2)}`;
        const res2 = await fetch(url2, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'GeoClean-Civic-App/1.0',
          },
        });
        if (res2.ok) {
          const data2 = await res2.json();
          if (Array.isArray(data2) && data2.length > 0) {
            for (const item of data2) {
              const rawPostcode = item.address?.postcode;
              if (rawPostcode) {
                const cleanPin = String(rawPostcode).replace(/\D/g, '').slice(0, 6);
                if (cleanPin.length === 6) {
                  return {
                    pincode: cleanPin,
                    latitude: parseFloat(item.lat) || undefined,
                    longitude: parseFloat(item.lon) || undefined,
                    resolvedAddress: item.display_name,
                  };
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Legacy reverseGeocode for quick fallback strings.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const details = await reverseGeocodeDetails(latitude, longitude);
  if (details && details.formattedAddress) {
    return details.formattedAddress;
  }
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lngDir = longitude >= 0 ? 'E' : 'W';
  return `Geo Location (${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lngDir})`;
}

/**
 * Solicits high-accuracy GPS coordinates from the device and resolves
 * a human-readable address with area, city, state, and pincode.
 */
export function getCurrentGeoLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = new Date().toISOString();
        const details = await reverseGeocodeDetails(latitude, longitude);
        
        if (details) {
          resolve({
            latitude,
            longitude,
            readableAddress: details.formattedAddress,
            details,
            reverseGeocodingFailed: false,
            accuracy,
            timestamp,
          });
        } else {
          // GPS coordinates obtained, but reverse geocoding failed
          resolve({
            latitude,
            longitude,
            readableAddress: '',
            reverseGeocodingFailed: true,
            accuracy,
            timestamp,
          });
        }
      },
      (error) => {
        let message = 'Unable to detect your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission is required to detect your current location. Please allow location access in your browser or use "Add Location" instead.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable on this device.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please try again.';
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}
