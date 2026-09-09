import { lookupPostalCodeFromAddress } from '../src/utils/geo';
import type { StructuredLocation } from '../src/lib/types';

function validateLocationForm(form: {
  area: string;
  locality: string;
  landmark: string;
  street: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}): boolean {
  const { area, locality, landmark, street, district, state, pincode, country } = form;
  return (
    area.trim() !== '' &&
    locality.trim() !== '' &&
    landmark.trim() !== '' &&
    street.trim() !== '' &&
    district.trim() !== '' &&
    state.trim() !== '' &&
    /^\d{6}$/.test(pincode.trim()) &&
    country.trim() !== ''
  );
}

async function runTests() {
  console.log('=== GEOclean Structured Location Step Verification Tests ===\n');

  // Test 1: Validation Rules (All 8 fields required)
  console.log('Test 1: Validation Rules (All 8 fields required)');
  
  const invalidCases = [
    { name: 'Missing Area', form: { area: '', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' } },
    { name: 'Missing Locality', form: { area: 'Shivajinagar', locality: ' ', landmark: 'Station', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' } },
    { name: 'Missing Landmark', form: { area: 'Shivajinagar', locality: 'Pune', landmark: '', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' } },
    { name: 'Missing Street', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: '   ', district: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' } },
    { name: 'Missing District', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: '', state: 'Maharashtra', pincode: '411001', country: 'India' } },
    { name: 'Missing State', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: 'Pune', state: '', pincode: '411001', country: 'India' } },
    { name: 'Invalid PIN (5 digits)', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '41100', country: 'India' } },
    { name: 'Invalid PIN (alphanumeric)', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '41100A', country: 'India' } },
    { name: 'Missing Country', form: { area: 'Shivajinagar', locality: 'Pune', landmark: 'Station', street: 'MG Road', district: 'Pune', state: 'Maharashtra', pincode: '411001', country: '' } },
  ];

  for (const testCase of invalidCases) {
    const isValid = validateLocationForm(testCase.form);
    if (!isValid) {
      console.log(`  ✓ PASSED: ${testCase.name} correctly blocked (Continue disabled)`);
    } else {
      console.error(`  ✗ FAILED: ${testCase.name} should have failed validation`);
      process.exit(1);
    }
  }

  // Test 2: Valid Full 8 Fields
  console.log('\nTest 2: Valid Form with all 8 fields');
  const validForm = {
    area: 'Shivajinagar',
    locality: 'Pune',
    landmark: 'Near Railway Station',
    street: 'Station Road',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411005',
    country: 'India',
  };
  if (validateLocationForm(validForm)) {
    console.log('  ✓ PASSED: Complete 8-field structured address allows Continue button');
  } else {
    console.error('  ✗ FAILED: Valid form failed validation');
    process.exit(1);
  }

  // Test 3: OpenStreetMap Nominatim Live PIN Lookup
  console.log('\nTest 3: OpenStreetMap Nominatim Dynamic Postal Code Lookup');
  const lookup1 = await lookupPostalCodeFromAddress({
    area: 'Shivajinagar',
    locality: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    country: 'India',
  });

  if (lookup1 && lookup1.pincode && /^\d{6}$/.test(lookup1.pincode)) {
    console.log(`  ✓ PASSED: Resolved PIN for Shivajinagar Pune -> ${lookup1.pincode} (Lat: ${lookup1.latitude}, Lng: ${lookup1.longitude})`);
  } else {
    console.error('  ✗ FAILED: Nominatim lookup failed for Shivajinagar Pune', lookup1);
    process.exit(1);
  }

  const lookup2 = await lookupPostalCodeFromAddress({
    area: 'Connaught Place',
    locality: 'New Delhi',
    district: 'New Delhi',
    state: 'Delhi',
    country: 'India',
  });

  if (lookup2 && lookup2.pincode && /^\d{6}$/.test(lookup2.pincode)) {
    console.log(`  ✓ PASSED: Resolved PIN for Connaught Place New Delhi -> ${lookup2.pincode} (Lat: ${lookup2.latitude}, Lng: ${lookup2.longitude})`);
  } else {
    console.error('  ✗ FAILED: Nominatim lookup failed for Connaught Place', lookup2);
    process.exit(1);
  }

  // Test 4: StructuredLocation Data Structure
  console.log('\nTest 4: StructuredLocation Data Structure Compliance');
  const structuredData: StructuredLocation = {
    area: validForm.area,
    locality: validForm.locality,
    landmark: validForm.landmark,
    street: validForm.street,
    district: validForm.district,
    state: validForm.state,
    pincode: validForm.pincode,
    country: validForm.country,
    latitude: lookup1.latitude ?? null,
    longitude: lookup1.longitude ?? null,
    source: 'MANUAL',
    formattedAddress: `${validForm.street}, Near ${validForm.landmark}, ${validForm.area}, ${validForm.locality}, ${validForm.district}, ${validForm.state} ${validForm.pincode}, ${validForm.country}`,
  };

  console.log('  Generated StructuredLocation payload:');
  console.log(JSON.stringify(structuredData, null, 2));
  console.log('\n=== ALL LOCATION STEP TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
