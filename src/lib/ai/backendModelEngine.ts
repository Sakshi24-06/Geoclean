import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { GoogleGenAI } from '@google/genai';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export type ImageQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface ModelVerificationResponse {
  verified: boolean;
  wasteDetected: boolean;
  confidence: number;
  category: string;
  quality: ImageQuality;
  detectedWasteTypes: string[];
  reason?: string;
  modelVersion: string;
  verifiedAt: string;
  details?: {
    sharpnessScore: number;
    brightnessScore: number;
    wasteProbability: number;
    cleanlinessScore?: number;
    topPredictions?: Array<{ label: string; probability: number }>;
  };
}

export const VERIFICATION_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.50,
  MIN_SHARPNESS: 10,
  MIN_BRIGHTNESS: 15,
  MAX_BRIGHTNESS: 248,
  MODEL_VERSION: 'geoclean-ai-context-v2.1',
};

// 1. Dedicated Waste Receptacles & Direct Dumping Sites (Direct waste indicators)
const DEDICATED_WASTE_PATTERNS = [
  'ashcan', 'trash can', 'garbage can', 'wastebin', 'dustbin', 'trash bin',
  'dumpster', 'trash barrel', 'garbage truck', 'dustcart', 'landfill',
  'dump', 'rubbish', 'litter', 'debris', 'rubble', 'wreck'
];

// 2. Ambiguous Everyday Household Items (Only waste when in an outdoor waste context)
const AMBIGUOUS_HOUSEHOLD_ITEMS = [
  'packet', 'carton', 'wrapper', 'envelope', 'bottle', 'water bottle', 'beer bottle',
  'wine bottle', 'pop bottle', 'soda bottle', 'pill bottle', 'cup', 'coffee mug',
  'plastic bag', 'shopping bag', 'shopping basket', 'paper towel', 'toilet tissue',
  'tissue', 'tin can', 'can', 'bucket', 'pail', 'crate', 'plate', 'dish', 'tray',
  'mixing bowl', 'soup bowl', 'pitcher', 'pot', 'pan'
];

// 3. Domestic / Indoor Furniture, Fixtures & Household Surfaces
const DOMESTIC_INDOOR_PATTERNS = [
  'bed', 'studio couch', 'day bed', 'four-poster', 'quilt', 'pillow', 'sofa',
  'couch', 'table lamp', 'desk', 'dining table', 'coffee table', 'wardrobe',
  'closet', 'bookcase', 'chiffonier', 'chest of drawers', 'cradle', 'crib',
  'bassinet', 'rocking chair', 'folding chair', 'toilet seat', 'bath towel',
  'washcloth', 'pillowcase', 'bedspread', 'comforter', 'duvet', 'carpet',
  'rug', 'mat', 'doormat', 'curtain', 'window shade', 'refrigerator',
  'microwave', 'toaster', 'oven', 'stove', 'kitchen counter', 'sink',
  'bathtub', 'shower curtain', 'armchair', 'cushion', 'home theater',
  'entertainment center', 'lampshade', 'pole', 'nail', 'whistle', 'candle',
  'plate rack', 'medicine chest', 'potter\'s wheel', 'ironing board',
  'sewing machine', 'television', 'remote control', 'cellular telephone',
  'laptop', 'notebook computer', 'pencil box', 'pencil sharpener', 'mousepad'
];

// 4. Text, Posters, Documents & Screen Captures
const TEXT_POSTER_PATTERNS = [
  'rule', 'ruler', 'web site', 'website', 'screen', 'monitor', 'television',
  'comic book', 'book jacket', 'dust cover', 'menu', 'poster',
  'scoreboard', 'digital clock', 'wall clock', 'analog clock', 'keyboard',
  'mouse', 'space bar', 'notebook', 'binder', 'street sign', 'traffic light',
  'envelope', 'packet'
];

// 5. People, Apparel & Selfies
const PERSON_PATTERNS = [
  'suit', 'groom', 'trench coat', 'jersey', 't-shirt', 'tee shirt', 'wig',
  'sunglasses', 'dark glasses', 'brassiere', 'bikini', 'bow tie', 'necktie',
  'gown', 'robe', 'cardigan', 'sweatshirt', 'fur coat', 'person', 'face'
];

