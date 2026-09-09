import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Edit3,
  Image as ImageIcon,
  LocateFixed,
  MapPin,
  MessageCircle,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { issueOptions, type Report, type StructuredLocation } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/utils/supabase';
import { getCurrentGeoLocation, lookupPostalCodeFromAddress, type GeoLocationResult } from '@/utils/geo';
import { ImageVerificationService, type VerificationResult } from '@/lib/ai/imageVerificationService';
import { createReportSubmittedNotification } from '@/lib/notificationService';

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="review-row"><span>{label}</span><b>{value}</b></div>;
}

export function SuccessModal({ report, onClose, onTrack }: { report: Report; onClose: () => void; onTrack: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="success-title">
      <div className="success-modal">
        <div className="success-check"><Check size={31} /></div>
        <h2 id="success-title" className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Report Submitted Successfully!</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">Thank you for helping keep our community clean. The right team will review your report shortly.</p>
        <div className="report-id"><span>REPORT ID</span><b>{report.id}</b></div>
        <div className="success-details">
          <ReviewRow label="Issue type" value={report.issueType} />
          <ReviewRow label="Status" value={report.status} />
          <ReviewRow label="Location" value={report.readableLocation || report.location} />
          <ReviewRow label="Verification" value={`AI Verified (${Math.round((report.imageConfidence ?? 0.90) * 100)}% conf)`} />
          <ReviewRow label="Submitted" value={new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} />
        </div>
        <div className="mt-7 flex gap-3">
          <button type="button" onClick={onClose} className="button-secondary flex-1">Close</button>
          <button type="button" onClick={onTrack} className="button-primary flex-1"><Route size={17} /> Track My Report</button>
        </div>
      </div>
    </div>
  );
}

