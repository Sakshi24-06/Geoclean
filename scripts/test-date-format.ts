import {
  parseSafeDate,
  formatRequestDate,
  formatRequestDateTime,
  formatShortDate,
} from '../src/utils/dateFormat';

console.log('====================================================');
console.log('   GeoClean Date Formatting Safety Unit Tests       ');
console.log('====================================================\n');

let allPassed = true;

function check(title: string, pass: boolean, detail: string) {
  if (pass) {
    console.log(`✅ ${title}: PASSED (${detail})`);
  } else {
    console.error(`❌ ${title}: FAILED (${detail})`);
    allPassed = false;
  }
}

// 1. Test null and undefined
check(
  'TEST 1: Null date handling',
  formatRequestDateTime(null) === 'N/A' && formatRequestDate(null) === 'N/A',
  'Returns "N/A" for null without throwing'
);

check(
  'TEST 2: Undefined date handling',
  formatRequestDateTime(undefined) === 'N/A' && formatRequestDate(undefined) === 'N/A',
  'Returns "N/A" for undefined without throwing'
);

// 2. Test empty and invalid strings
check(
  'TEST 3: Empty string handling',
  formatRequestDateTime('') === 'N/A' && formatRequestDate('') === 'N/A',
  'Returns "N/A" for empty string'
);

check(
  'TEST 4: Invalid date string handling',
  formatRequestDateTime('not-a-real-date') === 'N/A' && formatRequestDate('invalid') === 'N/A',
  'Returns "N/A" for invalid date string without crashing'
);

// 3. Test valid ISO string
const validIso = '2026-09-10T14:30:00.000Z';
const formattedDateTime = formatRequestDateTime(validIso);
const formattedDate = formatRequestDate(validIso);

check(
  'TEST 5: Valid ISO string date-time format',
  formattedDateTime.includes('2026') && (formattedDateTime.includes('Sep') || formattedDateTime.includes('09')),
  `Formatted to: "${formattedDateTime}"`
);

check(
  'TEST 6: Valid ISO string date format',
  formattedDate.includes('2026') && (formattedDate.includes('Sep') || formattedDate.includes('09')),
  `Formatted to: "${formattedDate}"`
);

// 4. Test timestamp number
const timestamp = 1788950000000;
const formattedTimestamp = formatRequestDateTime(timestamp);
check(
  'TEST 7: Number timestamp format',
  formattedTimestamp !== 'N/A' && formattedTimestamp.length > 5,
  `Formatted timestamp to: "${formattedTimestamp}"`
);

console.log('\n====================================================');
if (allPassed) {
  console.log('  All Date Formatting Safety Checks Passed!         ');
} else {
  console.log('  Some checks failed. Please inspect errors above.  ');
}
console.log('====================================================\n');
