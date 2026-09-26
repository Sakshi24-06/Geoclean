export type VerificationContext = 'CITIZEN_BEFORE' | 'NGO_AFTER';

export type ImageQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface VerificationResult {
  verified: boolean;
  wasteDetected: boolean;
  confidence: number;
  category: string;
  quality: ImageQuality;
  detectedWasteTypes: string[];
  reason?: string;
  modelVersion: string;
  verifiedAt: string;
  isRelevant?: boolean;
  error?: boolean;
  details?: {
    sharpnessScore?: number;
    brightnessScore?: number;
    wasteProbability?: number;
    cleanlinessScore?: number;
    detectedObjects?: Array<{ label: string; probability: number }>;
  };
}

/**
 * Converts any API, Supabase, or thrown error object safely into a string to prevent React rendering crashes.
 *
 * Rules:
 * 1. If error.message exists, return String(error.message).
 * 2. If error is a string, return trimmed string.
 * 3. Supports nested objects like { error: { code, message } } or { code, message }.
 * 4. Otherwise, returns a generic fallback string (e.g. "Image verification server error.").
 */
export function toSafeErrorMessage(err: unknown, fallback = 'Image verification server error.'): string {
  if (err === null || err === undefined) {
    return fallback;
  }

  if (typeof err === 'string') {
    const trimmed = err.trim();
    return trimmed || fallback;
  }

  if (typeof err === 'object') {
    const obj = err as Record<string, any>;
    if (obj.message !== undefined && obj.message !== null) {
      if (typeof obj.message === 'object') {
        return toSafeErrorMessage(obj.message, fallback);
      }
      const msg = String(obj.message).trim();
      if (msg) return msg;
    }
    if (obj.error !== undefined && obj.error !== null) {
      return toSafeErrorMessage(obj.error, fallback);
    }
    if (obj.details !== undefined && obj.details !== null) {
      return toSafeErrorMessage(obj.details, fallback);
    }
    if (obj.reason !== undefined && obj.reason !== null) {
      return toSafeErrorMessage(obj.reason, fallback);
    }
  }

  return fallback;
}

/**
 * Level 3 AI Image Verification Service.
 * Acts as the client-side gateway to the backend AI verification model engine.
 * Never hardcodes or fabricates verification metrics.
 */
export class ImageVerificationService {
  /**
   * Sends image to backend AI verification pipeline.
   */
  static async verifyImage(
    imageSrc: string,
    context: VerificationContext = 'CITIZEN_BEFORE',
    issueTypeHint?: string
  ): Promise<VerificationResult> {
    const apiUrl = '/api/verify-image';
    const method = 'POST';

    console.log('[AI Verification Frontend] Initiating request:', {
      url: apiUrl,
      method,
      context,
      issueType: issueTypeHint,
      payloadLength: imageSrc?.length || 0,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch(apiUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          image: imageSrc,
          context,
          issueType: issueTypeHint,
        }),
      });

      const contentType = response.headers.get('content-type') || 'none';
      const rawText = await response.text();

      console.log('[AI Verification Frontend] Response received:', {
        url: apiUrl,
        method,
        status: response.status,
        statusText: response.statusText,
        contentType,
        bodySnippet: rawText.slice(0, 500),
      });

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[AI Verification Frontend] Failed to parse JSON response:', {
          rawText: rawText.slice(0, 300),
          parseError: parseErr,
        });
      }

      if (response.ok && parsedData && typeof parsedData.verified === 'boolean') {
        const data = parsedData as VerificationResult;
        console.log('[AI Verification Frontend] Success result:', {
          verified: data.verified,
          wasteDetected: data.wasteDetected,
          confidence: data.confidence,
          category: data.category,
          quality: data.quality,
        });
        return {
          ...data,
          error: false,
          isRelevant: data.wasteDetected || context === 'NGO_AFTER',
          reason: typeof data.reason === 'string' ? data.reason : (data.reason ? toSafeErrorMessage(data.reason) : undefined),
        };
      }

      const errorCandidate =
        parsedData?.error !== undefined
          ? parsedData.error
          : parsedData?.message !== undefined
          ? parsedData.message
          : parsedData?.details !== undefined
          ? parsedData.details
          : parsedData;

      const fallbackError = `Image verification server returned an error (HTTP ${response.status}). Please try again.`;
      const safeReason = toSafeErrorMessage(errorCandidate, fallbackError);

      console.warn('[AI Verification Frontend] Server returned non-OK or invalid status:', {
        status: response.status,
        statusText: response.statusText,
        reason: safeReason,
        serverPayload: parsedData,
        rawText: rawText ? rawText.slice(0, 1000) : '',
        details: parsedData?.details,
      });

      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Verification Server Error',
        quality: 'GOOD',
        detectedWasteTypes: [],
        reason: safeReason,
        error: true,
        modelVersion: 'geoclean-level3-waste-v1',
        verifiedAt: new Date().toISOString(),
      };
    } catch (networkErr: any) {
      console.error('[AI Verification Frontend] Network or unexpected exception:', {
        url: apiUrl,
        method,
        errorName: networkErr?.name,
        errorMessage: networkErr?.message,
        errorStack: networkErr?.stack,
        rawError: networkErr,
      });

      const safeReason = toSafeErrorMessage(
        networkErr,
        'Image verification server is temporarily unreachable. Please check your connection and try again.'
      );

      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Service Unavailable',
        quality: 'GOOD',
        detectedWasteTypes: [],
        reason: safeReason,
        error: true,
        modelVersion: 'geoclean-level3-waste-v1',
        verifiedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Specifically verifies NGO completion ("After") photos through the backend model.
   */
  static async verifyNgoAfterImage(afterImageSrc: string): Promise<VerificationResult> {
    return this.verifyImage(afterImageSrc, 'NGO_AFTER');
  }
}
