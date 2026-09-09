// vite.config.ts
import { defineConfig } from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";

// src/lib/ai/backendModelEngine.ts
import * as tf from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/@tensorflow/tfjs/dist/tf.node.js";
import * as mobilenet from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/@tensorflow-models/mobilenet/dist/index.js";
import { GoogleGenAI } from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/@google/genai/dist/node/index.mjs";
import * as jpeg from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/jpeg-js/index.js";
import { PNG } from "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/node_modules/pngjs/lib/png.js";
var VERIFICATION_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.5,
  MIN_SHARPNESS: 10,
  MIN_BRIGHTNESS: 15,
  MAX_BRIGHTNESS: 248,
  MODEL_VERSION: "geoclean-ai-context-v2.1"
};
var DEDICATED_WASTE_PATTERNS = [
  "ashcan",
  "trash can",
  "garbage can",
  "wastebin",
  "dustbin",
  "trash bin",
  "dumpster",
  "trash barrel",
  "garbage truck",
  "dustcart",
  "landfill",
  "dump",
  "rubbish",
  "litter",
  "debris",
  "rubble",
  "wreck"
];
var AMBIGUOUS_HOUSEHOLD_ITEMS = [
  "packet",
  "carton",
  "wrapper",
  "envelope",
  "bottle",
  "water bottle",
  "beer bottle",
  "wine bottle",
  "pop bottle",
  "soda bottle",
  "pill bottle",
  "cup",
  "coffee mug",
  "plastic bag",
  "shopping bag",
  "shopping basket",
  "paper towel",
  "toilet tissue",
  "tissue",
  "tin can",
  "can",
  "bucket",
  "pail",
  "crate",
  "plate",
  "dish",
  "tray",
  "mixing bowl",
  "soup bowl",
  "pitcher",
  "pot",
  "pan"
];
var DOMESTIC_INDOOR_PATTERNS = [
  "bed",
  "studio couch",
  "day bed",
  "four-poster",
  "quilt",
  "pillow",
  "sofa",
  "couch",
  "table lamp",
  "desk",
  "dining table",
  "coffee table",
  "wardrobe",
  "closet",
  "bookcase",
  "chiffonier",
  "chest of drawers",
  "cradle",
  "crib",
  "bassinet",
  "rocking chair",
  "folding chair",
  "toilet seat",
  "bath towel",
  "washcloth",
  "pillowcase",
  "bedspread",
  "comforter",
  "duvet",
  "carpet",
  "rug",
  "mat",
  "doormat",
  "curtain",
  "window shade",
  "refrigerator",
  "microwave",
  "toaster",
  "oven",
  "stove",
  "kitchen counter",
  "sink",
  "bathtub",
  "shower curtain",
  "armchair",
  "cushion",
  "home theater",
  "entertainment center",
  "lampshade",
  "pole",
  "nail",
  "whistle",
  "candle",
  "plate rack",
  "medicine chest",
  "potter's wheel",
  "ironing board",
  "sewing machine",
  "television",
  "remote control",
  "cellular telephone",
  "laptop",
  "notebook computer",
  "pencil box",
  "pencil sharpener",
  "mousepad"
];
var TEXT_POSTER_PATTERNS = [
  "rule",
  "ruler",
  "web site",
  "website",
  "screen",
  "monitor",
  "television",
  "comic book",
  "book jacket",
  "dust cover",
  "menu",
  "poster",
  "scoreboard",
  "digital clock",
  "wall clock",
  "analog clock",
  "keyboard",
  "mouse",
  "space bar",
  "notebook",
  "binder",
  "street sign",
  "traffic light",
  "envelope",
  "packet"
];
var PERSON_PATTERNS = [
  "suit",
  "groom",
  "trench coat",
  "jersey",
  "t-shirt",
  "tee shirt",
  "wig",
  "sunglasses",
  "dark glasses",
  "brassiere",
  "bikini",
  "bow tie",
  "necktie",
  "gown",
  "robe",
  "cardigan",
  "sweatshirt",
  "fur coat",
  "person",
  "face"
];
var cachedMobileNetModel = null;
var modelLoadingPromise = null;
async function getMobileNetModel() {
  if (cachedMobileNetModel) return cachedMobileNetModel;
  if (modelLoadingPromise) return modelLoadingPromise;
  modelLoadingPromise = mobilenet.load({ version: 2, alpha: 1 });
  cachedMobileNetModel = await modelLoadingPromise;
  modelLoadingPromise = null;
  return cachedMobileNetModel;
}
function decodeBase64ToRgba(dataUrl) {
  try {
    let base64 = dataUrl;
    let mimeType = "image/jpeg";
    const match = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64 = match[2];
    }
    const buffer = Buffer.from(base64, "base64");
    if (mimeType.includes("png") || buffer.length > 8 && buffer[0] === 137 && buffer[1] === 80) {
      try {
        const png = PNG.sync.read(buffer);
        return { width: png.width, height: png.height, data: png.data, mimeType: "image/png" };
      } catch {
      }
    }
    try {
      const decoded = jpeg.decode(buffer, { useTArray: true });
      if (decoded && decoded.width > 0 && decoded.height > 0) {
        return { width: decoded.width, height: decoded.height, data: decoded.data, mimeType: "image/jpeg" };
      }
    } catch {
    }
    return null;
  } catch {
    return null;
  }
}
function analyzeImageQuality(rgbaData, width, height) {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return { quality: "POOR", sharpnessScore: 0, brightnessScore: 0, isAcceptable: false, issue: "Empty image payload.", isTextPosterLike: false, colorEntropy: 0 };
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
    const bucket = r >> 6 << 3 | g >> 6 << 1 | b >> 7;
    colorBuckets[bucket % 32]++;
  }
  let activeBuckets = 0;
  for (let b = 0; b < 32; b++) {
    if (colorBuckets[b] > totalPixels * 0.015) activeBuckets++;
  }
  const colorEntropy = Math.min(100, Math.round(activeBuckets / 24 * 100));
  const avgBrightness = totalLuminance / totalPixels;
  const brightnessScore = Math.round(avgBrightness / 255 * 100);
  if (avgBrightness < VERIFICATION_CONFIG.MIN_BRIGHTNESS) {
    return {
      quality: "POOR",
      sharpnessScore: 0,
      brightnessScore,
      isAcceptable: false,
      issue: "The image is too dark to verify waste items. Please take a well-lit photo.",
      isTextPosterLike: false,
      colorEntropy
    };
  }
  if (avgBrightness > VERIFICATION_CONFIG.MAX_BRIGHTNESS) {
    return {
      quality: "POOR",
      sharpnessScore: 0,
      brightnessScore,
      isAcceptable: false,
      issue: "The image is overexposed or blank with no identifiable objects.",
      isTextPosterLike: false,
      colorEntropy
    };
  }
  let laplacianSum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const idx = y * width + x;
      const center = grayscale[idx];
      const lap = grayscale[idx - 1] + grayscale[idx + 1] + grayscale[idx - width] + grayscale[idx + width] - 4 * center;
      laplacianSum += Math.abs(lap);
      count++;
    }
  }
  const laplacianVar = count > 0 ? laplacianSum / count : 0;
  const sharpnessScore = Math.min(100, Math.round(laplacianVar * 4.2));
  if (sharpnessScore < VERIFICATION_CONFIG.MIN_SHARPNESS) {
    return {
      quality: "POOR",
      sharpnessScore,
      brightnessScore,
      isAcceptable: false,
      issue: "Image is too blurry. Please hold your device steady and take a clear photo.",
      isTextPosterLike: false,
      colorEntropy
    };
  }
  const whiteRatio = whitePixelCount / totalPixels;
  const darkRatio = darkPixelCount / totalPixels;
  const isTextPosterLike = whiteRatio > 0.65 && darkRatio > 0.05 && activeBuckets < 10 || whiteRatio > 0.88;
  const quality = sharpnessScore > 35 ? "GOOD" : "FAIR";
  return { quality, sharpnessScore, brightnessScore, isAcceptable: true, isTextPosterLike, colorEntropy };
}
async function evaluateWithGeminiVision(imageBase64, context, issueTypeHint) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    let mimeType = "image/jpeg";
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

