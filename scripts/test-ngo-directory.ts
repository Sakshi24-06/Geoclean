import {
  parseCategories,
  mapDbNgoToDirectoryItem,
  deduplicateNgos,
  type DbNgoRow,
} from '../src/lib/ngoService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runNgoDirectoryTests() {
  console.log('=== RUNNING NGO DIRECTORY UNIT TESTS (NO DEMO DATA) ===\n');

  // Test 1: Category parsing
  console.log('Test 1: parseCategories helper');
  const cat1 = parseCategories('Waste Management, Recycling');
  assert(cat1.length === 2 && cat1[0] === 'Waste Management' && cat1[1] === 'Recycling', 'Parses comma-separated categories');

  const cat2 = parseCategories('Cleanliness; Environment • Community Cleanup');
  assert(cat2.length === 3, 'Parses semicolon and bullet separated categories');

  const cat3 = parseCategories(null);
  assert(cat3.length === 2 && cat3[0] === 'Waste Management', 'Handles null/empty services with default categories');

  // Test 2: Database row mapping
  console.log('\nTest 2: mapDbNgoToDirectoryItem');
  const testDbRow: DbNgoRow = {
    id: 'db-ngo-1234',
    profile_id: 'user-prof-5678',
    ngo_name: 'Pune Green Warriors',
    address: 'Kalyani Nagar, Pune',
    latitude: 18.548,
    longitude: 73.903,
    mobile_number: '+91 9876543210',
    description: 'Local neighborhood cleanup and plastic collection group.',
    website: 'https://punegreenwarriors.org',
    services: 'Recycling, Community Cleanup',
    created_at: new Date().toISOString(),
    profiles: {
      id: 'user-prof-5678',
      full_name: 'Rohan Sharma',
      email: 'rohan@punegreenwarriors.org',
      mobile_number: '+91 9876543210',
    },
  };

  const mapped = mapDbNgoToDirectoryItem(testDbRow);
  assert(mapped.id === 'db-ngo-1234', 'Mapped database ID correctly');
  assert(mapped.name === 'Pune Green Warriors', 'Mapped NGO name correctly');
  assert(mapped.location === 'Kalyani Nagar, Pune', 'Mapped address correctly');
  assert(mapped.categories.includes('Recycling') && mapped.categories.includes('Community Cleanup'), 'Mapped categories correctly');
  assert(mapped.phone === '+91 9876543210', 'Mapped phone correctly');
  assert(mapped.email === 'rohan@punegreenwarriors.org', 'Mapped email correctly');
  assert(mapped.source === 'Registered GeoClean Partner', 'Assigned registered partner source tag');

  // Test 3: Zero Demo NGOs & Dynamic Count
  console.log('\nTest 3: Pure Database Source of Truth (0 Demo NGOs)');
  // 0 DB NGOs gives 0 items
  const emptyList = deduplicateNgos([]);
  assert(emptyList.length === 0, 'When no NGOs have registered, directory returns 0 items (no fake/demo NGOs)');

  // 1 registered NGO gives 1 item
  const oneRegistered = deduplicateNgos([mapped]);
  assert(oneRegistered.length === 1, 'When 1 NGO registers, directory shows exactly 1 organization');
  assert(oneRegistered[0].name === 'Pune Green Warriors', 'Registered NGO appears correctly');

  // Discards legacy demo IDs
  const legacyDemoNgo = {
    id: 'ngo-default-swach',
    name: 'SWaCH Waste Management',
    location: 'Pune',
    categories: ['Waste Management'],
    description: 'Legacy demo entry',
    activities: 'Legacy',
    website: '',
    source: 'Demo',
  };
  const filteredLegacy = deduplicateNgos([legacyDemoNgo, mapped]);
  assert(filteredLegacy.length === 1 && filteredLegacy[0].id === 'db-ngo-1234', 'Legacy demo NGOs are completely filtered out');

  // 2 registered NGOs gives 2 items
  const testDbRow2: DbNgoRow = {
    id: 'db-ngo-5678',
    profile_id: 'user-prof-9999',
    ngo_name: 'Clean Pune Mission',
    address: 'Kothrud, Pune',
    mobile_number: '+91 9123456780',
    description: 'Community-led waste segregation and collection.',
    website: 'https://cleanpune.org',
    services: 'Waste Management, Cleanliness',
    created_at: new Date().toISOString(),
  };
  const mapped2 = mapDbNgoToDirectoryItem(testDbRow2);
  const twoRegistered = deduplicateNgos([mapped, mapped2]);
  assert(twoRegistered.length === 2, 'When 2 NGOs register, count dynamically shows 2 organizations');

  // Test 4: Search & Category Filter simulation
  console.log('\nTest 4: Search and Filter Simulation');
  const searchResults = twoRegistered.filter((ngo) =>
    `${ngo.name} ${ngo.location} ${ngo.categories.join(' ')} ${ngo.description}`.toLowerCase().includes('kothrud')
  );
  assert(searchResults.length === 1 && searchResults[0].name === 'Clean Pune Mission', 'Search matches registered NGO location');

  const filterRecycling = twoRegistered.filter((ngo) =>
    ngo.categories.some((c) => c.toLowerCase().includes('recycling'))
  );
  assert(filterRecycling.length === 1 && filterRecycling[0].name === 'Pune Green Warriors', 'Filter matches categories of registered NGO');

  console.log('\n=== ALL NGO DIRECTORY UNIT TESTS PASSED ===');
}

void runNgoDirectoryTests();
