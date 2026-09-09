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
  details?: {
    sharpnessScore?: number;
    brightnessScore?: number;
    wasteProbability?: number;
    cleanlinessScore?: number;
    detectedObjects?: Array<{ label: string; probability: number }>;
  };
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
    try {
      const response = await fetch('/api/verify-image', {
        method: 'POST',
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

      if (response.ok) {
        const data = (await response.json()) as VerificationResult;
        return {
          ...data,
          isRelevant: data.wasteDetected || context === 'NGO_AFTER',
        };
      }

      const errData = await response.json().catch(() => ({}));
      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Verification Failed',
        quality: 'POOR',
        detectedWasteTypes: [],
        reason: errData.error || 'Image verification server returned an error. Please try again.',
        modelVersion: 'geoclean-level3-waste-v1',
        verifiedAt: new Date().toISOString(),
      };
    } catch (networkErr) {
      console.error('Image Verification Service Network Error:', networkErr);
      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Service Unavailable',
        quality: 'POOR',
        detectedWasteTypes: [],
        reason: 'Image verification is temporarily unavailable. Please check your connection and try again.',
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