Context: ${context === "NGO_AFTER" ? "NGO Cleanup Completion Photo (verify clean area without garbage)" : "Citizen Waste Issue Report"}
Issue Hint: ${issueTypeHint || "None"}

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
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: cleanBase64, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });
    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    const quality = ["EXCELLENT", "GOOD", "FAIR", "POOR"].includes(parsed.quality) ? parsed.quality : "GOOD";
    const confidence = typeof parsed.confidence === "number" ? Math.min(0.99, Math.max(0.01, parsed.confidence)) : 0.85;
    const wasteDetected = Boolean(parsed.wasteDetected);
    const verified = (context === "NGO_AFTER" ? true : wasteDetected) && confidence >= VERIFICATION_CONFIG.CONFIDENCE_THRESHOLD && quality !== "POOR";
    return {
      verified,
      wasteDetected,
      confidence,
      category: parsed.category || (wasteDetected ? issueTypeHint || "Mixed Garbage" : "Non-Waste Image"),
      quality,
      detectedWasteTypes: Array.isArray(parsed.detectedWasteTypes) ? parsed.detectedWasteTypes : wasteDetected ? [parsed.category] : [],
      reason: parsed.reason || (verified ? "Waste issue verified by GeoClean AI." : "No relevant waste issue detected."),
      modelVersion: "geoclean-gemini-2.5-flash",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: quality === "GOOD" ? 85 : 45,
        brightnessScore: 75,
        wasteProbability: wasteDetected ? confidence : 0.05,
        cleanlinessScore: wasteDetected ? Math.round((1 - confidence) * 100) : 95
      }
    };
  } catch (err) {
    console.error("Gemini Vision API Execution Error:", err);
    return null;
  }
}
async function evaluateWithMobileNetCNN(rgbaData, width, height, qualityAnalysis, context, issueTypeHint) {
  const model = await getMobileNetModel();
  const targetW = 224;
  const targetH = 224;
  const rgbValues = new Int32Array(targetW * targetH * 3);
  for (let dy = 0; dy < targetH; dy++) {
    const sy = Math.floor(dy * height / targetH);
    for (let dx = 0; dx < targetW; dx++) {
      const sx = Math.floor(dx * width / targetW);
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (dy * targetW + dx) * 3;
      rgbValues[dstIdx] = rgbaData[srcIdx];
      rgbValues[dstIdx + 1] = rgbaData[srcIdx + 1];
      rgbValues[dstIdx + 2] = rgbaData[srcIdx + 2];
    }
  }
  const tensor = tf.tensor3d(rgbValues, [targetH, targetW, 3], "int32");
  const predictions = await model.classify(tensor, 15);
  tensor.dispose();
  let dedicatedWasteScore = 0;
  let ambiguousItemScore = 0;
  let domesticIndoorScore = 0;
  let textPosterScore = 0;
  let personScore = 0;
  let bestWasteClass = "";
  let topNonWasteClass = "";
  let topNonWasteProb = 0;
  const detectedWasteList = [];
  const detectedDomesticList = [];
  for (const pred of predictions) {
    const labelLower = pred.className.toLowerCase();
    const prob = pred.probability;
    const isDedicatedWaste = DEDICATED_WASTE_PATTERNS.some((p) => labelLower.includes(p));
    if (isDedicatedWaste) {
      dedicatedWasteScore += prob;
      if (!bestWasteClass || prob > dedicatedWasteScore * 0.5) {
        bestWasteClass = pred.className.split(",")[0].trim();
      }
      const fmt = pred.className.split(",")[0].trim();
      if (!detectedWasteList.includes(fmt)) detectedWasteList.push(fmt);
    }
    const isAmbiguousItem = AMBIGUOUS_HOUSEHOLD_ITEMS.some((p) => labelLower.includes(p));
    if (isAmbiguousItem) {
      ambiguousItemScore += prob;
      const fmt = pred.className.split(",")[0].trim();
      if (!detectedWasteList.includes(fmt)) detectedWasteList.push(fmt);
    }
    const isDomestic = DOMESTIC_INDOOR_PATTERNS.some((p) => labelLower.includes(p));
    if (isDomestic) {
      domesticIndoorScore += prob;
      const fmt = pred.className.split(",")[0].trim();
      if (!detectedDomesticList.includes(fmt)) detectedDomesticList.push(fmt);
    }
    const isTextPoster = TEXT_POSTER_PATTERNS.some((p) => labelLower.includes(p));
    if (isTextPoster) {
      textPosterScore += prob;
    }
    const isPerson = PERSON_PATTERNS.some((p) => labelLower.includes(p));
    if (isPerson) {
      personScore += prob;
    }
    if (!isDedicatedWaste && !isAmbiguousItem && prob > topNonWasteProb) {
      topNonWasteProb = prob;
      topNonWasteClass = pred.className.split(",")[0].trim();
    }
  }
  if (context === "NGO_AFTER") {
    const isClean = dedicatedWasteScore < 0.05 && ambiguousItemScore < 0.2;
    const confidence = 0.93;
    return {
      verified: isClean,
      wasteDetected: false,
      confidence,
      category: isClean ? "Cleaned Area" : "Residual Waste Detected",
      quality: qualityAnalysis.quality,
      detectedWasteTypes: isClean ? ["Cleaned Site", "Waste Removed"] : detectedWasteList,
      reason: isClean ? "Area verified as clean and free of visible waste." : "Residual waste still detected at site.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: dedicatedWasteScore + ambiguousItemScore,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  if (qualityAnalysis.isTextPosterLike || textPosterScore > 0.05 && dedicatedWasteScore < 0.03) {
    const nonWasteConf = Math.min(0.96, Math.max(0.85, textPosterScore + 0.6));
    return {
      verified: false,
      wasteDetected: false,
      confidence: Math.round(nonWasteConf * 100) / 100,
      category: "Non-Waste Image (Text / Poster)",
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: "No relevant waste was detected. The image appears to contain text, graphics, or poster content.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.02,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  if ((domesticIndoorScore > 0.01 || detectedDomesticList.length > 0) && dedicatedWasteScore < 0.03) {
    const nonWasteConf = Math.min(0.95, Math.max(0.82, domesticIndoorScore + 0.6));
    const detectedContext = detectedDomesticList[0] || "Indoor / Furniture";
    return {
      verified: false,
      wasteDetected: false,
      confidence: Math.round(nonWasteConf * 100) / 100,
      category: `Non-Waste (${detectedContext})`,
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: `No relevant waste issue detected. The object is in an indoor/domestic setting (${detectedContext}) and is not discarded waste.`,
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.04,
        cleanlinessScore: 92,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  if (personScore > 0.12 && dedicatedWasteScore < 0.03) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.88,
      category: "Non-Waste (Person / Portrait)",
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: "No relevant waste was detected. The image appears to be a portrait or person with no visible waste dump.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.03,
        cleanlinessScore: 95,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  if (dedicatedWasteScore >= 0.03) {
    const wasteConfidence = Math.min(0.96, Math.max(0.68, Math.round((dedicatedWasteScore * 5 + 0.45) * 100) / 100));
    const finalCategory2 = bestWasteClass || issueTypeHint || "Overflowing Garbage Bin";
    return {
      verified: true,
      wasteDetected: true,
      confidence: wasteConfidence,
      category: finalCategory2,
      quality: qualityAnalysis.quality,
      detectedWasteTypes: detectedWasteList.length ? detectedWasteList : [finalCategory2],
      reason: "Waste issue verified by GeoClean AI Model.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: wasteConfidence,
        cleanlinessScore: Math.round((1 - wasteConfidence) * 100),
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  if (ambiguousItemScore >= 0.06) {
    const hasOutdoorDebrisContext = qualityAnalysis.colorEntropy > 65 && qualityAnalysis.sharpnessScore > 35;
    if (hasOutdoorDebrisContext) {
      const wasteConfidence = Math.min(0.92, Math.max(0.65, Math.round((ambiguousItemScore * 4 + 0.4) * 100) / 100));
      const finalCategory2 = issueTypeHint || detectedWasteList[0] || "Plastic Waste";
      return {
        verified: true,
        wasteDetected: true,
        confidence: wasteConfidence,
        category: finalCategory2,
        quality: qualityAnalysis.quality,
        detectedWasteTypes: detectedWasteList.length ? detectedWasteList : [finalCategory2],
        reason: "Waste issue verified by GeoClean AI Model.",
        modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
        verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
        details: {
          sharpnessScore: qualityAnalysis.sharpnessScore,
          brightnessScore: qualityAnalysis.brightnessScore,
          wasteProbability: wasteConfidence,
          cleanlinessScore: Math.round((1 - wasteConfidence) * 100),
          topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
        }
      };
    }
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.85,
      category: "Non-Waste (Single Object / Clean Surface)",
      quality: qualityAnalysis.quality,
      detectedWasteTypes: [],
      reason: "Single isolated object with no evidence of a public waste or dumping problem. Please upload a clear photo showing the reported waste problem in its environmental context.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: qualityAnalysis.sharpnessScore,
        brightnessScore: qualityAnalysis.brightnessScore,
        wasteProbability: 0.15,
        cleanlinessScore: 88,
        topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
      }
    };
  }
  const finalCategory = `Non-Waste (${topNonWasteClass || "General Scene"})`;
  return {
    verified: false,
    wasteDetected: false,
    confidence: Math.min(0.95, Math.max(0.75, Math.round(topNonWasteProb * 100) / 100)),
    category: finalCategory,
    quality: qualityAnalysis.quality,
    detectedWasteTypes: [],
    reason: "No relevant waste was detected. Please upload a clear photo showing the reported waste/cleanliness issue.",
    modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
    details: {
      sharpnessScore: qualityAnalysis.sharpnessScore,
      brightnessScore: qualityAnalysis.brightnessScore,
      wasteProbability: 0.05,
      cleanlinessScore: 92,
      topPredictions: predictions.map((p) => ({ label: p.className, probability: p.probability }))
    }
  };
}
async function verifyImageWithLevel3AI(imageBase64OrDataUrl, context = "CITIZEN_BEFORE", issueTypeHint) {
  const decoded = decodeBase64ToRgba(imageBase64OrDataUrl);
  if (!decoded) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0,
      category: "Unreadable Image",
      quality: "POOR",
      detectedWasteTypes: [],
      reason: "Failed to decode image data. Please upload a standard PNG or JPEG image.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const quality = analyzeImageQuality(decoded.data, decoded.width, decoded.height);
  if (!quality.isAcceptable) {
    return {
      verified: false,
      wasteDetected: false,
      confidence: 0.15,
      category: "Poor Quality Image",
      quality: "POOR",
      detectedWasteTypes: [],
      reason: quality.issue || "Image quality is too poor for AI verification.",
      modelVersion: VERIFICATION_CONFIG.MODEL_VERSION,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      details: {
        sharpnessScore: quality.sharpnessScore,
        brightnessScore: quality.brightnessScore,
        wasteProbability: 0
      }
    };
  }
  const geminiResult = await evaluateWithGeminiVision(imageBase64OrDataUrl, context, issueTypeHint);
  if (geminiResult) {
    return geminiResult;
  }
  return evaluateWithMobileNetCNN(
    decoded.data,
    decoded.width,
    decoded.height,
    quality,
    context,
    issueTypeHint
  );
}

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///C:/Users/saksh/Desktop/GeoClean/New%20folder%20(3)/geoclean/vite.config.ts";
function aiVerificationBackendPlugin() {
  return {
    name: "geoclean-ai-verification-backend",
    configureServer(server) {
      server.middlewares.use("/api/verify-image", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const { image, context = "CITIZEN_BEFORE", issueType } = parsed;
            if (!image) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Image data payload is required." }));
              return;
            }
            const modelResult = await verifyImageWithLevel3AI(image, context, issueType);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(modelResult));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "AI Verification engine error", details: String(err) }));
          }
        });
      });
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), aiVerificationBackendPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2xpYi9haS9iYWNrZW5kTW9kZWxFbmdpbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzYWtzaFxcXFxEZXNrdG9wXFxcXEdlb0NsZWFuXFxcXE5ldyBmb2xkZXIgKDMpXFxcXGdlb2NsZWFuXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzYWtzaFxcXFxEZXNrdG9wXFxcXEdlb0NsZWFuXFxcXE5ldyBmb2xkZXIgKDMpXFxcXGdlb2NsZWFuXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9zYWtzaC9EZXNrdG9wL0dlb0NsZWFuL05ldyUyMGZvbGRlciUyMCgzKS9nZW9jbGVhbi92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgdHlwZSBQbHVnaW4gfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCc7XG5pbXBvcnQgeyB2ZXJpZnlJbWFnZVdpdGhMZXZlbDNBSSB9IGZyb20gJy4vc3JjL2xpYi9haS9iYWNrZW5kTW9kZWxFbmdpbmUnO1xuXG4vKipcbiAqIEJhY2tlbmQgQUkgVmVyaWZpY2F0aW9uIE1pZGRsZXdhcmUgUGx1Z2luXG4gKiBDb25uZWN0cyB0aGUgL2FwaS92ZXJpZnktaW1hZ2UgZW5kcG9pbnQgZGlyZWN0bHkgdG8gdGhlIExldmVsIDMgQUkgTW9kZWwgRW5naW5lLlxuICovXG5mdW5jdGlvbiBhaVZlcmlmaWNhdGlvbkJhY2tlbmRQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnZ2VvY2xlYW4tYWktdmVyaWZpY2F0aW9uLWJhY2tlbmQnLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9hcGkvdmVyaWZ5LWltYWdlJywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNTtcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdNZXRob2Qgbm90IGFsbG93ZWQnIH0pKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYm9keSA9ICcnO1xuICAgICAgICByZXEub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICBib2R5ICs9IGNodW5rO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShib2R5IHx8ICd7fScpO1xuICAgICAgICAgICAgY29uc3QgeyBpbWFnZSwgY29udGV4dCA9ICdDSVRJWkVOX0JFRk9SRScsIGlzc3VlVHlwZSB9ID0gcGFyc2VkO1xuXG4gICAgICAgICAgICBpZiAoIWltYWdlKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbWFnZSBkYXRhIHBheWxvYWQgaXMgcmVxdWlyZWQuJyB9KSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVhbCBMZXZlbCAzIEFJIE1vZGVsIEV4ZWN1dGlvblxuICAgICAgICAgICAgY29uc3QgbW9kZWxSZXN1bHQgPSBhd2FpdCB2ZXJpZnlJbWFnZVdpdGhMZXZlbDNBSShpbWFnZSwgY29udGV4dCwgaXNzdWVUeXBlKTtcblxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShtb2RlbFJlc3VsdCkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDA7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdBSSBWZXJpZmljYXRpb24gZW5naW5lIGVycm9yJywgZGV0YWlsczogU3RyaW5nKGVycikgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuICB9O1xufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGFpVmVyaWZpY2F0aW9uQmFja2VuZFBsdWdpbigpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICB9LFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHNha3NoXFxcXERlc2t0b3BcXFxcR2VvQ2xlYW5cXFxcTmV3IGZvbGRlciAoMylcXFxcZ2VvY2xlYW5cXFxcc3JjXFxcXGxpYlxcXFxhaVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcc2Frc2hcXFxcRGVza3RvcFxcXFxHZW9DbGVhblxcXFxOZXcgZm9sZGVyICgzKVxcXFxnZW9jbGVhblxcXFxzcmNcXFxcbGliXFxcXGFpXFxcXGJhY2tlbmRNb2RlbEVuZ2luZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvc2Frc2gvRGVza3RvcC9HZW9DbGVhbi9OZXclMjBmb2xkZXIlMjAoMykvZ2VvY2xlYW4vc3JjL2xpYi9haS9iYWNrZW5kTW9kZWxFbmdpbmUudHNcIjtpbXBvcnQgKiBhcyB0ZiBmcm9tICdAdGVuc29yZmxvdy90ZmpzJztcbmltcG9ydCAqIGFzIG1vYmlsZW5ldCBmcm9tICdAdGVuc29yZmxvdy1tb2RlbHMvbW9iaWxlbmV0JztcbmltcG9ydCB7IEdvb2dsZUdlbkFJIH0gZnJvbSAnQGdvb2dsZS9nZW5haSc7XG5pbXBvcnQgKiBhcyBqcGVnIGZyb20gJ2pwZWctanMnO1xuaW1wb3J0IHsgUE5HIH0gZnJvbSAncG5nanMnO1xuXG5leHBvcnQgdHlwZSBJbWFnZVF1YWxpdHkgPSAnRVhDRUxMRU5UJyB8ICdHT09EJyB8ICdGQUlSJyB8ICdQT09SJztcblxuZXhwb3J0IGludGVyZmFjZSBNb2RlbFZlcmlmaWNhdGlvblJlc3BvbnNlIHtcbiAgdmVyaWZpZWQ6IGJvb2xlYW47XG4gIHdhc3RlRGV0ZWN0ZWQ6IGJvb2xlYW47XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgY2F0ZWdvcnk6IHN0cmluZztcbiAgcXVhbGl0eTogSW1hZ2VRdWFsaXR5O1xuICBkZXRlY3RlZFdhc3RlVHlwZXM6IHN0cmluZ1tdO1xuICByZWFzb24/OiBzdHJpbmc7XG4gIG1vZGVsVmVyc2lvbjogc3RyaW5nO1xuICB2ZXJpZmllZEF0OiBzdHJpbmc7XG4gIGRldGFpbHM/OiB7XG4gICAgc2hhcnBuZXNzU2NvcmU6IG51bWJlcjtcbiAgICBicmlnaHRuZXNzU2NvcmU6IG51bWJlcjtcbiAgICB3YXN0ZVByb2JhYmlsaXR5OiBudW1iZXI7XG4gICAgY2xlYW5saW5lc3NTY29yZT86IG51bWJlcjtcbiAgICB0b3BQcmVkaWN0aW9ucz86IEFycmF5PHsgbGFiZWw6IHN0cmluZzsgcHJvYmFiaWxpdHk6IG51bWJlciB9PjtcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IFZFUklGSUNBVElPTl9DT05GSUcgPSB7XG4gIENPTkZJREVOQ0VfVEhSRVNIT0xEOiAwLjUwLFxuICBNSU5fU0hBUlBORVNTOiAxMCxcbiAgTUlOX0JSSUdIVE5FU1M6IDE1LFxuICBNQVhfQlJJR0hUTkVTUzogMjQ4LFxuICBNT0RFTF9WRVJTSU9OOiAnZ2VvY2xlYW4tYWktY29udGV4dC12Mi4xJyxcbn07XG5cbi8vIDEuIERlZGljYXRlZCBXYXN0ZSBSZWNlcHRhY2xlcyAmIERpcmVjdCBEdW1waW5nIFNpdGVzIChEaXJlY3Qgd2FzdGUgaW5kaWNhdG9ycylcbmNvbnN0IERFRElDQVRFRF9XQVNURV9QQVRURVJOUyA9IFtcbiAgJ2FzaGNhbicsICd0cmFzaCBjYW4nLCAnZ2FyYmFnZSBjYW4nLCAnd2FzdGViaW4nLCAnZHVzdGJpbicsICd0cmFzaCBiaW4nLFxuICAnZHVtcHN0ZXInLCAndHJhc2ggYmFycmVsJywgJ2dhcmJhZ2UgdHJ1Y2snLCAnZHVzdGNhcnQnLCAnbGFuZGZpbGwnLFxuICAnZHVtcCcsICdydWJiaXNoJywgJ2xpdHRlcicsICdkZWJyaXMnLCAncnViYmxlJywgJ3dyZWNrJ1xuXTtcblxuLy8gMi4gQW1iaWd1b3VzIEV2ZXJ5ZGF5IEhvdXNlaG9sZCBJdGVtcyAoT25seSB3YXN0ZSB3aGVuIGluIGFuIG91dGRvb3Igd2FzdGUgY29udGV4dClcbmNvbnN0IEFNQklHVU9VU19IT1VTRUhPTERfSVRFTVMgPSBbXG4gICdwYWNrZXQnLCAnY2FydG9uJywgJ3dyYXBwZXInLCAnZW52ZWxvcGUnLCAnYm90dGxlJywgJ3dhdGVyIGJvdHRsZScsICdiZWVyIGJvdHRsZScsXG4gICd3aW5lIGJvdHRsZScsICdwb3AgYm90dGxlJywgJ3NvZGEgYm90dGxlJywgJ3BpbGwgYm90dGxlJywgJ2N1cCcsICdjb2ZmZWUgbXVnJyxcbiAgJ3BsYXN0aWMgYmFnJywgJ3Nob3BwaW5nIGJhZycsICdzaG9wcGluZyBiYXNrZXQnLCAncGFwZXIgdG93ZWwnLCAndG9pbGV0IHRpc3N1ZScsXG4gICd0aXNzdWUnLCAndGluIGNhbicsICdjYW4nLCAnYnVja2V0JywgJ3BhaWwnLCAnY3JhdGUnLCAncGxhdGUnLCAnZGlzaCcsICd0cmF5JyxcbiAgJ21peGluZyBib3dsJywgJ3NvdXAgYm93bCcsICdwaXRjaGVyJywgJ3BvdCcsICdwYW4nXG5dO1xuXG4vLyAzLiBEb21lc3RpYyAvIEluZG9vciBGdXJuaXR1cmUsIEZpeHR1cmVzICYgSG91c2Vob2xkIFN1cmZhY2VzXG5jb25zdCBET01FU1RJQ19JTkRPT1JfUEFUVEVSTlMgPSBbXG4gICdiZWQnLCAnc3R1ZGlvIGNvdWNoJywgJ2RheSBiZWQnLCAnZm91ci1wb3N0ZXInLCAncXVpbHQnLCAncGlsbG93JywgJ3NvZmEnLFxuICAnY291Y2gnLCAndGFibGUgbGFtcCcsICdkZXNrJywgJ2RpbmluZyB0YWJsZScsICdjb2ZmZWUgdGFibGUnLCAnd2FyZHJvYmUnLFxuICAnY2xvc2V0JywgJ2Jvb2tjYXNlJywgJ2NoaWZmb25pZXInLCAnY2hlc3Qgb2YgZHJhd2VycycsICdjcmFkbGUnLCAnY3JpYicsXG4gICdiYXNzaW5ldCcsICdyb2NraW5nIGNoYWlyJywgJ2ZvbGRpbmcgY2hhaXInLCAndG9pbGV0IHNlYXQnLCAnYmF0aCB0b3dlbCcsXG4gICd3YXNoY2xvdGgnLCAncGlsbG93Y2FzZScsICdiZWRzcHJlYWQnLCAnY29tZm9ydGVyJywgJ2R1dmV0JywgJ2NhcnBldCcsXG4gICdydWcnLCAnbWF0JywgJ2Rvb3JtYXQnLCAnY3VydGFpbicsICd3aW5kb3cgc2hhZGUnLCAncmVmcmlnZXJhdG9yJyxcbiAgJ21pY3Jvd2F2ZScsICd0b2FzdGVyJywgJ292ZW4nLCAnc3RvdmUnLCAna2l0Y2hlbiBjb3VudGVyJywgJ3NpbmsnLFxuICAnYmF0aHR1YicsICdzaG93ZXIgY3VydGFpbicsICdhcm1jaGFpcicsICdjdXNoaW9uJywgJ2hvbWUgdGhlYXRlcicsXG4gICdlbnRlcnRhaW5tZW50IGNlbnRlcicsICdsYW1wc2hhZGUnLCAncG9sZScsICduYWlsJywgJ3doaXN0bGUnLCAnY2FuZGxlJyxcbiAgJ3BsYXRlIHJhY2snLCAnbWVkaWNpbmUgY2hlc3QnLCAncG90dGVyXFwncyB3aGVlbCcsICdpcm9uaW5nIGJvYXJkJyxcbiAgJ3Nld2luZyBtYWNoaW5lJywgJ3RlbGV2aXNpb24nLCAncmVtb3RlIGNvbnRyb2wnLCAnY2VsbHVsYXIgdGVsZXBob25lJyxcbiAgJ2xhcHRvcCcsICdub3RlYm9vayBjb21wdXRlcicsICdwZW5jaWwgYm94JywgJ3BlbmNpbCBzaGFycGVuZXInLCAnbW91c2VwYWQnXG5dO1xuXG4vLyA0LiBUZXh0LCBQb3N0ZXJzLCBEb2N1bWVudHMgJiBTY3JlZW4gQ2FwdHVyZXNcbmNvbnN0IFRFWFRfUE9TVEVSX1BBVFRFUk5TID0gW1xuICAncnVsZScsICdydWxlcicsICd3ZWIgc2l0ZScsICd3ZWJzaXRlJywgJ3NjcmVlbicsICdtb25pdG9yJywgJ3RlbGV2aXNpb24nLFxuICAnY29taWMgYm9vaycsICdib29rIGphY2tldCcsICdkdXN0IGNvdmVyJywgJ21lbnUnLCAncG9zdGVyJyxcbiAgJ3Njb3JlYm9hcmQnLCAnZGlnaXRhbCBjbG9jaycsICd3YWxsIGNsb2NrJywgJ2FuYWxvZyBjbG9jaycsICdrZXlib2FyZCcsXG4gICdtb3VzZScsICdzcGFjZSBiYXInLCAnbm90ZWJvb2snLCAnYmluZGVyJywgJ3N0cmVldCBzaWduJywgJ3RyYWZmaWMgbGlnaHQnLFxuICAnZW52ZWxvcGUnLCAncGFja2V0J1xuXTtcblxuLy8gNS4gUGVvcGxlLCBBcHBhcmVsICYgU2VsZmllc1xuY29uc3QgUEVSU09OX1BBVFRFUk5TID0gW1xuICAnc3VpdCcsICdncm9vbScsICd0cmVuY2ggY29hdCcsICdqZXJzZXknLCAndC1zaGlydCcsICd0ZWUgc2hpcnQnLCAnd2lnJyxcbiAgJ3N1bmdsYXNzZXMnLCAnZGFyayBnbGFzc2VzJywgJ2JyYXNzaWVyZScsICdiaWtpbmknLCAnYm93IHRpZScsICduZWNrdGllJyxcbiAgJ2dvd24nLCAncm9iZScsICdjYXJkaWdhbicsICdzd2VhdHNoaXJ0JywgJ2Z1ciBjb2F0JywgJ3BlcnNvbicsICdmYWNlJ1xuXTtcblxuLy8gU2luZ2xldG9uIE1vYmlsZU5ldCBtb2RlbCBpbnN0YW5jZSBmb3IgcmV1c2VcbmxldCBjYWNoZWRNb2JpbGVOZXRNb2RlbDogbW9iaWxlbmV0Lk1vYmlsZU5ldCB8IG51bGwgPSBudWxsO1xubGV0IG1vZGVsTG9hZGluZ1Byb21pc2U6IFByb21pc2U8bW9iaWxlbmV0Lk1vYmlsZU5ldD4gfCBudWxsID0gbnVsbDtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0TW9iaWxlTmV0TW9kZWwoKTogUHJvbWlzZTxtb2JpbGVuZXQuTW9iaWxlTmV0PiB7XG4gIGlmIChjYWNoZWRNb2JpbGVOZXRNb2RlbCkgcmV0dXJuIGNhY2hlZE1vYmlsZU5ldE1vZGVsO1xuICBpZiAobW9kZWxMb2FkaW5nUHJvbWlzZSkgcmV0dXJuIG1vZGVsTG9hZGluZ1Byb21pc2U7XG5cbiAgbW9kZWxMb2FkaW5nUHJvbWlzZSA9IG1vYmlsZW5ldC5sb2FkKHsgdmVyc2lvbjogMiwgYWxwaGE6IDEuMCB9KTtcbiAgY2FjaGVkTW9iaWxlTmV0TW9kZWwgPSBhd2FpdCBtb2RlbExvYWRpbmdQcm9taXNlO1xuICBtb2RlbExvYWRpbmdQcm9taXNlID0gbnVsbDtcbiAgcmV0dXJuIGNhY2hlZE1vYmlsZU5ldE1vZGVsO1xufVxuXG4vKipcbiAqIERlY29kZXMgYSBiYXNlNjQgRGF0YSBVUkwgaW50byBSR0JBIHJhdyBwaXhlbHMuXG4gKi9cbmZ1bmN0aW9uIGRlY29kZUJhc2U2NFRvUmdiYShkYXRhVXJsOiBzdHJpbmcpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyBkYXRhOiBVaW50OEFycmF5IHwgQnVmZmVyOyBtaW1lVHlwZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgdHJ5IHtcbiAgICBsZXQgYmFzZTY0ID0gZGF0YVVybDtcbiAgICBsZXQgbWltZVR5cGUgPSAnaW1hZ2UvanBlZyc7XG5cbiAgICBjb25zdCBtYXRjaCA9IGRhdGFVcmwubWF0Y2goL15kYXRhOihbQS1aYS16LSsvXSspO2Jhc2U2NCwoLispJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgbWltZVR5cGUgPSBtYXRjaFsxXTtcbiAgICAgIGJhc2U2NCA9IG1hdGNoWzJdO1xuICAgIH1cblxuICAgIGNvbnN0IGJ1ZmZlciA9IEJ1ZmZlci5mcm9tKGJhc2U2NCwgJ2Jhc2U2NCcpO1xuXG4gICAgLy8gMS4gVHJ5IFBORyBkZWNvZGluZ1xuICAgIGlmIChtaW1lVHlwZS5pbmNsdWRlcygncG5nJykgfHwgKGJ1ZmZlci5sZW5ndGggPiA4ICYmIGJ1ZmZlclswXSA9PT0gMHg4OSAmJiBidWZmZXJbMV0gPT09IDB4NTApKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBwbmcgPSBQTkcuc3luYy5yZWFkKGJ1ZmZlcik7XG4gICAgICAgIHJldHVybiB7IHdpZHRoOiBwbmcud2lkdGgsIGhlaWdodDogcG5nLmhlaWdodCwgZGF0YTogcG5nLmRhdGEsIG1pbWVUeXBlOiAnaW1hZ2UvcG5nJyB9O1xuICAgICAgfSBjYXRjaCB7fVxuICAgIH1cblxuICAgIC8vIDIuIFRyeSBKUEVHIGRlY29kaW5nXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRlY29kZWQgPSBqcGVnLmRlY29kZShidWZmZXIsIHsgdXNlVEFycmF5OiB0cnVlIH0pO1xuICAgICAgaWYgKGRlY29kZWQgJiYgZGVjb2RlZC53aWR0aCA+IDAgJiYgZGVjb2RlZC5oZWlnaHQgPiAwKSB7XG4gICAgICAgIHJldHVybiB7IHdpZHRoOiBkZWNvZGVkLndpZHRoLCBoZWlnaHQ6IGRlY29kZWQuaGVpZ2h0LCBkYXRhOiBkZWNvZGVkLmRhdGEsIG1pbWVUeXBlOiAnaW1hZ2UvanBlZycgfTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHt9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBJbWFnZSBRdWFsaXR5IGFuZCBVc2FiaWxpdHkgQW5hbHlzaXMgdmlhIExhcGxhY2lhbiB2YXJpYW5jZSAmIGx1bWluYW5jZSBkaXN0cmlidXRpb24uXG4gKi9cbmZ1bmN0aW9uIGFuYWx5emVJbWFnZVF1YWxpdHkoXG4gIHJnYmFEYXRhOiBVaW50OEFycmF5IHwgQnVmZmVyLFxuICB3aWR0aDogbnVtYmVyLFxuICBoZWlnaHQ6IG51bWJlclxuKToge1xuICBxdWFsaXR5OiBJbWFnZVF1YWxpdHk7XG4gIHNoYXJwbmVzc1Njb3JlOiBudW1iZXI7XG4gIGJyaWdodG5lc3NTY29yZTogbnVtYmVyO1xuICBpc0FjY2VwdGFibGU6IGJvb2xlYW47XG4gIGlzc3VlPzogc3RyaW5nO1xuICBpc1RleHRQb3N0ZXJMaWtlOiBib29sZWFuO1xuICBjb2xvckVudHJvcHk6IG51bWJlcjtcbn0ge1xuICBjb25zdCB0b3RhbFBpeGVscyA9IHdpZHRoICogaGVpZ2h0O1xuICBpZiAodG90YWxQaXhlbHMgPT09IDApIHtcbiAgICByZXR1cm4geyBxdWFsaXR5OiAnUE9PUicsIHNoYXJwbmVzc1Njb3JlOiAwLCBicmlnaHRuZXNzU2NvcmU6IDAsIGlzQWNjZXB0YWJsZTogZmFsc2UsIGlzc3VlOiAnRW1wdHkgaW1hZ2UgcGF5bG9hZC4nLCBpc1RleHRQb3N0ZXJMaWtlOiBmYWxzZSwgY29sb3JFbnRyb3B5OiAwIH07XG4gIH1cblxuICBsZXQgdG90YWxMdW1pbmFuY2UgPSAwO1xuICBjb25zdCBncmF5c2NhbGUgPSBuZXcgRmxvYXQzMkFycmF5KHRvdGFsUGl4ZWxzKTtcbiAgbGV0IHdoaXRlUGl4ZWxDb3VudCA9IDA7XG4gIGxldCBkYXJrUGl4ZWxDb3VudCA9IDA7XG4gIGNvbnN0IGNvbG9yQnVja2V0cyA9IG5ldyBVaW50MzJBcnJheSgzMik7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b3RhbFBpeGVsczsgaSsrKSB7XG4gICAgY29uc3QgciA9IHJnYmFEYXRhW2kgKiA0XTtcbiAgICBjb25zdCBnID0gcmdiYURhdGFbaSAqIDQgKyAxXTtcbiAgICBjb25zdCBiID0gcmdiYURhdGFbaSAqIDQgKyAyXTtcbiAgICBjb25zdCBsdW0gPSAwLjI5OSAqIHIgKyAwLjU4NyAqIGcgKyAwLjExNCAqIGI7XG4gICAgZ3JheXNjYWxlW2ldID0gbHVtO1xuICAgIHRvdGFsTHVtaW5hbmNlICs9IGx1bTtcblxuICAgIGlmIChsdW0gPiAyMzApIHdoaXRlUGl4ZWxDb3VudCsrO1xuICAgIGlmIChsdW0gPCAzMCkgZGFya1BpeGVsQ291bnQrKztcblxuICAgIGNvbnN0IGJ1Y2tldCA9ICgociA+PiA2KSA8PCAzKSB8ICgoZyA+PiA2KSA8PCAxKSB8IChiID4+IDcpO1xuICAgIGNvbG9yQnVja2V0c1tidWNrZXQgJSAzMl0rKztcbiAgfVxuXG4gIGxldCBhY3RpdmVCdWNrZXRzID0gMDtcbiAgZm9yIChsZXQgYiA9IDA7IGIgPCAzMjsgYisrKSB7XG4gICAgaWYgKGNvbG9yQnVja2V0c1tiXSA+IHRvdGFsUGl4ZWxzICogMC4wMTUpIGFjdGl2ZUJ1Y2tldHMrKztcbiAgfVxuICBjb25zdCBjb2xvckVudHJvcHkgPSBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQoKGFjdGl2ZUJ1Y2tldHMgLyAyNCkgKiAxMDApKTtcblxuICBjb25zdCBhdmdCcmlnaHRuZXNzID0gdG90YWxMdW1pbmFuY2UgLyB0b3RhbFBpeGVscztcbiAgY29uc3QgYnJpZ2h0bmVzc1Njb3JlID0gTWF0aC5yb3VuZCgoYXZnQnJpZ2h0bmVzcyAvIDI1NSkgKiAxMDApO1xuXG4gIGlmIChhdmdCcmlnaHRuZXNzIDwgVkVSSUZJQ0FUSU9OX0NPTkZJRy5NSU5fQlJJR0hUTkVTUykge1xuICAgIHJldHVybiB7XG4gICAgICBxdWFsaXR5OiAnUE9PUicsXG4gICAgICBzaGFycG5lc3NTY29yZTogMCxcbiAgICAgIGJyaWdodG5lc3NTY29yZSxcbiAgICAgIGlzQWNjZXB0YWJsZTogZmFsc2UsXG4gICAgICBpc3N1ZTogJ1RoZSBpbWFnZSBpcyB0b28gZGFyayB0byB2ZXJpZnkgd2FzdGUgaXRlbXMuIFBsZWFzZSB0YWtlIGEgd2VsbC1saXQgcGhvdG8uJyxcbiAgICAgIGlzVGV4dFBvc3Rlckxpa2U6IGZhbHNlLFxuICAgICAgY29sb3JFbnRyb3B5LFxuICAgIH07XG4gIH1cblxuICBpZiAoYXZnQnJpZ2h0bmVzcyA+IFZFUklGSUNBVElPTl9DT05GSUcuTUFYX0JSSUdIVE5FU1MpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcXVhbGl0eTogJ1BPT1InLFxuICAgICAgc2hhcnBuZXNzU2NvcmU6IDAsXG4gICAgICBicmlnaHRuZXNzU2NvcmUsXG4gICAgICBpc0FjY2VwdGFibGU6IGZhbHNlLFxuICAgICAgaXNzdWU6ICdUaGUgaW1hZ2UgaXMgb3ZlcmV4cG9zZWQgb3IgYmxhbmsgd2l0aCBubyBpZGVudGlmaWFibGUgb2JqZWN0cy4nLFxuICAgICAgaXNUZXh0UG9zdGVyTGlrZTogZmFsc2UsXG4gICAgICBjb2xvckVudHJvcHksXG4gICAgfTtcbiAgfVxuXG4gIC8vIDJEIGRpc2NyZXRlIExhcGxhY2lhbiBjb252b2x1dGlvbiBmb3IgYmx1ci9zaGFycG5lc3NcbiAgbGV0IGxhcGxhY2lhblN1bSA9IDA7XG4gIGxldCBjb3VudCA9IDA7XG4gIGNvbnN0IHN0ZXAgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKE1hdGgubWluKHdpZHRoLCBoZWlnaHQpIC8gMTAwKSk7XG5cbiAgZm9yIChsZXQgeSA9IDE7IHkgPCBoZWlnaHQgLSAxOyB5ICs9IHN0ZXApIHtcbiAgICBmb3IgKGxldCB4ID0gMTsgeCA8IHdpZHRoIC0gMTsgeCArPSBzdGVwKSB7XG4gICAgICBjb25zdCBpZHggPSB5ICogd2lkdGggKyB4O1xuICAgICAgY29uc3QgY2VudGVyID0gZ3JheXNjYWxlW2lkeF07XG4gICAgICBjb25zdCBsYXAgPVxuICAgICAgICBncmF5c2NhbGVbaWR4IC0gMV0gK1xuICAgICAgICBncmF5c2NhbGVbaWR4ICsgMV0gK1xuICAgICAgICBncmF5c2NhbGVbaWR4IC0gd2lkdGhdICtcbiAgICAgICAgZ3JheXNjYWxlW2lkeCArIHdpZHRoXSAtXG4gICAgICAgIDQgKiBjZW50ZXI7XG4gICAgICBsYXBsYWNpYW5TdW0gKz0gTWF0aC5hYnMobGFwKTtcbiAgICAgIGNvdW50Kys7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbGFwbGFjaWFuVmFyID0gY291bnQgPiAwID8gbGFwbGFjaWFuU3VtIC8gY291bnQgOiAwO1xuICBjb25zdCBzaGFycG5lc3NTY29yZSA9IE1hdGgubWluKDEwMCwgTWF0aC5yb3VuZChsYXBsYWNpYW5WYXIgKiA0LjIpKTtcblxuICBpZiAoc2hhcnBuZXNzU2NvcmUgPCBWRVJJRklDQVRJT05fQ09ORklHLk1JTl9TSEFSUE5FU1MpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcXVhbGl0eTogJ1BPT1InLFxuICAgICAgc2hhcnBuZXNzU2NvcmUsXG4gICAgICBicmlnaHRuZXNzU2NvcmUsXG4gICAgICBpc0FjY2VwdGFibGU6IGZhbHNlLFxuICAgICAgaXNzdWU6ICdJbWFnZSBpcyB0b28gYmx1cnJ5LiBQbGVhc2UgaG9sZCB5b3VyIGRldmljZSBzdGVhZHkgYW5kIHRha2UgYSBjbGVhciBwaG90by4nLFxuICAgICAgaXNUZXh0UG9zdGVyTGlrZTogZmFsc2UsXG4gICAgICBjb2xvckVudHJvcHksXG4gICAgfTtcbiAgfVxuXG4gIC8vIERldGVjdCBoaWdoLWNvbnRyYXN0IHRleHQgcG9zdGVyIC8gZG9jdW1lbnQgbGF5b3V0XG4gIGNvbnN0IHdoaXRlUmF0aW8gPSB3aGl0ZVBpeGVsQ291bnQgLyB0b3RhbFBpeGVscztcbiAgY29uc3QgZGFya1JhdGlvID0gZGFya1BpeGVsQ291bnQgLyB0b3RhbFBpeGVscztcbiAgY29uc3QgaXNUZXh0UG9zdGVyTGlrZSA9ICh3aGl0ZVJhdGlvID4gMC42NSAmJiBkYXJrUmF0aW8gPiAwLjA1ICYmIGFjdGl2ZUJ1Y2tldHMgPCAxMCkgfHwgKHdoaXRlUmF0aW8gPiAwLjg4KTtcblxuICBjb25zdCBxdWFsaXR5OiBJbWFnZVF1YWxpdHkgPSBzaGFycG5lc3NTY29yZSA+IDM1ID8gJ0dPT0QnIDogJ0ZBSVInO1xuICByZXR1cm4geyBxdWFsaXR5LCBzaGFycG5lc3NTY29yZSwgYnJpZ2h0bmVzc1Njb3JlLCBpc0FjY2VwdGFibGU6IHRydWUsIGlzVGV4dFBvc3Rlckxpa2UsIGNvbG9yRW50cm9weSB9O1xufVxuXG4vKipcbiAqIENvbnRleHQtQXdhcmUgR2VtaW5pIFZpc2lvbiBNdWx0aW1vZGFsIEV2YWx1YXRvclxuICovXG5hc3luYyBmdW5jdGlvbiBldmFsdWF0ZVdpdGhHZW1pbmlWaXNpb24oXG4gIGltYWdlQmFzZTY0OiBzdHJpbmcsXG4gIGNvbnRleHQ6ICdDSVRJWkVOX0JFRk9SRScgfCAnTkdPX0FGVEVSJyxcbiAgaXNzdWVUeXBlSGludD86IHN0cmluZ1xuKTogUHJvbWlzZTxNb2RlbFZlcmlmaWNhdGlvblJlc3BvbnNlIHwgbnVsbD4ge1xuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5HRU1JTklfQVBJX0tFWSB8fCBwcm9jZXNzLmVudi5HT09HTEVfQVBJX0tFWSB8fCBwcm9jZXNzLmVudi5WSVRFX0dFTUlOSV9BUElfS0VZO1xuICBpZiAoIWFwaUtleSkgcmV0dXJuIG51bGw7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhaSA9IG5ldyBHb29nbGVHZW5BSSh7IGFwaUtleSB9KTtcbiAgICBsZXQgbWltZVR5cGUgPSAnaW1hZ2UvanBlZyc7XG4gICAgbGV0IGNsZWFuQmFzZTY0ID0gaW1hZ2VCYXNlNjQ7XG5cbiAgICBjb25zdCBtYXRjaCA9IGltYWdlQmFzZTY0Lm1hdGNoKC9eZGF0YTooW0EtWmEtei0rL10rKTtiYXNlNjQsKC4rKSQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIG1pbWVUeXBlID0gbWF0Y2hbMV07XG4gICAgICBjbGVhbkJhc2U2NCA9IG1hdGNoWzJdO1xuICAgIH1cblxuICAgIGNvbnN0IHByb21wdCA9IGBZb3UgYXJlIEdlb0NsZWFuJ3MgQ29udGV4dC1Bd2FyZSBXYXN0ZSAmIFB1YmxpYyBDbGVhbmxpbmVzcyBBSSBWZXJpZmljYXRpb24gTW9kZWwuXG5cbkNSSVRJQ0FMIE9CSkVDVCBWUyBXQVNURSBESVNUSU5DVElPTjpcbi0gT2JqZWN0IGRldGVjdGlvbiBpcyBOT1Qgd2FzdGUgdmVyaWZpY2F0aW9uLlxuLSBBIHNpbmdsZSBldmVyeWRheSBvYmplY3QgKHN1Y2ggYXMgYSBzbmFjayBwYWNrZXQsIHBsYXN0aWMgYm90dGxlLCBwYXBlciwgY3VwLCBvciBiYWcpIG9uIGEgYmVkLCBxdWlsdCwgdGFibGUsIGRlc2ssIHNoZWxmLCBraXRjaGVuIGNvdW50ZXIsIGluIGEgcm9vbSwgb3IgaW4gYSBwZXJzb24ncyBoYW5kIGlzIE5PVCBhIHdhc3RlIHJlcG9ydC4gSXQgaXMgYSBkb21lc3RpYyBob3VzZWhvbGQgb2JqZWN0IGluIG5vcm1hbCB1c2UuXG4tIFNldCB3YXN0ZURldGVjdGVkOiBmYWxzZSBhbmQgdmVyaWZpZWQ6IGZhbHNlIGZvcjpcbiAgKiBBIHBhY2tldCBseWluZyBvbiBhIGJlZC9xdWlsdC9waWxsb3cvdGFibGUvZGVza1xuICAqIEEgYm90dGxlIG9yIGN1cCBvbiBhIGRlc2svdGFibGUvc2hlbGZcbiAgKiBNb3RpdmF0aW9uYWwgdGV4dCBwb3N0ZXJzLCBxdW90ZXMgKGUuZy4gXCJXSE8gWU9VIFdBTlQgVE8gQkVcIiksIHNjcmVlbnNob3RzLCBkb2N1bWVudHMsIHNsaWRlc1xuICAqIFNlbGZpZXMsIHBvcnRyYWl0cywgY2xlYW4gbGFuZHNjYXBlcywgY2xlYW4gcm9vbXNcbi0gT05MWSBzZXQgd2FzdGVEZXRlY3RlZDogdHJ1ZSBhbmQgdmVyaWZpZWQ6IHRydWUgaWY6XG4gICogSXQgaXMgYSBnZW51aW5lIHB1YmxpYyB3YXN0ZS9jbGVhbmxpbmVzcyBpc3N1ZVxuICAqIEV4YW1wbGVzOiBHYXJiYWdlIGR1bXAvcGlsZSwgcm9hZHNpZGUgZGlzY2FyZGVkIGxpdHRlciwgb3ZlcmZsb3dpbmcgdHJhc2ggYmluL2R1bXBzdGVyLCBzY2F0dGVyZWQgcGxhc3RpYyBwb2xsdXRpb24gb24gb3V0ZG9vciBncm91bmQvc3RyZWV0L2RyYWluYWdlLCBjb25zdHJ1Y3Rpb24gZGVicmlzIGR1bXAuXG5cbkNvbnRleHQ6ICR7Y29udGV4dCA9PT0gJ05HT19BRlRFUicgPyAnTkdPIENsZWFudXAgQ29tcGxldGlvbiBQaG90byAodmVyaWZ5IGNsZWFuIGFyZWEgd2l0aG91dCBnYXJiYWdlKScgOiAnQ2l0aXplbiBXYXN0ZSBJc3N1ZSBSZXBvcnQnfVxuSXNzdWUgSGludDogJHtpc3N1ZVR5cGVIaW50IHx8ICdOb25lJ31cblxuUmV0dXJuIE9OTFkgdmFsaWQgSlNPTjpcbntcbiAgXCJ2ZXJpZmllZFwiOiBib29sZWFuLFxuICBcIndhc3RlRGV0ZWN0ZWRcIjogYm9vbGVhbixcbiAgXCJjb25maWRlbmNlXCI6IG51bWJlcixcbiAgXCJjYXRlZ29yeVwiOiBzdHJpbmcsXG4gIFwicXVhbGl0eVwiOiBcIkdPT0RcIiB8IFwiRkFJUlwiIHwgXCJQT09SXCIsXG4gIFwiZGV0ZWN0ZWRXYXN0ZVR5cGVzXCI6IHN0cmluZ1tdLFxuICBcInJlYXNvblwiOiBzdHJpbmdcbn1gO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhaS5tb2RlbHMuZ2VuZXJhdGVDb250ZW50KHtcbiAgICAgIG1vZGVsOiAnZ2VtaW5pLTIuNS1mbGFzaCcsXG4gICAgICBjb250ZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgIHBhcnRzOiBbXG4gICAgICAgICAgICB7IHRleHQ6IHByb21wdCB9LFxuICAgICAgICAgICAgeyBpbmxpbmVEYXRhOiB7IGRhdGE6IGNsZWFuQmFzZTY0LCBtaW1lVHlwZSB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBjb25maWc6IHtcbiAgICAgICAgcmVzcG9uc2VNaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHRleHQgPSByZXNwb25zZS50ZXh0O1xuICAgIGlmICghdGV4dCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKHRleHQpO1xuICAgIGNvbnN0IHF1YWxpdHk6IEltYWdlUXVhbGl0eSA9IFsnRVhDRUxMRU5UJywgJ0dPT0QnLCAnRkFJUicsICdQT09SJ10uaW5jbHVkZXMocGFyc2VkLnF1YWxpdHkpID8gcGFyc2VkLnF1YWxpdHkgOiAnR09PRCc7XG4gICAgY29uc3QgY29uZmlkZW5jZSA9IHR5cGVvZiBwYXJzZWQuY29uZmlkZW5jZSA9PT0gJ251bWJlcicgPyBNYXRoLm1pbigwLjk5LCBNYXRoLm1heCgwLjAxLCBwYXJzZWQuY29uZmlkZW5jZSkpIDogMC44NTtcbiAgICBjb25zdCB3YXN0ZURldGVjdGVkID0gQm9vbGVhbihwYXJzZWQud2FzdGVEZXRlY3RlZCk7XG5cbiAgICBjb25zdCB2ZXJpZmllZCA9IChjb250ZXh0ID09PSAnTkdPX0FGVEVSJyA/IHRydWUgOiB3YXN0ZURldGVjdGVkKSAmJiBjb25maWRlbmNlID49IFZFUklGSUNBVElPTl9DT05GSUcuQ09ORklERU5DRV9USFJFU0hPTEQgJiYgcXVhbGl0eSAhPT0gJ1BPT1InO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZlcmlmaWVkLFxuICAgICAgd2FzdGVEZXRlY3RlZCxcbiAgICAgIGNvbmZpZGVuY2UsXG4gICAgICBjYXRlZ29yeTogcGFyc2VkLmNhdGVnb3J5IHx8ICh3YXN0ZURldGVjdGVkID8gKGlzc3VlVHlwZUhpbnQgfHwgJ01peGVkIEdhcmJhZ2UnKSA6ICdOb24tV2FzdGUgSW1hZ2UnKSxcbiAgICAgIHF1YWxpdHksXG4gICAgICBkZXRlY3RlZFdhc3RlVHlwZXM6IEFycmF5LmlzQXJyYXkocGFyc2VkLmRldGVjdGVkV2FzdGVUeXBlcykgPyBwYXJzZWQuZGV0ZWN0ZWRXYXN0ZVR5cGVzIDogKHdhc3RlRGV0ZWN0ZWQgPyBbcGFyc2VkLmNhdGVnb3J5XSA6IFtdKSxcbiAgICAgIHJlYXNvbjogcGFyc2VkLnJlYXNvbiB8fCAodmVyaWZpZWQgPyAnV2FzdGUgaXNzdWUgdmVyaWZpZWQgYnkgR2VvQ2xlYW4gQUkuJyA6ICdObyByZWxldmFudCB3YXN0ZSBpc3N1ZSBkZXRlY3RlZC4nKSxcbiAgICAgIG1vZGVsVmVyc2lvbjogJ2dlb2NsZWFuLWdlbWluaS0yLjUtZmxhc2gnLFxuICAgICAgdmVyaWZpZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgZGV0YWlsczoge1xuICAgICAgICBzaGFycG5lc3NTY29yZTogcXVhbGl0eSA9PT0gJ0dPT0QnID8gODUgOiA0NSxcbiAgICAgICAgYnJpZ2h0bmVzc1Njb3JlOiA3NSxcbiAgICAgICAgd2FzdGVQcm9iYWJpbGl0eTogd2FzdGVEZXRlY3RlZCA/IGNvbmZpZGVuY2UgOiAwLjA1LFxuICAgICAgICBjbGVhbmxpbmVzc1Njb3JlOiB3YXN0ZURldGVjdGVkID8gTWF0aC5yb3VuZCgoMSAtIGNvbmZpZGVuY2UpICogMTAwKSA6IDk1LFxuICAgICAgfSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdHZW1pbmkgVmlzaW9uIEFQSSBFeGVjdXRpb24gRXJyb3I6JywgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIENvbnRleHQtQXdhcmUgRGVlcCBOZXVyYWwgTmV0d29yayAoTW9iaWxlTmV0IEltYWdlTmV0KSBDbGFzc2lmaWVyLlxuICogQW5hbHl6ZXMgb2JqZWN0IHR5cGVzLCBlbnZpcm9ubWVudGFsIHN1cmZhY2VzLCBhbmQgd2FzdGUgY29udGV4dC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZXZhbHVhdGVXaXRoTW9iaWxlTmV0Q05OKFxuICByZ2JhRGF0YTogVWludDhBcnJheSB8IEJ1ZmZlcixcbiAgd2lkdGg6IG51bWJlcixcbiAgaGVpZ2h0OiBudW1iZXIsXG4gIHF1YWxpdHlBbmFseXNpczogeyBxdWFsaXR5OiBJbWFnZVF1YWxpdHk7IHNoYXJwbmVzc1Njb3JlOiBudW1iZXI7IGJyaWdodG5lc3NTY29yZTogbnVtYmVyOyBpc1RleHRQb3N0ZXJMaWtlOiBib29sZWFuOyBjb2xvckVudHJvcHk6IG51bWJlciB9LFxuICBjb250ZXh0OiAnQ0lUSVpFTl9CRUZPUkUnIHwgJ05HT19BRlRFUicsXG4gIGlzc3VlVHlwZUhpbnQ/OiBzdHJpbmdcbik6IFByb21pc2U8TW9kZWxWZXJpZmljYXRpb25SZXNwb25zZT4ge1xuICBjb25zdCBtb2RlbCA9IGF3YWl0IGdldE1vYmlsZU5ldE1vZGVsKCk7XG5cbiAgLy8gUmVzaXplIGFuZCBjcmVhdGUgM0QgUkdCIFRlbnNvciBbMjI0LCAyMjQsIDNdIGZvciBNb2JpbGVOZXRcbiAgY29uc3QgdGFyZ2V0VyA9IDIyNDtcbiAgY29uc3QgdGFyZ2V0SCA9IDIyNDtcbiAgY29uc3QgcmdiVmFsdWVzID0gbmV3IEludDMyQXJyYXkodGFyZ2V0VyAqIHRhcmdldEggKiAzKTtcblxuICBmb3IgKGxldCBkeSA9IDA7IGR5IDwgdGFyZ2V0SDsgZHkrKykge1xuICAgIGNvbnN0IHN5ID0gTWF0aC5mbG9vcigoZHkgKiBoZWlnaHQpIC8gdGFyZ2V0SCk7XG4gICAgZm9yIChsZXQgZHggPSAwOyBkeCA8IHRhcmdldFc7IGR4KyspIHtcbiAgICAgIGNvbnN0IHN4ID0gTWF0aC5mbG9vcigoZHggKiB3aWR0aCkgLyB0YXJnZXRXKTtcbiAgICAgIGNvbnN0IHNyY0lkeCA9IChzeSAqIHdpZHRoICsgc3gpICogNDtcbiAgICAgIGNvbnN0IGRzdElkeCA9IChkeSAqIHRhcmdldFcgKyBkeCkgKiAzO1xuXG4gICAgICByZ2JWYWx1ZXNbZHN0SWR4XSA9IHJnYmFEYXRhW3NyY0lkeF07ICAgICAgICAgLy8gUlxuICAgICAgcmdiVmFsdWVzW2RzdElkeCArIDFdID0gcmdiYURhdGFbc3JjSWR4ICsgMV07IC8vIEdcbiAgICAgIHJnYlZhbHVlc1tkc3RJZHggKyAyXSA9IHJnYmFEYXRhW3NyY0lkeCArIDJdOyAvLyBCXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdGVuc29yID0gdGYudGVuc29yM2QocmdiVmFsdWVzLCBbdGFyZ2V0SCwgdGFyZ2V0VywgM10sICdpbnQzMicpO1xuICBjb25zdCBwcmVkaWN0aW9ucyA9IGF3YWl0IG1vZGVsLmNsYXNzaWZ5KHRlbnNvciwgMTUpO1xuICB0ZW5zb3IuZGlzcG9zZSgpO1xuXG4gIGxldCBkZWRpY2F0ZWRXYXN0ZVNjb3JlID0gMDtcbiAgbGV0IGFtYmlndW91c0l0ZW1TY29yZSA9IDA7XG4gIGxldCBkb21lc3RpY0luZG9vclNjb3JlID0gMDtcbiAgbGV0IHRleHRQb3N0ZXJTY29yZSA9IDA7XG4gIGxldCBwZXJzb25TY29yZSA9IDA7XG5cbiAgbGV0IGJlc3RXYXN0ZUNsYXNzID0gJyc7XG4gIGxldCB0b3BOb25XYXN0ZUNsYXNzID0gJyc7XG4gIGxldCB0b3BOb25XYXN0ZVByb2IgPSAwO1xuXG4gIGNvbnN0IGRldGVjdGVkV2FzdGVMaXN0OiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBkZXRlY3RlZERvbWVzdGljTGlzdDogc3RyaW5nW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHByZWQgb2YgcHJlZGljdGlvbnMpIHtcbiAgICBjb25zdCBsYWJlbExvd2VyID0gcHJlZC5jbGFzc05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBwcm9iID0gcHJlZC5wcm9iYWJpbGl0eTtcblxuICAgIC8vIDEuIENoZWNrIERlZGljYXRlZCBXYXN0ZSBSZWNlcHRhY2xlIC8gRHVtcGluZyBTaXRlXG4gICAgY29uc3QgaXNEZWRpY2F0ZWRXYXN0ZSA9IERFRElDQVRFRF9XQVNURV9QQVRURVJOUy5zb21lKChwKSA9PiBsYWJlbExvd2VyLmluY2x1ZGVzKHApKTtcbiAgICBpZiAoaXNEZWRpY2F0ZWRXYXN0ZSkge1xuICAgICAgZGVkaWNhdGVkV2FzdGVTY29yZSArPSBwcm9iO1xuICAgICAgaWYgKCFiZXN0V2FzdGVDbGFzcyB8fCBwcm9iID4gZGVkaWNhdGVkV2FzdGVTY29yZSAqIDAuNSkge1xuICAgICAgICBiZXN0V2FzdGVDbGFzcyA9IHByZWQuY2xhc3NOYW1lLnNwbGl0KCcsJylbMF0udHJpbSgpO1xuICAgICAgfVxuICAgICAgY29uc3QgZm10ID0gcHJlZC5jbGFzc05hbWUuc3BsaXQoJywnKVswXS50cmltKCk7XG4gICAgICBpZiAoIWRldGVjdGVkV2FzdGVMaXN0LmluY2x1ZGVzKGZtdCkpIGRldGVjdGVkV2FzdGVMaXN0LnB1c2goZm10KTtcbiAgICB9XG5cbiAgICAvLyAyLiBDaGVjayBBbWJpZ3VvdXMgRXZlcnlkYXkgSG91c2Vob2xkIEl0ZW1cbiAgICBjb25zdCBpc0FtYmlndW91c0l0ZW0gPSBBTUJJR1VPVVNfSE9VU0VIT0xEX0lURU1TLnNvbWUoKHApID0+IGxhYmVsTG93ZXIuaW5jbHVkZXMocCkpO1xuICAgIGlmIChpc0FtYmlndW91c0l0ZW0pIHtcbiAgICAgIGFtYmlndW91c0l0ZW1TY29yZSArPSBwcm9iO1xuICAgICAgY29uc3QgZm10ID0gcHJlZC5jbGFzc05hbWUuc3BsaXQoJywnKVswXS50cmltKCk7XG4gICAgICBpZiAoIWRldGVjdGVkV2FzdGVMaXN0LmluY2x1ZGVzKGZtdCkpIGRldGVjdGVkV2FzdGVMaXN0LnB1c2goZm10KTtcbiAgICB9XG5cbiAgICAvLyAzLiBDaGVjayBEb21lc3RpYyAvIEluZG9vciBGdXJuaXR1cmUgJiBTdXJmYWNlc1xuICAgIGNvbnN0IGlzRG9tZXN0aWMgPSBET01FU1RJQ19JTkRPT1JfUEFUVEVSTlMuc29tZSgocCkgPT4gbGFiZWxMb3dlci5pbmNsdWRlcyhwKSk7XG4gICAgaWYgKGlzRG9tZXN0aWMpIHtcbiAgICAgIGRvbWVzdGljSW5kb29yU2NvcmUgKz0gcHJvYjtcbiAgICAgIGNvbnN0IGZtdCA9IHByZWQuY2xhc3NOYW1lLnNwbGl0KCcsJylbMF0udHJpbSgpO1xuICAgICAgaWYgKCFkZXRlY3RlZERvbWVzdGljTGlzdC5pbmNsdWRlcyhmbXQpKSBkZXRlY3RlZERvbWVzdGljTGlzdC5wdXNoKGZtdCk7XG4gICAgfVxuXG4gICAgLy8gNC4gQ2hlY2sgVGV4dCAvIFBvc3RlcnMgLyBTY3JlZW5zaG90c1xuICAgIGNvbnN0IGlzVGV4dFBvc3RlciA9IFRFWFRfUE9TVEVSX1BBVFRFUk5TLnNvbWUoKHApID0+IGxhYmVsTG93ZXIuaW5jbHVkZXMocCkpO1xuICAgIGlmIChpc1RleHRQb3N0ZXIpIHtcbiAgICAgIHRleHRQb3N0ZXJTY29yZSArPSBwcm9iO1xuICAgIH1cblxuICAgIC8vIDUuIENoZWNrIFBlcnNvbiAvIEFwcGFyZWxcbiAgICBjb25zdCBpc1BlcnNvbiA9IFBFUlNPTl9QQVRURVJOUy5zb21lKChwKSA9PiBsYWJlbExvd2VyLmluY2x1ZGVzKHApKTtcbiAgICBpZiAoaXNQZXJzb24pIHtcbiAgICAgIHBlcnNvblNjb3JlICs9IHByb2I7XG4gICAgfVxuXG4gICAgLy8gVHJhY2sgaGlnaGVzdCBub24td2FzdGUgcHJlZGljdGlvblxuICAgIGlmICghaXNEZWRpY2F0ZWRXYXN0ZSAmJiAhaXNBbWJpZ3VvdXNJdGVtICYmIHByb2IgPiB0b3BOb25XYXN0ZVByb2IpIHtcbiAgICAgIHRvcE5vbldhc3RlUHJvYiA9IHByb2I7XG4gICAgICB0b3BOb25XYXN0ZUNsYXNzID0gcHJlZC5jbGFzc05hbWUuc3BsaXQoJywnKVswXS50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSGFuZGxlIE5HTyBjbGVhbnVwIHBob3RvXG4gIGlmIChjb250ZXh0ID09PSAnTkdPX0FGVEVSJykge1xuICAgIGNvbnN0IGlzQ2xlYW4gPSBkZWRpY2F0ZWRXYXN0ZVNjb3JlIDwgMC4wNSAmJiBhbWJpZ3VvdXNJdGVtU2NvcmUgPCAwLjIwO1xuICAgIGNvbnN0IGNvbmZpZGVuY2UgPSAwLjkzO1xuICAgIHJldHVybiB7XG4gICAgICB2ZXJpZmllZDogaXNDbGVhbixcbiAgICAgIHdhc3RlRGV0ZWN0ZWQ6IGZhbHNlLFxuICAgICAgY29uZmlkZW5jZSxcbiAgICAgIGNhdGVnb3J5OiBpc0NsZWFuID8gJ0NsZWFuZWQgQXJlYScgOiAnUmVzaWR1YWwgV2FzdGUgRGV0ZWN0ZWQnLFxuICAgICAgcXVhbGl0eTogcXVhbGl0eUFuYWx5c2lzLnF1YWxpdHksXG4gICAgICBkZXRlY3RlZFdhc3RlVHlwZXM6IGlzQ2xlYW4gPyBbJ0NsZWFuZWQgU2l0ZScsICdXYXN0ZSBSZW1vdmVkJ10gOiBkZXRlY3RlZFdhc3RlTGlzdCxcbiAgICAgIHJlYXNvbjogaXNDbGVhbiA/ICdBcmVhIHZlcmlmaWVkIGFzIGNsZWFuIGFuZCBmcmVlIG9mIHZpc2libGUgd2FzdGUuJyA6ICdSZXNpZHVhbCB3YXN0ZSBzdGlsbCBkZXRlY3RlZCBhdCBzaXRlLicsXG4gICAgICBtb2RlbFZlcnNpb246IFZFUklGSUNBVElPTl9DT05GSUcuTU9ERUxfVkVSU0lPTixcbiAgICAgIHZlcmlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgc2hhcnBuZXNzU2NvcmU6IHF1YWxpdHlBbmFseXNpcy5zaGFycG5lc3NTY29yZSxcbiAgICAgICAgYnJpZ2h0bmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuYnJpZ2h0bmVzc1Njb3JlLFxuICAgICAgICB3YXN0ZVByb2JhYmlsaXR5OiBkZWRpY2F0ZWRXYXN0ZVNjb3JlICsgYW1iaWd1b3VzSXRlbVNjb3JlLFxuICAgICAgICBjbGVhbmxpbmVzc1Njb3JlOiA5NSxcbiAgICAgICAgdG9wUHJlZGljdGlvbnM6IHByZWRpY3Rpb25zLm1hcCgocCkgPT4gKHsgbGFiZWw6IHAuY2xhc3NOYW1lLCBwcm9iYWJpbGl0eTogcC5wcm9iYWJpbGl0eSB9KSksXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyAxLiBSRUpFQ1QgVGV4dCAvIE1vdGl2YXRpb25hbCBQb3N0ZXJzIC8gRG9jdW1lbnQgU2NyZWVuc2hvdHNcbiAgaWYgKHF1YWxpdHlBbmFseXNpcy5pc1RleHRQb3N0ZXJMaWtlIHx8ICh0ZXh0UG9zdGVyU2NvcmUgPiAwLjA1ICYmIGRlZGljYXRlZFdhc3RlU2NvcmUgPCAwLjAzKSkge1xuICAgIGNvbnN0IG5vbldhc3RlQ29uZiA9IE1hdGgubWluKDAuOTYsIE1hdGgubWF4KDAuODUsIHRleHRQb3N0ZXJTY29yZSArIDAuNjApKTtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgd2FzdGVEZXRlY3RlZDogZmFsc2UsXG4gICAgICBjb25maWRlbmNlOiBNYXRoLnJvdW5kKG5vbldhc3RlQ29uZiAqIDEwMCkgLyAxMDAsXG4gICAgICBjYXRlZ29yeTogJ05vbi1XYXN0ZSBJbWFnZSAoVGV4dCAvIFBvc3RlciknLFxuICAgICAgcXVhbGl0eTogcXVhbGl0eUFuYWx5c2lzLnF1YWxpdHksXG4gICAgICBkZXRlY3RlZFdhc3RlVHlwZXM6IFtdLFxuICAgICAgcmVhc29uOiAnTm8gcmVsZXZhbnQgd2FzdGUgd2FzIGRldGVjdGVkLiBUaGUgaW1hZ2UgYXBwZWFycyB0byBjb250YWluIHRleHQsIGdyYXBoaWNzLCBvciBwb3N0ZXIgY29udGVudC4nLFxuICAgICAgbW9kZWxWZXJzaW9uOiBWRVJJRklDQVRJT05fQ09ORklHLk1PREVMX1ZFUlNJT04sXG4gICAgICB2ZXJpZmllZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBkZXRhaWxzOiB7XG4gICAgICAgIHNoYXJwbmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuc2hhcnBuZXNzU2NvcmUsXG4gICAgICAgIGJyaWdodG5lc3NTY29yZTogcXVhbGl0eUFuYWx5c2lzLmJyaWdodG5lc3NTY29yZSxcbiAgICAgICAgd2FzdGVQcm9iYWJpbGl0eTogMC4wMixcbiAgICAgICAgY2xlYW5saW5lc3NTY29yZTogOTUsXG4gICAgICAgIHRvcFByZWRpY3Rpb25zOiBwcmVkaWN0aW9ucy5tYXAoKHApID0+ICh7IGxhYmVsOiBwLmNsYXNzTmFtZSwgcHJvYmFiaWxpdHk6IHAucHJvYmFiaWxpdHkgfSkpLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gMi4gUkVKRUNUIERvbWVzdGljIC8gSW5kb29yIFNldHRpbmcgKGUuZy4gc2luZ2xlIHBhY2tldCBvbiBiZWQvcXVpbHQvdGFibGUvZGVzaylcbiAgLy8gV2hlbiBpbmRvb3IvZG9tZXN0aWMgc3VyZmFjZXMgYXJlIGRldGVjdGVkIGFuZCBubyBkZWRpY2F0ZWQgcHVibGljIHdhc3RlIHJlY2VwdGFjbGUgaXMgcHJlc2VudFxuICBpZiAoKGRvbWVzdGljSW5kb29yU2NvcmUgPiAwLjAxIHx8IGRldGVjdGVkRG9tZXN0aWNMaXN0Lmxlbmd0aCA+IDApICYmIGRlZGljYXRlZFdhc3RlU2NvcmUgPCAwLjAzKSB7XG4gICAgY29uc3Qgbm9uV2FzdGVDb25mID0gTWF0aC5taW4oMC45NSwgTWF0aC5tYXgoMC44MiwgZG9tZXN0aWNJbmRvb3JTY29yZSArIDAuNjApKTtcbiAgICBjb25zdCBkZXRlY3RlZENvbnRleHQgPSBkZXRlY3RlZERvbWVzdGljTGlzdFswXSB8fCAnSW5kb29yIC8gRnVybml0dXJlJztcbiAgICByZXR1cm4ge1xuICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgd2FzdGVEZXRlY3RlZDogZmFsc2UsXG4gICAgICBjb25maWRlbmNlOiBNYXRoLnJvdW5kKG5vbldhc3RlQ29uZiAqIDEwMCkgLyAxMDAsXG4gICAgICBjYXRlZ29yeTogYE5vbi1XYXN0ZSAoJHtkZXRlY3RlZENvbnRleHR9KWAsXG4gICAgICBxdWFsaXR5OiBxdWFsaXR5QW5hbHlzaXMucXVhbGl0eSxcbiAgICAgIGRldGVjdGVkV2FzdGVUeXBlczogW10sXG4gICAgICByZWFzb246IGBObyByZWxldmFudCB3YXN0ZSBpc3N1ZSBkZXRlY3RlZC4gVGhlIG9iamVjdCBpcyBpbiBhbiBpbmRvb3IvZG9tZXN0aWMgc2V0dGluZyAoJHtkZXRlY3RlZENvbnRleHR9KSBhbmQgaXMgbm90IGRpc2NhcmRlZCB3YXN0ZS5gLFxuICAgICAgbW9kZWxWZXJzaW9uOiBWRVJJRklDQVRJT05fQ09ORklHLk1PREVMX1ZFUlNJT04sXG4gICAgICB2ZXJpZmllZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBkZXRhaWxzOiB7XG4gICAgICAgIHNoYXJwbmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuc2hhcnBuZXNzU2NvcmUsXG4gICAgICAgIGJyaWdodG5lc3NTY29yZTogcXVhbGl0eUFuYWx5c2lzLmJyaWdodG5lc3NTY29yZSxcbiAgICAgICAgd2FzdGVQcm9iYWJpbGl0eTogMC4wNCxcbiAgICAgICAgY2xlYW5saW5lc3NTY29yZTogOTIsXG4gICAgICAgIHRvcFByZWRpY3Rpb25zOiBwcmVkaWN0aW9ucy5tYXAoKHApID0+ICh7IGxhYmVsOiBwLmNsYXNzTmFtZSwgcHJvYmFiaWxpdHk6IHAucHJvYmFiaWxpdHkgfSkpLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gMy4gUkVKRUNUIFBlcnNvbiAvIFBvcnRyYWl0IC8gU2VsZmllXG4gIGlmIChwZXJzb25TY29yZSA+IDAuMTIgJiYgZGVkaWNhdGVkV2FzdGVTY29yZSA8IDAuMDMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgd2FzdGVEZXRlY3RlZDogZmFsc2UsXG4gICAgICBjb25maWRlbmNlOiAwLjg4LFxuICAgICAgY2F0ZWdvcnk6ICdOb24tV2FzdGUgKFBlcnNvbiAvIFBvcnRyYWl0KScsXG4gICAgICBxdWFsaXR5OiBxdWFsaXR5QW5hbHlzaXMucXVhbGl0eSxcbiAgICAgIGRldGVjdGVkV2FzdGVUeXBlczogW10sXG4gICAgICByZWFzb246ICdObyByZWxldmFudCB3YXN0ZSB3YXMgZGV0ZWN0ZWQuIFRoZSBpbWFnZSBhcHBlYXJzIHRvIGJlIGEgcG9ydHJhaXQgb3IgcGVyc29uIHdpdGggbm8gdmlzaWJsZSB3YXN0ZSBkdW1wLicsXG4gICAgICBtb2RlbFZlcnNpb246IFZFUklGSUNBVElPTl9DT05GSUcuTU9ERUxfVkVSU0lPTixcbiAgICAgIHZlcmlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgc2hhcnBuZXNzU2NvcmU6IHF1YWxpdHlBbmFseXNpcy5zaGFycG5lc3NTY29yZSxcbiAgICAgICAgYnJpZ2h0bmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuYnJpZ2h0bmVzc1Njb3JlLFxuICAgICAgICB3YXN0ZVByb2JhYmlsaXR5OiAwLjAzLFxuICAgICAgICBjbGVhbmxpbmVzc1Njb3JlOiA5NSxcbiAgICAgICAgdG9wUHJlZGljdGlvbnM6IHByZWRpY3Rpb25zLm1hcCgocCkgPT4gKHsgbGFiZWw6IHAuY2xhc3NOYW1lLCBwcm9iYWJpbGl0eTogcC5wcm9iYWJpbGl0eSB9KSksXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyA0LiBWRVJJRlkgRGVkaWNhdGVkIFdhc3RlIFJlY2VwdGFjbGUgKGUuZy4gYXNoY2FuLCB0cmFzaCBjYW4sIGR1bXBzdGVyLCBsYW5kZmlsbClcbiAgaWYgKGRlZGljYXRlZFdhc3RlU2NvcmUgPj0gMC4wMykge1xuICAgIGNvbnN0IHdhc3RlQ29uZmlkZW5jZSA9IE1hdGgubWluKDAuOTYsIE1hdGgubWF4KDAuNjgsIE1hdGgucm91bmQoKGRlZGljYXRlZFdhc3RlU2NvcmUgKiA1LjAgKyAwLjQ1KSAqIDEwMCkgLyAxMDApKTtcbiAgICBjb25zdCBmaW5hbENhdGVnb3J5ID0gYmVzdFdhc3RlQ2xhc3MgfHwgaXNzdWVUeXBlSGludCB8fCAnT3ZlcmZsb3dpbmcgR2FyYmFnZSBCaW4nO1xuICAgIHJldHVybiB7XG4gICAgICB2ZXJpZmllZDogdHJ1ZSxcbiAgICAgIHdhc3RlRGV0ZWN0ZWQ6IHRydWUsXG4gICAgICBjb25maWRlbmNlOiB3YXN0ZUNvbmZpZGVuY2UsXG4gICAgICBjYXRlZ29yeTogZmluYWxDYXRlZ29yeSxcbiAgICAgIHF1YWxpdHk6IHF1YWxpdHlBbmFseXNpcy5xdWFsaXR5LFxuICAgICAgZGV0ZWN0ZWRXYXN0ZVR5cGVzOiBkZXRlY3RlZFdhc3RlTGlzdC5sZW5ndGggPyBkZXRlY3RlZFdhc3RlTGlzdCA6IFtmaW5hbENhdGVnb3J5XSxcbiAgICAgIHJlYXNvbjogJ1dhc3RlIGlzc3VlIHZlcmlmaWVkIGJ5IEdlb0NsZWFuIEFJIE1vZGVsLicsXG4gICAgICBtb2RlbFZlcnNpb246IFZFUklGSUNBVElPTl9DT05GSUcuTU9ERUxfVkVSU0lPTixcbiAgICAgIHZlcmlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgc2hhcnBuZXNzU2NvcmU6IHF1YWxpdHlBbmFseXNpcy5zaGFycG5lc3NTY29yZSxcbiAgICAgICAgYnJpZ2h0bmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuYnJpZ2h0bmVzc1Njb3JlLFxuICAgICAgICB3YXN0ZVByb2JhYmlsaXR5OiB3YXN0ZUNvbmZpZGVuY2UsXG4gICAgICAgIGNsZWFubGluZXNzU2NvcmU6IE1hdGgucm91bmQoKDEgLSB3YXN0ZUNvbmZpZGVuY2UpICogMTAwKSxcbiAgICAgICAgdG9wUHJlZGljdGlvbnM6IHByZWRpY3Rpb25zLm1hcCgocCkgPT4gKHsgbGFiZWw6IHAuY2xhc3NOYW1lLCBwcm9iYWJpbGl0eTogcC5wcm9iYWJpbGl0eSB9KSksXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyA1LiBFVkFMVUFURSBBbWJpZ3VvdXMgSG91c2Vob2xkIEl0ZW1zIG9uIE91dGRvb3IgR3JvdW5kIHZzIElzb2xhdGVkIEl0ZW1cbiAgaWYgKGFtYmlndW91c0l0ZW1TY29yZSA+PSAwLjA2KSB7XG4gICAgLy8gQ2hlY2sgaWYgaW1hZ2UgZXhoaWJpdHMgaGlnaCBtdWx0aS1jb2xvciBlbnRyb3B5ICsgaGlnaCBzaGFycG5lc3MgaW5kaWNhdGl2ZSBvZiBvdXRkb29yIGRlYnJpc1xuICAgIGNvbnN0IGhhc091dGRvb3JEZWJyaXNDb250ZXh0ID0gcXVhbGl0eUFuYWx5c2lzLmNvbG9yRW50cm9weSA+IDY1ICYmIHF1YWxpdHlBbmFseXNpcy5zaGFycG5lc3NTY29yZSA+IDM1O1xuXG4gICAgaWYgKGhhc091dGRvb3JEZWJyaXNDb250ZXh0KSB7XG4gICAgICBjb25zdCB3YXN0ZUNvbmZpZGVuY2UgPSBNYXRoLm1pbigwLjkyLCBNYXRoLm1heCgwLjY1LCBNYXRoLnJvdW5kKChhbWJpZ3VvdXNJdGVtU2NvcmUgKiA0LjAgKyAwLjQwKSAqIDEwMCkgLyAxMDApKTtcbiAgICAgIGNvbnN0IGZpbmFsQ2F0ZWdvcnkgPSBpc3N1ZVR5cGVIaW50IHx8IGRldGVjdGVkV2FzdGVMaXN0WzBdIHx8ICdQbGFzdGljIFdhc3RlJztcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZlcmlmaWVkOiB0cnVlLFxuICAgICAgICB3YXN0ZURldGVjdGVkOiB0cnVlLFxuICAgICAgICBjb25maWRlbmNlOiB3YXN0ZUNvbmZpZGVuY2UsXG4gICAgICAgIGNhdGVnb3J5OiBmaW5hbENhdGVnb3J5LFxuICAgICAgICBxdWFsaXR5OiBxdWFsaXR5QW5hbHlzaXMucXVhbGl0eSxcbiAgICAgICAgZGV0ZWN0ZWRXYXN0ZVR5cGVzOiBkZXRlY3RlZFdhc3RlTGlzdC5sZW5ndGggPyBkZXRlY3RlZFdhc3RlTGlzdCA6IFtmaW5hbENhdGVnb3J5XSxcbiAgICAgICAgcmVhc29uOiAnV2FzdGUgaXNzdWUgdmVyaWZpZWQgYnkgR2VvQ2xlYW4gQUkgTW9kZWwuJyxcbiAgICAgICAgbW9kZWxWZXJzaW9uOiBWRVJJRklDQVRJT05fQ09ORklHLk1PREVMX1ZFUlNJT04sXG4gICAgICAgIHZlcmlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgIHNoYXJwbmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuc2hhcnBuZXNzU2NvcmUsXG4gICAgICAgICAgYnJpZ2h0bmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuYnJpZ2h0bmVzc1Njb3JlLFxuICAgICAgICAgIHdhc3RlUHJvYmFiaWxpdHk6IHdhc3RlQ29uZmlkZW5jZSxcbiAgICAgICAgICBjbGVhbmxpbmVzc1Njb3JlOiBNYXRoLnJvdW5kKCgxIC0gd2FzdGVDb25maWRlbmNlKSAqIDEwMCksXG4gICAgICAgICAgdG9wUHJlZGljdGlvbnM6IHByZWRpY3Rpb25zLm1hcCgocCkgPT4gKHsgbGFiZWw6IHAuY2xhc3NOYW1lLCBwcm9iYWJpbGl0eTogcC5wcm9iYWJpbGl0eSB9KSksXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZTogU2luZ2xlIGlzb2xhdGVkIG9iamVjdCB3aXRob3V0IHdhc3RlIGNvbnRleHQgLT4gUkVKRUNUIVxuICAgIHJldHVybiB7XG4gICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICB3YXN0ZURldGVjdGVkOiBmYWxzZSxcbiAgICAgIGNvbmZpZGVuY2U6IDAuODUsXG4gICAgICBjYXRlZ29yeTogJ05vbi1XYXN0ZSAoU2luZ2xlIE9iamVjdCAvIENsZWFuIFN1cmZhY2UpJyxcbiAgICAgIHF1YWxpdHk6IHF1YWxpdHlBbmFseXNpcy5xdWFsaXR5LFxuICAgICAgZGV0ZWN0ZWRXYXN0ZVR5cGVzOiBbXSxcbiAgICAgIHJlYXNvbjogJ1NpbmdsZSBpc29sYXRlZCBvYmplY3Qgd2l0aCBubyBldmlkZW5jZSBvZiBhIHB1YmxpYyB3YXN0ZSBvciBkdW1waW5nIHByb2JsZW0uIFBsZWFzZSB1cGxvYWQgYSBjbGVhciBwaG90byBzaG93aW5nIHRoZSByZXBvcnRlZCB3YXN0ZSBwcm9ibGVtIGluIGl0cyBlbnZpcm9ubWVudGFsIGNvbnRleHQuJyxcbiAgICAgIG1vZGVsVmVyc2lvbjogVkVSSUZJQ0FUSU9OX0NPTkZJRy5NT0RFTF9WRVJTSU9OLFxuICAgICAgdmVyaWZpZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgZGV0YWlsczoge1xuICAgICAgICBzaGFycG5lc3NTY29yZTogcXVhbGl0eUFuYWx5c2lzLnNoYXJwbmVzc1Njb3JlLFxuICAgICAgICBicmlnaHRuZXNzU2NvcmU6IHF1YWxpdHlBbmFseXNpcy5icmlnaHRuZXNzU2NvcmUsXG4gICAgICAgIHdhc3RlUHJvYmFiaWxpdHk6IDAuMTUsXG4gICAgICAgIGNsZWFubGluZXNzU2NvcmU6IDg4LFxuICAgICAgICB0b3BQcmVkaWN0aW9uczogcHJlZGljdGlvbnMubWFwKChwKSA9PiAoeyBsYWJlbDogcC5jbGFzc05hbWUsIHByb2JhYmlsaXR5OiBwLnByb2JhYmlsaXR5IH0pKSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8vIDYuIERFRkFVTFQgTk9OLVdBU1RFXG4gIGNvbnN0IGZpbmFsQ2F0ZWdvcnkgPSBgTm9uLVdhc3RlICgke3RvcE5vbldhc3RlQ2xhc3MgfHwgJ0dlbmVyYWwgU2NlbmUnfSlgO1xuICByZXR1cm4ge1xuICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICB3YXN0ZURldGVjdGVkOiBmYWxzZSxcbiAgICBjb25maWRlbmNlOiBNYXRoLm1pbigwLjk1LCBNYXRoLm1heCgwLjc1LCBNYXRoLnJvdW5kKHRvcE5vbldhc3RlUHJvYiAqIDEwMCkgLyAxMDApKSxcbiAgICBjYXRlZ29yeTogZmluYWxDYXRlZ29yeSxcbiAgICBxdWFsaXR5OiBxdWFsaXR5QW5hbHlzaXMucXVhbGl0eSxcbiAgICBkZXRlY3RlZFdhc3RlVHlwZXM6IFtdLFxuICAgIHJlYXNvbjogJ05vIHJlbGV2YW50IHdhc3RlIHdhcyBkZXRlY3RlZC4gUGxlYXNlIHVwbG9hZCBhIGNsZWFyIHBob3RvIHNob3dpbmcgdGhlIHJlcG9ydGVkIHdhc3RlL2NsZWFubGluZXNzIGlzc3VlLicsXG4gICAgbW9kZWxWZXJzaW9uOiBWRVJJRklDQVRJT05fQ09ORklHLk1PREVMX1ZFUlNJT04sXG4gICAgdmVyaWZpZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGRldGFpbHM6IHtcbiAgICAgIHNoYXJwbmVzc1Njb3JlOiBxdWFsaXR5QW5hbHlzaXMuc2hhcnBuZXNzU2NvcmUsXG4gICAgICBicmlnaHRuZXNzU2NvcmU6IHF1YWxpdHlBbmFseXNpcy5icmlnaHRuZXNzU2NvcmUsXG4gICAgICB3YXN0ZVByb2JhYmlsaXR5OiAwLjA1LFxuICAgICAgY2xlYW5saW5lc3NTY29yZTogOTIsXG4gICAgICB0b3BQcmVkaWN0aW9uczogcHJlZGljdGlvbnMubWFwKChwKSA9PiAoeyBsYWJlbDogcC5jbGFzc05hbWUsIHByb2JhYmlsaXR5OiBwLnByb2JhYmlsaXR5IH0pKSxcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIFByaW1hcnkgUmVhbCBBSSBJbWFnZSBWZXJpZmljYXRpb24gRW5naW5lXG4gKiBEZWNvZGVzIHBpeGVscyAtPiBDaGVja3MgUXVhbGl0eSAtPiBFdmFsdWF0ZXMgd2l0aCBHZW1pbmkgVmlzaW9uIG9yIENvbnRleHQtQXdhcmUgTW9iaWxlTmV0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5SW1hZ2VXaXRoTGV2ZWwzQUkoXG4gIGltYWdlQmFzZTY0T3JEYXRhVXJsOiBzdHJpbmcsXG4gIGNvbnRleHQ6ICdDSVRJWkVOX0JFRk9SRScgfCAnTkdPX0FGVEVSJyA9ICdDSVRJWkVOX0JFRk9SRScsXG4gIGlzc3VlVHlwZUhpbnQ/OiBzdHJpbmdcbik6IFByb21pc2U8TW9kZWxWZXJpZmljYXRpb25SZXNwb25zZT4ge1xuICAvLyAxLiBEZWNvZGUgZXhhY3QgaW1hZ2UgcGl4ZWxzXG4gIGNvbnN0IGRlY29kZWQgPSBkZWNvZGVCYXNlNjRUb1JnYmEoaW1hZ2VCYXNlNjRPckRhdGFVcmwpO1xuICBpZiAoIWRlY29kZWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgd2FzdGVEZXRlY3RlZDogZmFsc2UsXG4gICAgICBjb25maWRlbmNlOiAwLFxuICAgICAgY2F0ZWdvcnk6ICdVbnJlYWRhYmxlIEltYWdlJyxcbiAgICAgIHF1YWxpdHk6ICdQT09SJyxcbiAgICAgIGRldGVjdGVkV2FzdGVUeXBlczogW10sXG4gICAgICByZWFzb246ICdGYWlsZWQgdG8gZGVjb2RlIGltYWdlIGRhdGEuIFBsZWFzZSB1cGxvYWQgYSBzdGFuZGFyZCBQTkcgb3IgSlBFRyBpbWFnZS4nLFxuICAgICAgbW9kZWxWZXJzaW9uOiBWRVJJRklDQVRJT05fQ09ORklHLk1PREVMX1ZFUlNJT04sXG4gICAgICB2ZXJpZmllZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcbiAgfVxuXG4gIC8vIDIuIFBlcmZvcm0gUmVhbCBJbWFnZSBRdWFsaXR5IEFzc2Vzc21lbnRcbiAgY29uc3QgcXVhbGl0eSA9IGFuYWx5emVJbWFnZVF1YWxpdHkoZGVjb2RlZC5kYXRhLCBkZWNvZGVkLndpZHRoLCBkZWNvZGVkLmhlaWdodCk7XG4gIGlmICghcXVhbGl0eS5pc0FjY2VwdGFibGUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgd2FzdGVEZXRlY3RlZDogZmFsc2UsXG4gICAgICBjb25maWRlbmNlOiAwLjE1LFxuICAgICAgY2F0ZWdvcnk6ICdQb29yIFF1YWxpdHkgSW1hZ2UnLFxuICAgICAgcXVhbGl0eTogJ1BPT1InLFxuICAgICAgZGV0ZWN0ZWRXYXN0ZVR5cGVzOiBbXSxcbiAgICAgIHJlYXNvbjogcXVhbGl0eS5pc3N1ZSB8fCAnSW1hZ2UgcXVhbGl0eSBpcyB0b28gcG9vciBmb3IgQUkgdmVyaWZpY2F0aW9uLicsXG4gICAgICBtb2RlbFZlcnNpb246IFZFUklGSUNBVElPTl9DT05GSUcuTU9ERUxfVkVSU0lPTixcbiAgICAgIHZlcmlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgc2hhcnBuZXNzU2NvcmU6IHF1YWxpdHkuc2hhcnBuZXNzU2NvcmUsXG4gICAgICAgIGJyaWdodG5lc3NTY29yZTogcXVhbGl0eS5icmlnaHRuZXNzU2NvcmUsXG4gICAgICAgIHdhc3RlUHJvYmFiaWxpdHk6IDAsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyAzLiBUcnkgR2VtaW5pIE11bHRpbW9kYWwgVmlzaW9uIEFQSSAoaWYgQVBJIEtleSBwcm92aWRlZClcbiAgY29uc3QgZ2VtaW5pUmVzdWx0ID0gYXdhaXQgZXZhbHVhdGVXaXRoR2VtaW5pVmlzaW9uKGltYWdlQmFzZTY0T3JEYXRhVXJsLCBjb250ZXh0LCBpc3N1ZVR5cGVIaW50KTtcbiAgaWYgKGdlbWluaVJlc3VsdCkge1xuICAgIHJldHVybiBnZW1pbmlSZXN1bHQ7XG4gIH1cblxuICAvLyA0LiBSdW4gQ29udGV4dC1Bd2FyZSBNb2JpbGVOZXQgRGVlcCBDb252b2x1dGlvbmFsIE5ldXJhbCBOZXR3b3JrIG9uIGFjdHVhbCBwaXhlbCB0ZW5zb3JcbiAgcmV0dXJuIGV2YWx1YXRlV2l0aE1vYmlsZU5ldENOTihcbiAgICBkZWNvZGVkLmRhdGEsXG4gICAgZGVjb2RlZC53aWR0aCxcbiAgICBkZWNvZGVkLmhlaWdodCxcbiAgICBxdWFsaXR5LFxuICAgIGNvbnRleHQsXG4gICAgaXNzdWVUeXBlSGludFxuICApO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VyxTQUFTLG9CQUFpQztBQUNuWixPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlLFdBQVc7OztBQ0YyWCxZQUFZLFFBQVE7QUFDbGIsWUFBWSxlQUFlO0FBQzNCLFNBQVMsbUJBQW1CO0FBQzVCLFlBQVksVUFBVTtBQUN0QixTQUFTLFdBQVc7QUF1QmIsSUFBTSxzQkFBc0I7QUFBQSxFQUNqQyxzQkFBc0I7QUFBQSxFQUN0QixlQUFlO0FBQUEsRUFDZixnQkFBZ0I7QUFBQSxFQUNoQixnQkFBZ0I7QUFBQSxFQUNoQixlQUFlO0FBQ2pCO0FBR0EsSUFBTSwyQkFBMkI7QUFBQSxFQUMvQjtBQUFBLEVBQVU7QUFBQSxFQUFhO0FBQUEsRUFBZTtBQUFBLEVBQVk7QUFBQSxFQUFXO0FBQUEsRUFDN0Q7QUFBQSxFQUFZO0FB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
