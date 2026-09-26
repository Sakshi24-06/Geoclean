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
        };
      }

      const reasonMessage =
        parsedData.error ||
        parsedData.details ||
        `Image verification server returned an error (HTTP ${response.status}). Please try again.`;

      console.warn('[AI Verification Frontend] Server returned non-OK or invalid status:', {
        status: response.status,
        reason: reasonMessage,
        details: parsedData.details,
      });

      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Verification Server Error',
        quality: 'GOOD',
        detectedWasteTypes: [],
        reason: reasonMessage,
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
      });

      return {
        verified: false,
        wasteDetected: false,
        confidence: 0,
        category: 'Service Unavailable',
        quality: 'GOOD',
        detectedWasteTypes: [],
        reason: 'Image verification server is temporarily unreachable. Please check your connection and try again.',
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
