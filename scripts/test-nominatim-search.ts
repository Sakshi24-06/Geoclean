async function test() {
  const query = 'Shivajinagar, Pune, Maharashtra, India';
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=3&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GeoClean-Civic-App/1.0', 'Accept': 'application/json' }
  });
  const data = await res.json();
  console.log('Search Results for Shivajinagar, Pune:');
  if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      console.log({
        display_name: item.display_name,
        postcode: item.address?.postcode,
        lat: item.lat,
        lon: item.lon,
        city: item.address?.city || item.address?.town,
        state: item.address?.state,
      });
    }
  } else {
    console.log('No results found.');
  }
}

test().catch(console.error);