// Singleton MobileNet model instance for reuse
let cachedMobileNetModel: mobilenet.MobileNet | null = null;
let modelLoadingPromise: Promise<mobilenet.MobileNet> | null = null;

async function getMobileNetModel(): Promise<mobilenet.MobileNet> {
  if (cachedMobileNetModel) return cachedMobileNetModel;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  cachedMobileNetModel = await modelLoadingPromise;
  modelLoadingPromise = null;
  return cachedMobileNetModel;
}

/**
 * Decodes a base64 Data URL into RGBA raw pixels.
 */
function decodeBase64ToRgba(dataUrl: string): { width: number; height: number; data: Uint8Array | Buffer; mimeType: string } | null {
  try {
    let base64 = dataUrl;
    let mimeType = 'image/jpeg';

    const match = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64 = match[2];
    }

    const buffer = Buffer.from(base64, 'base64');

    // 1. Try PNG decoding
    if (mimeType.includes('png') || (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50)) {
      try {
        const png = PNG.sync.read(buffer);
        return { width: png.width, height: png.height, data: png.data, mimeType: 'image/png' };
      } catch {}
    }

    // 2. Try JPEG decoding
    try {
      const decoded = jpeg.decode(buffer, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        return { width: decoded.width, height: decoded.height, data: decoded.data, mimeType: 'image/jpeg' };
      }
    } catch {}

    return null;
  } catch {
    return null;
  }
}

/**
 * Image Quality and Usability Analysis via Laplacian variance & luminance distribution.
 */
function analyzeImageQuality(
  rgbaData: Uint8Array | Buffer,
  width: number,
  height: number
): {
  quality: ImageQuality;
  sharpnessScore: number;
  brightnessScore: number;
  isAcceptable: boolean;
  issue?: string;
  isTextPosterLike: boolean;
  colorEntropy: number;
} {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return { quality: 'POOR', sharpnessScore: 0, brightnessScore: 0, isAcceptable: false, issue: 'Empty image payload.', isTextPosterLike: false, colorEntropy: 0 };
  }

  let totalLuminance = 0;
  const grayscale = new Float32Array(totalPixels);
  let whitePixelCount = 0;
  let darkPixelCount = 0;
  const colorBuckets = new Uint32Array(32);

  for (let i = 0; i < totalPixels; i++) {
    const r = rgbaData[i * 4];
    const g = rgbaData[i * 4 + 1];
    const b = rgbaData[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grayscale[i] = lum;
    totalLuminance += lum;

    if (lum > 230) whitePixelCount++;
    if (lum < 30) darkPixelCount++;

    const bucket = ((r >> 6) << 3) | ((g >> 6) << 1) | (b >> 7);
    colorBuckets[bucket % 32]++;
  }

  let activeBuckets = 0;
  for (let b = 0; b < 32; b++) {
    if (colorBuckets[b] > totalPixels * 0.015) activeBuckets++;
  }
  const colorEntropy = Math.min(100, Math.round((activeBuckets / 24) * 100));

  const avgBrightness = totalLuminance / totalPixels;
  const brightnessScore = Math.round((avgBrightness / 255) * 100);

  if (avgBrightness < VERIFICATION_CONFIG.MIN_BRIGHTNESS) {
    return {
      quality: 'POOR',
      sharpnessScore: 0,
      brightnessScore,
      isAcceptable: false,
      issue: 'The image is too dark to verify waste items. Please take a well-lit photo.',
      isTextPosterLike: false,
      colorEntropy,
    };
  }

  if (avgBrightness > VERIFICATION_CONFIG.MAX_BRIGHTNESS) {
    return {
      quality: 'POOR',
      sharpnessScore: 0,
      brightnessScore,
      isAcceptable: false,
      issue: 'The image is overexposed or blank with no identifiable objects.',
      isTextPosterLike: false,
      colorEntropy,
    };
  }

  // 2D discrete Laplacian convolution for blur/sharpness
  let laplacianSum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = y * width + x;
      const center = grayscale[idx];
      const lap =
        grayscale[idx - 1] +
        grayscale[idx + 1] +
        grayscale[idx - width] +
        grayscale[idx + width] -
        4 * center;
      laplacianSum += Math.abs(lap);
      count++;
    }
  }

  const laplacianVar = count > 0 ? laplacianSum / count : 0;
  const sharpnessScore = Math.min(100, Math.round(laplacianVar * 4.2));

  if (sharpnessScore < VERIFICATION_CONFIG.MIN_SHARPNESS) {
    return {
      quality: 'POOR',
      sharpnessScore,
      brightnessScore,
      isAcceptable: false,
      issue: 'Image is too blurry. Please hold your device steady and take a clear photo.',
      isTextPosterLike: false,
      colorEntropy,
    };
  }

  // Detect high-contrast text poster / document layout
  const whiteRatio = whitePixelCount / totalPixels;
  const darkRatio = darkPixelCount / totalPixels;
  const isTextPosterLike = (whiteRatio > 0.65 && darkRatio > 0.05 && activeBuckets < 10) || (whiteRatio > 0.88);

  const quality: ImageQuality = sharpnessScore > 35 ? 'GOOD' : 'FAIR';
  return { quality, sharpnessScore, brightnessScore, isAcceptable: true, isTextPosterLike, colorEntropy };
}

