import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { verifyImageWithLevel3AI } from '../src/lib/ai/backendModelEngine';

function createTestPng(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number]): string {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b] = fillFn(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  const buffer = PNG.sync.write(png);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function runTests() {
  console.log('=== RUNNING AI VERIFICATION TESTS ===\n');

  // Test 1: Dark / Blurry image
  const darkImage = createTestPng(224, 224, () => [5, 5, 5]);
  const res1 = await verifyImageWithLevel3AI(darkImage);
  console.log('Test 1 (Too Dark):', { verified: res1.verified, wasteDetected: res1.wasteDetected, quality: res1.quality, reason: res1.reason });

  // Test 2: Blank / White Overexposed image
  const whiteImage = createTestPng(224, 224, () => [254, 254, 254]);
  const res2 = await verifyImageWithLevel3AI(whiteImage);
  console.log('Test 2 (Overexposed / Blank):', { verified: res2.verified, wasteDetected: res2.wasteDetected, quality: res2.quality, reason: res2.reason });

  // Test 3: High-contrast Text Poster ("WHO YOU WANT TO BE" style)
  const posterImage = createTestPng(224, 224, (x, y) => {
    // White background with dark text strips
    if (y % 20 < 4 && x > 30 && x < 190) return [20, 20, 20];
    return [245, 245, 245];
  });
  const res3 = await verifyImageWithLevel3AI(posterImage);
  console.log('Test 3 (Text Poster):', { verified: res3.verified, wasteDetected: res3.wasteDetected, category: res3.category, reason: res3.reason });

  // Test 4: Textured Quilt / Bed with single packet
  const bedWithPacket = createTestPng(224, 224, (x, y) => {
    // Quilt / bed pattern with crosshatch fabric texture
    const fabric = ((x % 8 < 4 ? 20 : -20) + (y % 8 < 4 ? 20 : -20));
    if (x > 80 && x < 140 && y > 80 && y < 140) {
      // Snack packet in the middle
      return [Math.min(255, 200 + fabric), Math.max(0, 30 + fabric), Math.max(0, 30 + fabric)];
    }
    return [Math.min(255, 180 + fabric), Math.min(255, 170 + fabric), Math.max(0, 150 + fabric)];
  });
  const res4 = await verifyImageWithLevel3AI(bedWithPacket);
  console.log('Test 4 (Textured Bed/Quilt with Packet):', { verified: res4.verified, wasteDetected: res4.wasteDetected, category: res4.category, reason: res4.reason });

  // Test 5: Clean patterned floor with single bottle
  const floorWithBottle = createTestPng(224, 224, (x, y) => {
    // Tile floor pattern
    const isGrout = (x % 32 === 0 || y % 32 === 0);
    if (x > 95 && x < 125 && y > 60 && y < 160) {
      return [20, 100, 210]; // plastic bottle
    }
    return isGrout ? [120, 120, 120] : [225, 225, 225];
  });
  const res5 = await verifyImageWithLevel3AI(floorWithBottle);
  console.log('Test 5 (Tile Floor with Bottle):', { verified: res5.verified, wasteDetected: res5.wasteDetected, category: res5.category, reason: res5.reason });

  // Test 6: High-entropy multi-colored scattered outdoor debris / garbage
  const outdoorDebris = createTestPng(224, 224, (x, y) => {
    // High-entropy random multi-color debris simulation
    const noise = ((x * 37 + y * 53) % 255);
    const r = (noise * 7) % 255;
    const g = (noise * 13) % 255;
    const b = (noise * 29) % 255;
    return [r, g, b];
  });
  const res6 = await verifyImageWithLevel3AI(outdoorDebris, 'CITIZEN_BEFORE', 'Plastic Waste');
  console.log('Test 6 (Outdoor High-Entropy Debris):', { verified: res6.verified, wasteDetected: res6.wasteDetected, category: res6.category, reason: res6.reason });

  console.log('\n=== ALL TESTS COMPLETE ===');
}

runTests().catch(console.error);
