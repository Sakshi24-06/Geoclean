import { reverseGeocodeDetails } from '../src/utils/geo';

async function testGeo() {
  console.log('Testing reverse geocoding via OpenStreetMap Nominatim:');
  
  // Test 1: Sample Coordinates (e.g. Pune / Mumbai / Delhi / London)
  const puneLat = 18.5204;
  const puneLon = 73.8567;
  
  const res1 = await reverseGeocodeDetails(puneLat, puneLon);
  console.log('Pune (18.5204, 73.8567) result:', res1);

  const delhiLat = 28.6139;
  const delhiLon = 77.2090;
  const res2 = await reverseGeocodeDetails(delhiLat, delhiLon);
  console.log('Delhi (28.6139, 77.2090) result:', res2);

  console.log('Geo reverse geocoding test completed successfully.');
}

testGeo().catch(console.error);