export default function ReportModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (report: Report) => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  
  // Location Step State: Exactly 2 options (Current Location vs Add Location) with Structured Fields
  const [locationOption, setLocationOption] = useState<'NONE' | 'CURRENT' | 'MANUAL'>('NONE');
  const [locationSource, setLocationSource] = useState<'CURRENT_LOCATION' | 'MANUAL' | null>(null);
  const [locationForm, setLocationForm] = useState({
    area: '',
    locality: '',
    landmark: '',
    street: '',
    district: '',
    state: '',
    pincode: '',
    country: 'India',
  });
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [pinLookupMessage, setPinLookupMessage] = useState('');

  const [currentGeoResult, setCurrentGeoResult] = useState<GeoLocationResult | null>(null);
  const [location, setLocation] = useState('Location not added yet');
  const [readableLocation, setReadableLocation] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [latNum, setLatNum] = useState<number | null>(null);
  const [lngNum, setLngNum] = useState<number | null>(null);
  const [isGeotagged, setIsGeotagged] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [reverseGeocodeFailed, setReverseGeocodeFailed] = useState(false);

  const [photo, setPhoto] = useState<string>();
  const [photoFile, setPhotoFile] = useState<File>();
  const [imageSource, setImageSource] = useState<'CAMERA' | 'GALLERY' | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'IDLE' | 'PENDING' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const steps = ['Issue', 'Photo', 'Location', 'Details', 'Review'];

  const isLocationFormValid = (): boolean => {
    if (locationOption === 'NONE') return false;
    const { area, locality, landmark, street, district, state, pincode, country } = locationForm;
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
  };

  const isStepValid = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return Boolean(issueType && issueType.trim() !== '');
      case 2:
        return Boolean(photo && verificationStatus === 'VERIFIED');
      case 3:
        return isLocationFormValid();
      case 4:
        return true; // Description is optional
      case 5:
        return Boolean(
          issueType &&
          photo &&
          verificationStatus === 'VERIFIED' &&
          isLocationFormValid()
        );
      default:
        return false;
    }
  };

  const runVerification = async (imageSrc: string, typeHint: string) => {
    setIsVerifying(true);
    setVerificationStatus('PENDING');
    setError('');

    try {
      const result = await ImageVerificationService.verifyImage(imageSrc, 'CITIZEN_BEFORE', typeHint);
      setVerificationResult(result);
      if (result.verified) {
        setVerificationStatus('VERIFIED');
      } else {
        setVerificationStatus('FAILED');
        setError(result.reason || 'Image could not be verified as a valid GeoClean issue image. Please upload a clear photo showing the waste/cleanliness issue.');
      }
    } catch {
      setVerificationStatus('FAILED');
      setError('Unable to complete AI image verification. Please try uploading again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>, source: 'CAMERA' | 'GALLERY') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }

    setError('');
    setImageSource(source);
    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setPhoto(dataUrl);

      // If Camera: automatically solicit GPS current location
      if (source === 'CAMERA') {
        void detectCurrentLocation();
      }

      // Run Level 3 AI Model Verification
      await runVerification(dataUrl, issueType);
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleLocationFieldChange = (field: keyof typeof locationForm, value: string) => {
    const updated = { ...locationForm, [field]: value };
    setLocationForm(updated);
    setError('');

    // Format address string
    const formatted = [
      updated.street.trim(),
      updated.landmark.trim() ? `Near ${updated.landmark.trim()}` : '',
      updated.area.trim(),
      updated.locality.trim(),
      updated.district.trim(),
      [updated.state.trim(), updated.pincode.trim()].filter(Boolean).join(' '),
      updated.country.trim() || 'India',
    ].filter(Boolean).join(', ');

    setLocation(formatted);
    setReadableLocation(formatted);
  };

  const triggerPinLookup = async (form: typeof locationForm) => {
    if (form.pincode && /^\d{6}$/.test(form.pincode.trim())) {
      return;
    }
    if (!form.area.trim() && !form.locality.trim() && !form.street.trim() && !form.district.trim()) {
      return;
    }

    setPinLookupLoading(true);
    setPinLookupMessage('Finding PIN code...');

    try {
      const res = await lookupPostalCodeFromAddress(form);
      if (res && res.pincode) {
        setLocationForm((prev) => {
          const updated = { ...prev, pincode: res.pincode || prev.pincode };
          const formatted = [
            updated.street.trim(),
            updated.landmark.trim() ? `Near ${updated.landmark.trim()}` : '',
            updated.area.trim(),
            updated.locality.trim(),
            updated.district.trim(),
            [updated.state.trim(), updated.pincode.trim()].filter(Boolean).join(' '),
            updated.country.trim() || 'India',
          ].filter(Boolean).join(', ');
          setLocation(formatted);
          setReadableLocation(formatted);
          return updated;
        });

        if (res.latitude && res.longitude && locationOption === 'MANUAL') {
          setLatNum(res.latitude);
          setLngNum(res.longitude);
          setCoordinates(`${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)}`);
        }
        setPinLookupMessage('');
      } else {
        setPinLookupMessage('PIN code could not be detected. Please enter it manually.');
      }
    } catch {
      setPinLookupMessage('PIN code could not be detected. Please enter it manually.');
    } finally {
      setPinLookupLoading(false);
    }
  };

  const detectCurrentLocation = async () => {
    setLocationOption('CURRENT');
    setLocationLoading(true);
    setLocationError('');
    setReverseGeocodeFailed(false);
    setError('');

    try {
      const geo = await getCurrentGeoLocation();
      setLatNum(geo.latitude);
      setLngNum(geo.longitude);
      const coordsStr = `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}`;
      setCoordinates(coordsStr);
      setCurrentGeoResult(geo);

      if (geo.reverseGeocodingFailed || !geo.readableAddress) {
        setReverseGeocodeFailed(true);
        setLocationSource(null);
      } else {
        setReverseGeocodeFailed(false);
        setLocationSource('CURRENT_LOCATION');
        setIsGeotagged(true);

        const d = geo.details;
        const updated = {
          area: d?.area || locationForm.area || '',
          locality: d?.locality || d?.city || locationForm.locality || '',
          landmark: locationForm.landmark || '', // Landmark is required
          street: d?.street || locationForm.street || '',
          district: d?.district || d?.city || locationForm.district || '',
          state: d?.state || locationForm.state || '',
          pincode: d?.pincode || locationForm.pincode || '',
          country: d?.country || 'India',
        };
        setLocationForm(updated);

        const formatted = [
          updated.street.trim(),
          updated.landmark.trim() ? `Near ${updated.landmark.trim()}` : '',
          updated.area.trim(),
          updated.locality.trim(),
          updated.district.trim(),
          [updated.state.trim(), updated.pincode.trim()].filter(Boolean).join(' '),
          updated.country.trim() || 'India',
        ].filter(Boolean).join(', ');

        setLocation(formatted);
        setReadableLocation(formatted);
      }
    } catch (geoErr) {
      setCurrentGeoResult(null);
      setLocationError(geoErr instanceof Error ? geoErr.message : 'Location permission is required to detect your current location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const selectAddLocation = () => {
    setLocationOption('MANUAL');
    setLocationSource('MANUAL');
    setLatNum(null);
    setLngNum(null);
    setCoordinates('');
    setCurrentGeoResult(null);
    setIsGeotagged(false);
    setLocationError('');
    setReverseGeocodeFailed(false);
    setError('');
  };

  const next = () => {
    setError('');
    if (!isStepValid(step)) {
      if (step === 1 && !issueType) {
        setError('Please select an issue type to continue.');
      } else if (step === 2 && (!photo || verificationStatus !== 'VERIFIED')) {
        setError('Please upload an image and wait for AI verification before continuing.');
      } else if (step === 3) {
        if (locationOption === 'NONE') {
          setError('Please choose either Current Location or Add Location to continue.');
        } else if (!isLocationFormValid()) {
          const { area, locality, landmark, street, district, state, pincode } = locationForm;
          if (!area.trim()) setError('Please enter the Area name.');
          else if (!locality.trim()) setError('Please enter the Locality.');
          else if (!landmark.trim()) setError('Please enter a nearby landmark.');
          else if (!street.trim()) setError('Please enter the Street / Road name.');
          else if (!district.trim()) setError('Please enter the District.');
          else if (!state.trim()) setError('Please enter the State.');
          else if (!/^\d{6}$/.test(pincode.trim())) setError('Please enter a valid 6-digit PIN code.');
          else setError('Please fill in all required address fields.');
        }
      }
      return;
    }
    setStep((c) => Math.min(c + 1, 5));
  };

  const resetPhoto = () => {
    setPhoto(undefined);
    setPhotoFile(undefined);
    setVerificationStatus('IDLE');
    setVerificationResult(null);
    setImageSource(null);
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!isStepValid(5)) {
      setError('Please ensure all required information is provided and verified.');
      return;
    }

    if (!user) {
      setError('Please sign in again before submitting a report.');
      return;
    }

    setSubmitting(true);

    try {
      const finalAddress = [
        locationForm.street.trim(),
        locationForm.landmark.trim() ? `Near ${locationForm.landmark.trim()}` : '',
        locationForm.area.trim(),
        locationForm.locality.trim(),
        locationForm.district.trim(),
        [locationForm.state.trim(), locationForm.pincode.trim()].filter(Boolean).join(' '),
        locationForm.country.trim() || 'India',
      ].filter(Boolean).join(', ');

      const finalLat = locationOption === 'CURRENT' ? latNum : (latNum ?? null);
      const finalLng = locationOption === 'CURRENT' ? lngNum : (lngNum ?? null);

      const structuredLoc: StructuredLocation = {
        area: locationForm.area.trim(),
        locality: locationForm.locality.trim(),
        landmark: locationForm.landmark.trim(),
        street: locationForm.street.trim(),
        district: locationForm.district.trim(),
        state: locationForm.state.trim(),
        pincode: locationForm.pincode.trim(),
        country: locationForm.country.trim() || 'India',
        latitude: finalLat,
        longitude: finalLng,
        source: locationOption === 'CURRENT' ? 'CURRENT_LOCATION' : 'MANUAL',
        formattedAddress: finalAddress,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('waste_reports')
        .insert({
          user_id: user.id,
          title: issueType,
          waste_type: issueType,
          description: description || null,
          address: finalAddress,
          latitude: Number.isFinite(finalLat) ? finalLat : null,
          longitude: Number.isFinite(finalLng) ? finalLng : null,
        })
        .select('id, report_code, created_at, status')
        .single();

      if (insertError || !inserted) {
        setError(insertError?.message || 'Could not submit your report. Please try again.');
        setSubmitting(false);
        return;
      }

      let imageUrl = photo;
      if (photoFile) {
        const path = `${user.id}/before/${inserted.id}-${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(path, photoFile, { contentType: photoFile.type });

        if (!uploadError) {
          const { data: signed } = await supabase.storage
            .from('report-images')
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          imageUrl = signed?.signedUrl || photo;

          await supabase.from('report_images').insert({
            report_id: inserted.id,
            image_url: imageUrl,
            image_type: 'before',
            uploaded_by: user.id,
          });
        }
      }

      const nowIso = inserted.created_at || new Date().toISOString();
      const report: Report = {
        id: inserted.report_code,
        dbId: inserted.id,
        issueType,
        location: finalAddress,
        readableLocation: finalAddress,
        structuredLocation: structuredLoc,
        locationSource: locationOption === 'CURRENT' ? 'CURRENT_LOCATION' : 'MANUAL',
        locationDescription: locationOption === 'MANUAL' ? finalAddress : undefined,
        locationDetails: {
          area: locationForm.area.trim(),
          locality: locationForm.locality.trim(),
          landmark: locationForm.landmark.trim(),
          street: locationForm.street.trim(),
          city: locationForm.locality.trim(),
          district: locationForm.district.trim(),
          state: locationForm.state.trim(),
          pincode: locationForm.pincode.trim(),
          country: locationForm.country.trim() || 'India',
        },
        coordinates: coordinates || (finalLat && finalLng ? `${finalLat.toFixed(5)}, ${finalLng.toFixed(5)}` : undefined),
        latitude: finalLat ?? undefined,
        longitude: finalLng ?? undefined,
        description,
        photo: imageUrl,
        beforePhoto: imageUrl,
        imageSource: imageSource || 'GALLERY',
        imageVerificationStatus: 'VERIFIED',
        imageConfidence: verificationResult?.confidence,
        detectedWasteTypes: verificationResult?.detectedWasteTypes || [issueType],
        createdAt: nowIso,
        status: 'Submitted',
        reporterEmail: user?.email,
        reporterName: user?.name,
        reporterId: user?.id,
        deleted: false,
        statusHistory: [
          {
            status: 'Submitted',
            timestamp: nowIso,
            updatedBy: 'Citizen',
          },
        ],
      };

      // Record initial status history to database
      try {
        await supabase.from('report_status_history').insert({
          report_id: inserted.id,
          report_code: inserted.report_code,
          old_status: null,
          new_status: 'Submitted',
          changed_by: user.id,
          changed_by_name: user.name || 'Citizen',
          changed_by_role: 'user',
          note: 'Report created and submitted by citizen',
          created_at: nowIso,
        });
      } catch {}

      // Automatically create Report Submitted Notification in database & local cache
      try {
        await createReportSubmittedNotification({
          userId: user.id,
          reportId: inserted.id,
          reportCode: inserted.report_code,
          wasteType: issueType,
          location: finalAddress,
        });
      } catch {}

      try {
        const raw = localStorage.getItem('geoclean-reports') || '[]';
        const currentList = JSON.parse(raw) as Report[];
        localStorage.setItem('geoclean-reports', JSON.stringify([report, ...currentList.filter((r) => r.id !== report.id)]));
      } catch {}

      window.dispatchEvent(new CustomEvent('geoclean-reports-updated'));
      onSubmitted(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="report-modal">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-8">
          <div>
            <div className="section-kicker"><Send size={14} /> New report</div>
            <h2 id="report-modal-title" className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Report a Waste Issue</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close report form"><X size={19} /></button>
        </div>

        {/* Steps Progress */}
        <div className="px-5 pt-5 sm:px-8">
          <div className="flex items-center justify-between">
            {steps.map((label, index) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className={`step-dot ${step > index ? 'done' : ''} ${step === index + 1 ? 'current' : ''}`}>
                  {step > index + 1 ? <Check size={13} /> : index + 1}
                </div>
                <span className={`ml-2 hidden text-[11px] font-bold sm:block ${step === index + 1 ? 'text-forest' : 'text-slate-400'}`}>{label}</span>
                {index < steps.length - 1 && <span className={`mx-2 h-px flex-1 ${step > index + 1 ? 'bg-forest' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={submit} className="px-5 pb-6 pt-6 sm:px-8 sm:pb-8">
          {/* Step 1: Issue Type (Mandatory with placeholder) */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="form-icon"><AlertTriangle size={21} /></div>
              <h3 className="mt-4 text-lg font-bold text-ink">What needs attention?</h3>
              <p className="mt-1 text-sm text-slate-500">Choose the category that best matches the issue. This selection is required.</p>
              
              <label className="field-label" htmlFor="issue-type">
                Issue type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="issue-type"
                  value={issueType}
                  onChange={(e) => {
                    setIssueType(e.target.value);
                    setError('');
                  }}
                  className={`field-input appearance-none pr-10 ${!issueType ? 'text-slate-400' : 'text-ink font-semibold'}`}
                >
                  <option value="" disabled>Select Issue Type</option>
                  {issueOptions.map((o) => (
                    <option key={o} value={o} className="text-ink font-normal">{o}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              </div>
              
              {!issueType && (
                <p className="mt-2 text-xs text-slate-400">Please select an issue type to enable the Continue button.</p>
              )}
            </div>
          )}

          {/* Step 2: Dual Photo Upload (Camera/Gallery) + Level 3 AI Verification */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="form-icon"><Camera size={21} /></div>
              <h3 className="mt-4 text-lg font-bold text-ink">Add a photo</h3>
              <p className="mt-1 text-sm text-slate-500">
                Capture or upload an issue photo. All images are analyzed by GeoClean Level 3 AI for quality and waste detection.
              </p>

              {/* Hidden file inputs for Camera and Gallery */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handlePhoto(e, 'CAMERA')}
                className="hidden"
                id="camera-file-input"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handlePhoto(e, 'GALLERY')}
                className="hidden"
                id="gallery-file-input"
              />

              {!photo ? (
                <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                  {/* Option A: Camera (Geotagged) */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[#9ecbad] bg-[#f8fcf8] p-6 text-center transition hover:border-forest hover:bg-[#eef9f0]"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-forest/10 text-forest">
                      <Camera size={24} />
                    </div>
                    <div>
                      <strong className="block text-sm font-bold text-ink">Take Photo (Camera)</strong>
                      <span className="mt-1 block text-xs text-slate-500">Auto-geotags coordinates & location</span>
                    </div>
                  </button>

                  {/* Option B: Gallery */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center transition hover:border-forest hover:bg-[#f4fbf6]"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
                      <ImageIcon size={24} />
                    </div>
                    <div>
                      <strong className="block text-sm font-bold text-ink">Upload from Gallery</strong>
                      <span className="mt-1 block text-xs text-slate-500">Select an existing photo file</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {/* Photo Preview Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img src={photo} alt="Reported waste issue" className="h-52 w-full object-cover" />
                    
                    {/* Source Badge */}
                    <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {imageSource === 'CAMERA' ? (
                        <>
                          <Camera size={13} className="text-lime" />
                          <span>Camera {isGeotagged ? '· Geotagged' : ''}</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={13} className="text-lime" />
                          <span>Gallery Upload</span>
                        </>
                      )}
                    </div>

                    {/* Replace Trigger */}
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <button
                        type="button"
                        onClick={resetPhoto}
                        className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-forest shadow backdrop-blur-sm hover:bg-white"
                      >
                        <RefreshCw size={13} className="mr-1 inline" /> Replace
                      </button>
                    </div>
                  </div>

                  {/* AI Verification State Display */}
                  {verificationStatus === 'PENDING' && (
                    <div className="flex items-center gap-3.5 rounded-2xl border border-mint bg-mint/50 p-4 text-forest">
                      <span className="spinner flex-shrink-0" />
                      <div>
                        <b className="block text-xs uppercase tracking-wider font-extrabold text-forest">Verifying image with GeoClean AI...</b>
                        <span className="text-xs text-slate-600">Analyzing image for waste detection, relevance, and visual quality...</span>
                      </div>
                    </div>
                  )}

                  {verificationStatus === 'VERIFIED' && verificationResult && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <CheckCircle2 size={18} className="text-forest" />
                          <strong className="text-sm font-bold">✓ Image Verified by GeoClean AI</strong>
                        </div>
                        <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {Math.round(verificationResult.confidence * 100)}% Confidence
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-emerald-700">
                        Waste detected · Quality: <b>{verificationResult.quality}</b>
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-bold text-forest border border-emerald-300">
                          {verificationResult.category || issueType}
                        </span>
                        {verificationResult.detectedWasteTypes
                          ?.filter((t) => t !== verificationResult.category)
                          .map((t) => (
                            <span key={t} className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                              {t}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {verificationStatus === 'FAILED' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                        <div className="flex-1">
                          <strong className="block text-sm font-bold">✕ Image Not Verified</strong>
                          <p className="mt-1 text-xs font-bold text-amber-900">
                            {verificationResult?.wasteDetected === false ? 'No relevant waste detected.' : 'Image could not be verified.'}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                            {verificationResult?.reason || 'Please upload a clear photo showing the reported waste/cleanliness issue.'}
                          </p>
                          {verificationResult?.quality === 'POOR' && (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              Image quality: POOR — Please upload a clearer, well-lit image.
                            </p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={resetPhoto}
                              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-800"
                            >
                              Upload / Capture Another Image
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Location (Two Options: Current Location vs Add Location with Structured Address Form) */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="form-icon"><MapPin size={21} /></div>
              <h3 className="mt-4 text-lg font-bold text-ink">Where is the waste issue?</h3>
              <p className="mt-1 text-sm text-slate-500">
                Provide the structured address of the cleanliness issue. Choose one of the two options below.
              </p>

              {/* Two Option Cards: [ 📍 Current Location ] and [ ✏ Add Location ] */}
              <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                {/* Option 1: Current Location */}
                <button
                  type="button"
                  onClick={detectCurrentLocation}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-5 text-center transition ${
                    locationOption === 'CURRENT'
                      ? 'border-forest bg-[#eef9f0] shadow-sm ring-1 ring-forest/20'
                      : 'border-dashed border-[#9ecbad] bg-[#f8fcf8] hover:border-forest hover:bg-[#eef9f0]'
                  }`}
                >
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${
                    locationOption === 'CURRENT' ? 'bg-forest text-white' : 'bg-forest/10 text-forest'
                  }`}>
                    <LocateFixed size={22} />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-ink">Current Location</strong>
                    <span className="mt-0.5 block text-xs text-slate-500">Auto-detect GPS & reverse geocode address</span>
                  </div>
                </button>

                {/* Option 2: Add Location */}
                <button
                  type="button"
                  onClick={selectAddLocation}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-5 text-center transition ${
                    locationOption === 'MANUAL'
                      ? 'border-forest bg-[#f4fbf6] shadow-sm ring-1 ring-forest/20'
                      : 'border-dashed border-slate-200 bg-white hover:border-forest hover:bg-[#f4fbf6]'
                  }`}
                >
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${
                    locationOption === 'MANUAL' ? 'bg-forest text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Edit3 size={22} />
                  </div>
                  <div>
                    <strong className="block text-sm font-bold text-ink">Add Location</strong>
                    <span className="mt-0.5 block text-xs text-slate-500">Enter structured address fields</span>
                  </div>
                </button>
              </div>

              {/* State 1: Location Loading */}
              {locationLoading && (
                <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-mint bg-mint/50 p-4 text-forest">
                  <span className="spinner flex-shrink-0" />
                  <div>
                    <b className="block text-xs uppercase tracking-wider font-extrabold text-forest">Detecting Current Location...</b>
                    <span className="text-xs text-slate-600">Requesting device GPS and reverse geocoding via OpenStreetMap...</span>
                  </div>
                </div>
              )}

              {/* State 2: Current Location Permission Error */}
              {!locationLoading && locationOption === 'CURRENT' && locationError && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    <div className="flex-1">
                      <strong className="block text-sm font-bold">Location Permission Required</strong>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        {locationError}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={detectCurrentLocation}
                          className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-800"
                        >
                          <RefreshCw size={13} className="mr-1 inline" /> Retry Permission
                        </button>
                        <button
                          type="button"
                          onClick={selectAddLocation}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-300 hover:bg-amber-100"
                        >
                          <Edit3 size={13} className="mr-1 inline" /> Use Add Location Instead
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* State 3: Structured Address Form (Rendered for both CURRENT and MANUAL modes) */}
              {(locationOption === 'CURRENT' || locationOption === 'MANUAL') && !locationLoading && (
                <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  {/* Top Status Header */}
                  {locationOption === 'CURRENT' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <CheckCircle2 size={16} className="text-forest" />
                          <strong className="text-xs font-bold">GPS Location Detected</strong>
                        </div>
                        {coordinates && (
                          <span className="rounded-md bg-forest/10 px-2 py-0.5 text-[11px] font-mono font-bold text-forest">
                            {coordinates}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-emerald-700">
                        Review the detected address below. Please fill in any missing fields (such as <b>Near Landmark</b>).
                      </p>
                    </div>
                  )}

                  {locationOption === 'MANUAL' && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <Edit3 size={14} className="text-forest" />
                        <span>Structured Address Form</span>
                      </div>
                      <span className="text-[11px] text-slate-400">All fields required (*)</span>
                    </div>
                  )}

                  {/* 8 Structured Address Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Field 1: Area */}
                    <div>
                      <label className="field-label" htmlFor="loc-area">
                        Area <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-area"
                        type="text"
                        value={locationForm.area}
                        onChange={(e) => handleLocationFieldChange('area', e.target.value)}
                        onBlur={() => triggerPinLookup(locationForm)}
                        placeholder="Enter area name"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 2: Locality */}
                    <div>
                      <label className="field-label" htmlFor="loc-locality">
                        Locality <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-locality"
                        type="text"
                        value={locationForm.locality}
                        onChange={(e) => handleLocationFieldChange('locality', e.target.value)}
                        onBlur={() => triggerPinLookup(locationForm)}
                        placeholder="Enter locality"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 3: Near Landmark */}
                    <div>
                      <label className="field-label" htmlFor="loc-landmark">
                        Near Landmark <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-landmark"
                        type="text"
                        value={locationForm.landmark}
                        onChange={(e) => handleLocationFieldChange('landmark', e.target.value)}
                        placeholder="Enter nearby landmark"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 4: Street */}
                    <div>
                      <label className="field-label" htmlFor="loc-street">
                        Street <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-street"
                        type="text"
                        value={locationForm.street}
                        onChange={(e) => handleLocationFieldChange('street', e.target.value)}
                        onBlur={() => triggerPinLookup(locationForm)}
                        placeholder="Enter street / road name"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 5: District */}
                    <div>
                      <label className="field-label" htmlFor="loc-district">
                        District <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-district"
                        type="text"
                        value={locationForm.district}
                        onChange={(e) => handleLocationFieldChange('district', e.target.value)}
                        onBlur={() => triggerPinLookup(locationForm)}
                        placeholder="Enter district"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 6: State */}
                    <div>
                      <label className="field-label" htmlFor="loc-state">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-state"
                        type="text"
                        value={locationForm.state}
                        onChange={(e) => handleLocationFieldChange('state', e.target.value)}
                        onBlur={() => triggerPinLookup(locationForm)}
                        placeholder="Enter state"
                        className="field-input text-ink"
                      />
                    </div>

                    {/* Field 7: PIN Code with Auto-capture / Manual Fallback */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="field-label !mt-0" htmlFor="loc-pincode">
                          PIN Code <span className="text-red-500">*</span>
                        </label>
                        {!pinLookupLoading && (
                          <button
                            type="button"
                            onClick={() => triggerPinLookup(locationForm)}
                            className="text-[11px] font-bold text-forest hover:underline"
                          >
                            Auto-detect PIN
                          </button>
                        )}
                      </div>
                      <input
                        id="loc-pincode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={locationForm.pincode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          handleLocationFieldChange('pincode', val);
                        }}
                        placeholder="6-digit PIN code"
                        className="field-input text-ink font-mono"
                      />
                      {pinLookupLoading && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-forest">
                          <span className="spinner !h-2.5 !w-2.5" /> Finding PIN code...
                        </p>
                      )}
                      {pinLookupMessage && !pinLookupLoading && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          {pinLookupMessage}
                        </p>
                      )}
                      {locationForm.pincode && !/^\d{6}$/.test(locationForm.pincode.trim()) && (
                        <p className="mt-1 text-[11px] text-red-500 font-semibold">
                          PIN Code must contain exactly 6 numeric digits.
                        </p>
                      )}
                    </div>

                    {/* Field 8: Country */}
                    <div>
                      <label className="field-label" htmlFor="loc-country">
                        Country <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="loc-country"
                        type="text"
                        value={locationForm.country}
                        onChange={(e) => handleLocationFieldChange('country', e.target.value)}
                        placeholder="India"
                        className="field-input text-ink bg-slate-50 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Form Live Address Preview */}
                  {readableLocation && (
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                        Formatted Address
                      </span>
                      <p className="text-slate-800 font-medium leading-relaxed">{readableLocation}</p>
                    </div>
                  )}

                  {/* Validation Helper Status */}
                  <div className="border-t border-slate-100 pt-3">
                    {isLocationFormValid() ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={15} className="text-forest" />
                        <span>All 8 required address fields completed</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-xs text-slate-500">
                        <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <span>
                          Please fill all 8 required fields: Area, Locality, Near Landmark, Street, District, State, valid 6-digit PIN Code, and Country.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action switcher */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {locationOption === 'CURRENT' ? (
                      <>
                        <button
                          type="button"
                          onClick={detectCurrentLocation}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-forest border border-emerald-300 hover:bg-emerald-50"
                        >
                          <RefreshCw size={12} className="mr-1 inline" /> Re-detect GPS
                        </button>
                        <button
                          type="button"
                          onClick={selectAddLocation}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
                        >
                          <Edit3 size={12} className="mr-1 inline" /> Switch to Add Location
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={detectCurrentLocation}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-forest border border-emerald-300 hover:bg-emerald-50"
                      >
                        <LocateFixed size={12} className="mr-1 inline" /> Use Current GPS Location instead
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Initial State: Neither option clicked yet */}
              {locationOption === 'NONE' && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Please choose <b>Current Location</b> or <b>Add Location</b> to proceed.
                </p>
              )}
            </div>
          )}

          {/* Step 4: Details (Optional) */}
          {step === 4 && (
            <div className="animate-fade-in">
              <div className="form-icon"><MessageCircle size={21} /></div>
              <h3 className="mt-4 text-lg font-bold text-ink">Add a little context</h3>
              <p className="mt-1 text-sm text-slate-500">Optional details help the cleanup team arrive prepared.</p>
              <label className="field-label" htmlFor="description">Description <span>(optional)</span></label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-input min-h-[140px] resize-none"
                placeholder="Describe what you noticed, such as the size or exact landmark..."
              />
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div className="animate-fade-in">
              <div className="form-icon"><ShieldCheck size={21} /></div>
              <h3 className="mt-4 text-lg font-bold text-ink">Review your report</h3>
              <p className="mt-1 text-sm text-slate-500">Everything look right? Submit when you are ready.</p>
              
              <div className="review-list">
                <ReviewRow label="Issue type" value={issueType} />
                
                {/* Structured Location Review Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-forest flex items-center gap-1.5">
                      <MapPin size={14} /> Location
                    </span>
                    <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[10px] font-bold text-forest">
                      {locationOption === 'CURRENT' ? 'Current Location (GPS Verified)' : 'Add Location (Structured Address)'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-slate-400">Area:</span> <b className="text-slate-800 ml-1">{locationForm.area}</b></div>
                    <div><span className="text-slate-400">Locality:</span> <b className="text-slate-800 ml-1">{locationForm.locality}</b></div>
                    <div><span className="text-slate-400">Near Landmark:</span> <b className="text-slate-800 ml-1">{locationForm.landmark}</b></div>
                    <div><span className="text-slate-400">Street:</span> <b className="text-slate-800 ml-1">{locationForm.street}</b></div>
                    <div><span className="text-slate-400">District:</span> <b className="text-slate-800 ml-1">{locationForm.district}</b></div>
                    <div><span className="text-slate-400">State:</span> <b className="text-slate-800 ml-1">{locationForm.state}</b></div>
                    <div><span className="text-slate-400">PIN Code:</span> <b className="text-slate-800 ml-1">{locationForm.pincode}</b></div>
                    <div><span className="text-slate-400">Country:</span> <b className="text-slate-800 ml-1">{locationForm.country}</b></div>
                  </div>

                  {coordinates && (
                    <div className="border-t border-slate-200/80 pt-2 text-[11px] text-slate-500 font-mono">
                      Coordinates: <b className="text-slate-700">{coordinates}</b>
                    </div>
                  )}
                </div>

                <ReviewRow label="Image source" value={imageSource === 'CAMERA' ? 'Camera' : 'Gallery Upload'} />
                <ReviewRow label="AI Verification" value={`Verified by GeoClean AI (${Math.round((verificationResult?.confidence ?? 0.85) * 100)}% conf)`} />
                {verificationResult?.category && <ReviewRow label="Detected Category" value={verificationResult.category} />}
                
                {photo && (
                  <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <img src={photo} alt="Waste report preview" className="h-32 w-full object-cover" />
                    <span className="absolute bottom-2 left-2 rounded-md bg-forest/90 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      ✓ AI Verified ({Math.round((verificationResult?.confidence ?? 0.85) * 100)}%)
                    </span>
                  </div>
                )}
                
                {description && <ReviewRow label="Details" value={description} />}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

          {/* Modal Footer Controls */}
          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep((c) => c - 1);
                }}
                className="button-quiet"
                disabled={submitting || isVerifying}
              >
                Back
              </button>
            ) : <span />}

            {step < 5 ? (
              <button
                type="button"
                onClick={next}
                disabled={!isStepValid(step) || isVerifying}
                className="button-primary"
              >
                {isVerifying ? (
                  <>
                    <span className="spinner mr-1" /> Verifying...
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={17} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isStepValid(5) || submitting}
                className="button-primary"
              >
                {submitting ? (
                  <>
                    <span className="spinner mr-1" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={17} /> Submit Report
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
