import { useState, type ChangeEvent } from 'react';
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Sparkles,
  Truck,
  X,
  AlertTriangle,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import {
  acceptReport,
  changeReportStatus,
  imageOf,
  releaseReport,
  statusLabel,
  uploadAfterPhoto,
  type DbReport,
} from '@/lib/reportData';
import { ImageVerificationService } from '@/lib/ai/imageVerificationService';

export interface ReportDetailModalProps {
  report: DbReport;
  ours: boolean;
  ngoName?: string;
  ngoId?: string;
  onClose: () => void;
  refresh: () => Promise<void>;
}

export function ReportDetailModal({
  report,
  ours,
  ngoName,
  ngoId,
  onClose,
  refresh,
}: ReportDetailModalProps) {
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadedAfterUrl, setUploadedAfterUrl] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const before = imageOf(report, 'before');
  const after = uploadedAfterUrl || imageOf(report, 'after');
  const releasedByUs = report.ngo_assignments?.some((assignment) => assignment.status === 'released') ?? false;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result);
        const verification = await ImageVerificationService.verifyNgoAfterImage(dataUrl);
        if (!verification.verified) {
          setError(
            verification.reason ||
              'After photo could not be verified by AI. Please upload a clear photo of the cleaned site.'
          );
          setVerifying(false);
          return;
        }

        const uploadedUrl = await uploadAfterPhoto(report.id, file);
        if (uploadedUrl) {
          setUploadedAfterUrl(uploadedUrl);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Photo upload failed.');
      } finally {
        setVerifying(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const release = () => {
    if (!reason.trim()) {
      setError('Please provide a reason before releasing this assignment.');
      return;
    }
    void run(() => releaseReport(report.id, reason.trim()));
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ngo-modal report-detail max-h-[90vh] overflow-y-auto max-w-2xl">
        <button className="modal-close" onClick={onClose} aria-label="Close report">
          <X size={20} />
        </button>

        <div className="flex items-center gap-2">
          <span className="report-id-small font-mono font-bold text-forest">{report.report_code}</span>
          <span className={`report-status ${report.status.replace('_', '-')}`}>
            {statusLabel(report.status)}
          </span>
        </div>
        <h2 className="mt-1 text-xl font-extrabold text-ink">{report.waste_type}</h2>

        <div className="report-detail-info mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs space-y-1.5">
          <p className="flex items-center gap-1.5 text-slate-700">
            <MapPin size={15} className="text-forest flex-shrink-0" />
            <span>{report.address}</span>
          </p>
          <p className="text-slate-500">
            Submitted: {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {report.resolved_at && (
            <p className="text-emerald-700 font-semibold">
              Completed: {new Date(report.resolved_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          {report.latitude !== null && report.longitude !== null && (
            <p className="font-mono text-slate-400">
              Coordinates: {report.latitude}, {report.longitude}
            </p>
          )}
        </div>

        <h3>Report Information</h3>
        <p className="ngo-modal-copy text-sm">
          <b>{report.waste_type}</b> · {report.title}
          <br />
          {report.description || 'No additional description provided.'}
        </p>

        <h3>Citizen Details</h3>
        <div className="ngo-modal-copy text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
          <p className="flex items-center gap-1.5">
            <User size={13} className="text-slate-400" />
            <b>Name:</b> {report.profiles?.full_name || 'Citizen Reporter'}
          </p>
          <p className="flex items-center gap-1.5">
            <Phone size={13} className="text-slate-400" />
            <b>Phone:</b> {report.profiles?.mobile_number || 'Mobile number not provided'}
          </p>
          <p className="flex items-center gap-1.5">
            <Mail size={13} className="text-slate-400" />
            <b>Email:</b> {report.profiles?.email || 'Email not provided'}
          </p>
        </div>

        {/* Photos Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Before Cleaning</h3>
            {before ? (
              <img
                className="h-44 w-full object-cover rounded-2xl border border-slate-200 shadow-sm"
                src={before}
                alt="Before cleaning"
              />
            ) : (
              <div className="flex h-44 w-full items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-400">
                No before-cleaning photo
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">After Cleaning</h3>
            {after ? (
              <img
                className="h-44 w-full object-cover rounded-2xl border border-emerald-300 shadow-sm"
                src={after}
                alt="After cleaning"
              />
            ) : (
              <div className="flex h-44 w-full flex-col items-center justify-center rounded-2xl bg-emerald-50 border border-dashed border-emerald-200 text-xs text-emerald-800 p-3 text-center">
                <span>Upload cleaned photo before resolving</span>
              </div>
            )}
          </div>
        </div>

        {verifying && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-mint p-3 text-xs font-bold text-forest">
            <span className="spinner" /> Verifying after photo with Level 3 AI...
          </div>
        )}
        {error && (
          <p className="auth-error mt-4 text-xs font-semibold text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
            {error}
          </p>
        )}

        {/* Actions Progression */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {/* 1. Accept/Claim */}
          {!ours &&
            (report.status === 'available' || report.status === 'released' || report.status === 'submitted') &&
            !releasedByUs && (
              <button
                disabled={busy || verifying}
                className="button-primary text-xs flex items-center gap-1.5"
                onClick={() => void run(() => acceptReport(report.id, ngoName, ngoId))}
              >
                <CheckCircle2 size={16} /> Accept / Claim Issue
              </button>
            )}

          {!ours && report.assigned_ngo_id && (
            <span className="text-xs font-bold text-slate-500 self-center">Assigned to another organization</span>
          )}
          {releasedByUs && (
            <span className="text-xs font-bold text-red-600 self-center">Released by your NGO</span>
          )}

          {/* 2. Start Cleaning -> in_progress */}
          {ours && (report.status === 'assigned' || report.status === 'submitted') && (
            <button
              disabled={busy || verifying}
              className="button-primary text-xs flex items-center gap-1.5"
              onClick={() => void run(() => changeReportStatus(report.id, 'in_progress', ngoName))}
            >
              <Truck size={16} /> Start Cleanup (In Progress)
            </button>
          )}

          {/* 3. Mark as Resolving -> resolving */}
          {ours && report.status === 'in_progress' && (
            <button
              disabled={busy || verifying}
              className="button-secondary text-xs flex items-center gap-1.5"
              onClick={() => void run(() => changeReportStatus(report.id, 'resolving', ngoName))}
            >
              <Clock3 size={16} /> Mark as Resolving
            </button>
          )}

          {/* 4. Upload After Photo */}
          {ours && (report.status === 'in_progress' || report.status === 'resolving') && (
            <label className="button-secondary cursor-pointer text-xs flex items-center gap-1.5">
              <Sparkles size={16} /> {after ? 'Re-upload After Cleaning Photo' : 'Upload After Cleaning Photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={verifying || busy}
                onChange={upload}
              />
            </label>
          )}

          {/* 5. Mark as Resolved */}
          {ours && (report.status === 'in_progress' || report.status === 'resolving') && after && (
            <button
              disabled={busy || verifying}
              className="button-primary text-xs flex items-center gap-1.5"
              onClick={() => void run(() => changeReportStatus(report.id, 'resolved', ngoName, after))}
            >
              <CheckCircle2 size={16} /> Mark as Resolved
            </button>
          )}
        </div>

        {/* Release Assignment */}
        {ours && report.status !== 'resolved' && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <label className="field-label !mt-0 text-xs" htmlFor="release-reason">
              Release reason (if unable to complete)
            </label>
            <input
              id="release-reason"
              className="field-input text-xs mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why can your team not complete this cleanup?"
            />
            <button
              disabled={busy || verifying}
              className="button-danger mt-2 text-xs py-1.5"
              onClick={release}
            >
              Release Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default ReportDetailModal;