/**
 * Context-Aware Gemini Vision Multimodal Evaluator
 */
async function evaluateWithGeminiVision(
  imageBase64: string,
  context: 'CITIZEN_BEFORE' | 'NGO_AFTER',
  issueTypeHint?: string
): Promise<ModelVerificationResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;

    const match = imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      cleanBase64 = match[2];
    }

    const prompt = `You are GeoClean's Context-Aware Waste & Public Cleanliness AI Verification Model.

CRITICAL OBJECT VS WASTE DISTINCTION:
- Object detection is NOT waste verification.
- A single everyday object (such as a snack packet, plastic bottle, paper, cup, or bag) on a bed, quilt, table, desk, shelf, kitchen counter, in a room, or in a person's hand is NOT a waste report. It is a domestic household object in normal use.
- Set wasteDetected: false and verified: false for:
  * A packet lying on a bed/quilt/pillow/table/desk
  * A bottle or cup on a desk/table/shelf
  * Motivational text posters, quotes (e.g. "WHO YOU WANT TO BE"), screenshots, documents, slides
  * Selfies, portraits, clean landscapes, clean rooms
- ONLY set wasteDetected: true and verified: true if:
  * It is a genuine public waste/cleanliness issue
  * Examples: Garbage dump/pile, roadside discarded litter, overflowing trash bin/dumpster, scattered plastic pollution on outdoor ground/street/drainage, construction debris dump.

Context: ${context === 'NGO_AFTER' ? 'NGO Cleanup Completion Photo (verify clean area without garbage)' : 'Citizen Waste Issue Report'}
Issue Hint: ${issueTypeHint || 'None'}

Return ONLY valid JSON:
{
  "verified": boolean,
  "wasteDetected": boolean,
  "confidence": number,
  "category": string,
  "quality": "GOOD" | "FAIR" | "POOR",
  "detectedWasteTypes": string[],
  "reason": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: cleanBase64, mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const quality: ImageQuality = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'].includes(parsed.quality) ? parsed.quality : 'GOOD';
    const confidence = typeof parsed.confidence === 'number' ? Math.min(0.99, Math.max(0.01, parsed.confidence)) : 0.85;
    const wasteDetected = Boolean(parsed.wasteDetected);

    const verified = (context === 'NGO_AFTER' ? true : wasteDetected) && confidence >= VERIFICATION_CONFIG.CONFIDENCE_THRESHOLD && quality !== 'POOR';

    return {
      verified,
      wasteDetected,
      confidence,
      category: parsed.category || (wasteDetected ? (issueTypeHint || 'Mixed Garbage') : 'Non-Waste Image'),
      quality,
      detectedWasteTypes: Array.isArray(parsed.detectedWasteTypes) ? parsed.detectedWasteTypes : (wasteDetected ? [parsed.category] : []),
      reason: parsed.reason || (verified ? 'Waste issue verified by GeoClean AI.' : 'No relevant waste issue detected.'),
      modelVersion: 'geoclean-gemini-2.5-flash',
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: quality === 'GOOD' ? 85 : 45,
        brightnessScore: 75,
        wasteProbability: wasteDetected ? confidence : 0.05,
        cleanlinessScore: wasteDetected ? Math.round((1 - confidence) * 100) : 95,
      },
    };
  } catch (err) {
    console.error('Gemini Vision API Execution Error:', err);
    return null;
  }
}

/**
 * Context-Aware Deep Neural Network (MobileNet ImageNet) Classifier.
 * Analyzes object types, environmental surfaces, and waste context.
 */
async function evaluateWithMobileNetCNN(
  rgbaData: Uint8Array | Buffer,
  width: number,
  height: number,
  qualityAnalysis: { quality: ImageQuality; sharpnessScore: number; brightnessScore: number; isTextPosterLike: boolean; colorEntropy: number },
  context: 'CITIZEN_BEFORE' | 'NGO_AFTER',
  issueTypeHint?: string
): Promise<ModelVerificationResponse> {
  const model = await getMobileNetModel();

  // Resize and create 3D RGB Tensor [224, 224, 3] for MobileNet
  const targetW = 224;
  const targetH = 224;
  const rgbValues = new Int32Array(targetW * targetH * 3);

  for (let dy = 0; dy < targetH; dy++) {
    const sy = Math.floor((dy * height) / targetH);
    for (let dx = 0; dx < targetW; dx++) {
      const sx = Math.floor((dx * width) / targetW);
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (dy * targetW + dx) * 3;

      rgbValues[dstIdx] = rgbaData[srcIdx];         // R
      rgbValues[dstIdx + 1] = rgbaData[srcIdx + 1]; // G
      rgbValues[dstIdx + 2] = rgbaData[srcIdx + 2]; // B
    }
  }

  const tensor = tf.tensor3d(rgbValues, [targetH, targetW, 3], 'int32');
  const predictions = await model.classify(tensor, 15);
  tensor.dispose();

  let dedicatedWasteScore = 0;
  let ambiguousItemScore = 0;
  let domesticIndoorScore = 0;
  let textPosterScore = 0;
  let personScore = 0;

  let bestWasteClass = '';
  let topNonWasteClass = '';
  let topNonWasteProb = 0;

  const detectedWasteList: string[] = [];
  const detectedDomesticList: string[] = [];

  for (const pred of predictions) {
    const labelLower = pred.className.toLowerCase();
    const prob = pred.probability;

    // 1. Check Dedicated Waste Receptacle / Dumping Site
    const isDedicatedWaste = DEDICATED_WASTE_PATTERNS.some((p) => labelLower.includes(p));
    if (isDedicatedWaste) {
      dedicatedWasteScore += prob;
      if (!bestWasteClass || prob > dedicatedWasteScore * 0.5) {
        bestWasteClass = pred.className.split(',')[0].trim();
      }
      const fmt = pred.className.split(',')[0].trim();
      if (!detectedWasteList.includes(fmt)) detectedWasteList.push(fmt);
    }

    // 2. Check Ambiguous Everyday Household Item
    const isAmbiguousItem = AMBIGUOUS_HOUSEHOLD_ITEMS.some((p) => labelLower.includes(p));
    if (isAmbiguousItem) {
      ambiguousItemScore += prob;
      const fmt = pred.className.split(',')[0].trim();
      if (!detectedWasteList.includes(fmt)) detectedWasteList.push(fmt);
    }

    // 3. Check Domestic / Indoor Furniture & Surfaces
    const isDomestic = DOMESTIC_INDOOR_PATTERNS.some((p) => labelLower.includes(p));
    if (isDomestic) {
      domesticIndoorScore += prob;
      const fmt = pred.className.split(',')[0].trim();
      if (!detectedDomesticList.includes(fmt)) detectedDomesticList.push(fmt);
    }

    // 4. Check Text / Posters / Screenshots
    const isTextPoster = TEXT_POSTER_PATTERNS.some((p) => labelLower.includes(p));
    if (isTextPoster) {
      textPosterScore += prob;
    }

    // 5. Check Person / Apparel
    const isPerson = PERSON_PATTERNS.some((p) => labelLower.includes(p));
    if (isPerson) {
      personScore += prob;
    }

    // Track highest non-waste prediction
    if (!isDedicatedWaste && !isAmbiguousItem && prob > topNonWasteProb) {
      topNonWasteProb = prob;
      topNonWasteClass = pred.className.split(',')[0].trim();
    }
  }

  // Handle NGO cleanup photo
  if (context === 'NGO_AFTER') {
    const isClean = dedicatedWasteScore < 0.05 && ambiguousItemScore < 0.20;
    const confidence = 0.93;
    return {
      verified: isClean,
      wasteDetected: false,
      confidence,
      category: isClean ? 'Cleaned Area' : 'Residual Waste Detected',
      quality: qualityAnalysis.quality,
      detectedWasteTypes: isClean ? ['Cleaned Site', 'Waste Removed'] : detectedWasteList,
      reason: isClean ? 'Area verified as clean and free of visible waste.' : 'Residual waste still detected at site.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: dedicatedWasteScore + ambiguousItemScore,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 1. REJECT Text / Motivational Posters / Document Screenshots
  if (qualityAnalysis.isTextPosterLike || (textPosterScore > 0.05 && dedicatedWasteScore < 0.03)) {
    const nonWasteConf = Math.min(0.96, Math.max(0.85, textPosterScore + 0.60));
    return {
      verified: false,
      wasteDetected: false,
      confidence: Math.round(nonWasteConf * 100) / 100,
      category: 'Non-Waste Image (Text / Poster)',
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: 'No relevant waste was detected. The image appears to contain text, graphics, or poster content.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.02,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 2. REJECT Domestic / Indoor Setting (e.g. single packet on bed/quilt/table/desk)
  // When indoor/domestic surfaces are detected and no dedicated public waste receptacle is present
  if ((domesticIndoorScore > 0.01 || detectedDomesticList.length > 0) && dedicatedWasteScore < 0.03) {
    const nonWasteConf = Math.min(0.95, Math.max(0.82, domesticIndoorScore + 0.60));
    const detectedContext = detectedDomesticList[0] || 'Indoor / Furniture';
    return {
      verified: false,
      wasteDetected: false,
      confidence: Math.round(nonWasteConf * 100) / 100,
      category: `Non-Waste (${detectedContext})`,
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: `No relevant waste issue detected. The object is in an indoor/domestic setting (${detectedContext}) and is not discarded waste.`,
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.04,
        cleanlinessScore: 92,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 3. REJECT Person / Portrait / Selfie
  if (personScore > 0.12 && dedicatedWasteScore < 0.03) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.88,
      category: 'Non-Waste (Person / Portrait)',
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: 'No relevant waste was detected. The image appears to be a portrait or person with no visible waste dump.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.03,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 4. VERIFY Dedicated Waste Receptacle (e.g. ashcan, trash can, dumpster, landfill)
  if (dedicatedWasteScore >= 0.03) {
    const wasteConfidence = Math.min(0.96, Math.max(0.68, Math.round((dedicatedWasteScore * 5.0 + 0.45) * 100) / 100));
    const finalCategory = bestWasteClass || issueTypeHint || 'Overflowing Garbage Bin';
    return {
      verified: true,
      wasteDetected: true,
      confidence: wasteConfidence,
      category: finalCategory,
      quality: qualityAnalysis.quality,
      detectedWasteTypes: detectedWasteList.length ? detectedWasteList : [finalCategory],
      reason: 'Waste issue verified by GeoClean AI Model.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: wasteConfidence,
        cleanlinessScore: Math.round((1 - wasteConfidence) * 100),
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 5. EVALUATE Ambiguous Household Items on Outdoor Ground vs Isolated Item
  if (ambiguousItemScore >= 0.06) {
    // Check if image exhibits high multi-color entropy + high sharpness indicative of outdoor debris
    const hasOutdoorDebrisContext = qualityAnalysis.colorEntropy > 65 && qualityAnalysis.sharpnessScore > 35;

    if (hasOutdoorDebrisContext) {
      const wasteConfidence = Math.min(0.92, Math.max(0.65, Math.round((ambiguousItemScore * 4.0 + 0.40) * 100) / 100));
      const finalCategory = issueTypeHint || detectedWasteList[0] || 'Plastic Waste';
      return {
        verified: true,
        wasteDetected: true,
        confidence: wasteConfidence,
        category: finalCategory,
        quality: qualityAnalysis.quality,
        detectedWasteTypes: detectedWasteList.length ? detectedWasteList : [finalCategory],
        reason: 'Waste issue verified by GeoClean AI Model.',
        modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
        verifiedAt: new Date().toISOString(),
        details: {
          sharpnessScore: qualityAnalysis.sharpnessScore,
          brightnessScore: qualityAnalysis.brightnessScore,
          wasteProbability: wasteConfidence,
          cleanlinessScore: Math.round((1 - wasteConfidence) * 100),
          topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
        },
      };
    }

    // Otherwise: Single isolated object without waste context -> REJECT!
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.85,
      category: 'Non-Waste (Single Object / Clean Surface)',
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: 'Single isolated object with no evidence of a public waste or dumping problem. Please upload a clear photo showing the reported waste problem in its environmental context.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.15,
        cleanlinessScore: 88,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
      },
    };
  }

  // 6. DEFAULT NON-WASTE
  const finalCategory = `Non-Waste (${topNonWasteClass || 'General Scene'})`;
  return {
    verified: false,
    wasteDetected: false,
    confidence: Math.min(0.95, Math.max(0.75, Math.round(topNonWasteProb * 100) / 100)),
    category: finalCategory,
    quality: qualityAnalysis.quality,
    detectedWasteTypes: [],
    reason: 'No relevant waste was detected. Please upload a clear photo showing the reported waste/cleanliness issue.',
    modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
    verifiedAt: new Date().toISOString(),
    details: {
      sharpnessScore: qualityAnalysis.sharpnessScore,
      brightnessScore: qualityAnalysis.brightnessScore,
      wasteProbability: 0.05,
      cleanlinessScore: 92,
      topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability })),
    },
  };
}

/**
 * Primary Real AI Image Verification Engine
 * Decodes pixels -> Checks Quality -> Evaluates with Gemini Vision or Context-Aware MobileNet.
 */
export async function verifyImageWithLevel3AI(
  imageBase64OrDataUrl: string,
  context: 'CITIZEN_BEFORE' | 'NGO_AFTER' = 'CITIZEN_BEFORE',
  issueTypeHint?: string
): Promise<ModelVerificationResponse> {
  // 1. Decode exact image pixels
  const decoded = decodeBase64ToRgba(imageBase64OrDataUrl);
  if (!decoded) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0,
      category: 'Unreadable Image',
      quality: 'POOR',
      detectedWasteTypes: [],
      reason: 'Failed to decode image data. Please upload a standard PNG or JPEG image.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
    };
  }

  // 2. Perform Real Image Quality Assessment
  const quality = analyzeImageQuality(decoded.data, decoded.width, decoded.height);
  if (!quality.isAcceptable) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.15,
      category: 'Poor Quality Image',
      quality: 'POOR',
      detectedWasteTypes: [],
      reason: quality.issue || 'Image quality is too poor for AI verification.',
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: new Date().toISOString(),
      details: {
        sharpnessScore: quality.sharpnessScore,
        brightnessScore: quality.brightnessScore,
        wasteProbability: 0,
      },
    };
  }

  // 3. Try Gemini Multimodal Vision API (if API Key provided)
  const geminiResult = await evaluateWithGeminiVision(imageBase64OrDataUrl, context, issueTypeHint);
  if (geminiResult) {
    return geminiResult;
  }

  // 4. Run Context-Aware MobileNet Deep Convolutional Neural Network on actual pixel tensor
  return evaluateWithMobileNetCNN(
    decoded.data,
    decoded.width,
    decoded.height,
    quality,
    context,
    issueTypeHint
  );
}
