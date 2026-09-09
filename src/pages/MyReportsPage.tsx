import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth';
import {
  getStatusBadgeClass,
  loadCitizenReports,
  softDeleteReport,
  statusLabel,
  STATUS_FLOW,
} from '@/lib/reportData';
import type { Report } from '@/lib/types';

const DELETE_REASONS = [
  'Uploaded wrong image',
  'Reported by mistake',
  'Duplicate report',
  'Issue no longer exists',
  'Other',
];

/**
 * Detailed Modal for both Issues Reported and Issues Resolved
 */
function ReportDetailModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const isResolved = report.status === 'Resolved';
  const beforeImg = report.beforePhoto || report.photo;
  const afterImg = report.afterPhoto;

  // Determine active step index in STATUS_FLOW: ['Submitted', 'Assigned', 'In Progress', 'Resolving', 'Resolved']
  const currentStepIndex = STATUS_FLOW.indexOf(
    report.status === 'Available Again' ? 'Submitted' : (report.status as typeof STATUS_FLOW[number])
  );

  return (
    <div
      className="modal-backdrop animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ngo-modal report-detail max-h-[90vh] overflow-y-auto max-w-2xl">
        <button onClick={onClose} className="modal-close" aria-label="Close report details">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-forest">{report.id}</span>
              <span className={`report-status text-xs px-2.5 py-0.5 rounded-full font-bold ${getStatusBadgeClass(report.status)}`}>
                {statusLabel(report.status)}
              </span>
            </div>
            <h2 id="report-detail-title" className="mt-2 text-xl font-extrabold tracking-tight text-ink">
              {report.issueType}
            </h2>
          </div>
        </div>

        {/* Image Display */}
        {isResolved ? (
          <div className="mt-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cleanliness Transformation (Before &amp; After)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Before Image */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                {beforeImg ? (
                  <img
                    src={beforeImg}
                    alt="Before cleaning"
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center text-slate-400 text-xs">
                    No Before Photo
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-sm">
                  BEFORE (Original Issue)
                </div>
              </div>

              {/* After Image */}
              <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50 shadow-sm">
                {afterImg ? (
                  <img
                    src={afterImg}
                    alt="After cleaning"
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full flex-col items-center justify-center text-emerald-800 text-xs p-4 text-center">
                    <CheckCircle2 size={24} className="text-forest mb-1" />
                    <span>Cleaned &amp; Resolved by Partner NGO</span>
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 rounded-lg bg-forest px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
                  AFTER (Cleaned Site)
                </div>
              </div>
            </div>
          </div>
        ) : (
          beforeImg && (
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                src={beforeImg}
                alt={`Reported ${report.issueType}`}
                className="h-56 w-full object-cover"
              />
              <div className="absolute top-2.5 left-2.5 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-sm">
                Reported Photo
              </div>
            </div>
          )
        )}

        {/* Report Key Details Grid */}
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-xs space-y-2.5">
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin size={15} className="mt-0.5 text-forest flex-shrink-0" />
            <div>
              <strong className="block text-ink font-semibold">Location</strong>
              <span className="text-slate-600">{report.readableLocation || report.location}</span>
              {report.coordinates && (
                <span className="block text-[11px] text-slate-400 font-mono mt-0.5">
                  Coordinates: {report.coordinates}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <span>
                <b>Reported:</b>{' '}
                {new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>

            {isResolved && report.resolvedAt && (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-forest" />
                <span>
                  <b>Resolved:</b>{' '}
                  {new Date(report.resolvedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
            )}
          </div>

          {/* NGO Information */}
          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
            <Leaf size={14} className="text-forest flex-shrink-0" />
            <span>
              {isResolved ? (
                <>
                  <b>Resolved by:</b>{' '}
                  <span className="font-bold text-forest">
                    {report.resolvedByNgoName || report.assignedNgoName || report.assignedTo || 'Partner NGO'}
                  </span>
                </>
              ) : report.assignedNgoName || report.assignedTo ? (
                <>
                  <b>Assigned to:</b>{' '}
                  <span className="font-bold text-forest">
                    {report.assignedNgoName || report.assignedTo}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  <b>NGO:</b> Not assigned yet (Awaiting nearby partner claim)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Description */}
        {report.description && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Issue Description</h3>
            <p className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
              {report.description}
            </p>
          </div>
        )}

        {/* Chronological 5-Stage Status Timeline */}
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Clock3 size={14} className="text-forest" /> Status Timeline
          </h3>

          <div className="space-y-3 pl-1">
            {STATUS_FLOW.map((flowStep, index) => {
              const isPassed = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              // Extract actual timestamp from statusHistory if available
              const historyItem = report.statusHistory?.find((h) => h.status === flowStep);
              const stepTime = historyItem?.timestamp
                ? new Date(historyItem.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                : index === 0
                ? new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                : index === 4 && report.resolvedAt
                ? new Date(report.resolvedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                : undefined;

              return (
                <div key={flowStep} className="flex items-start gap-3 relative">
                  {/* Vertical connector line */}
                  {index < STATUS_FLOW.length - 1 && (
                    <div
                      className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${
                        index < currentStepIndex ? 'bg-forest' : 'bg-slate-200'
                      }`}
                      style={{ height: 'calc(100% + 4px)' }}
                    />
                  )}

                  {/* Icon Indicator */}
                  <div
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold z-10 ${
                      isPassed
                        ? 'bg-forest text-white shadow-sm'
                        : 'bg-slate-100 text-slate-400 border border-slate-300'
                    } ${isCurrent ? 'ring-4 ring-forest/20' : ''}`}
                  >
                    {isPassed ? <CheckCircle2 size={14} /> : '○'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 -mt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isPassed ? 'text-ink' : 'text-slate-400'}`}>
                        {flowStep === 'Submitted' ? 'Submitted (Pending)' : flowStep}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-extrabold text-forest">
                          Current Status
                        </span>
                      )}
                    </div>
                    <span className="block text-xs text-slate-500">
                      {isPassed && stepTime ? stepTime : isPassed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-8 flex justify-end">
          <button type="button" onClick={onClose} className="button-secondary px-6">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Soft Delete Confirmation Modal
 */
function DeleteConfirmationModal({
  report,
  onClose,
  onConfirm,
}: {
  report: Report;
  onClose: () => void;
  onConfirm: (reason: string, customReason?: string) => Promise<void>;
}) {
  const [selectedReason, setSelectedReason] = useState(DELETE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = selectedReason !== 'Other' || customReason.trim() !== '';

  const handleDelete = async () => {
    if (!isFormValid) {
      setError('Please provide a reason for deleting this report.');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await onConfirm(selectedReason, customReason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete report. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-report-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ngo-modal max-w-md">
        <button onClick={onClose} className="modal-close" aria-label="Cancel deletion">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 text-red-600">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 id="delete-report-title" className="text-lg font-extrabold text-ink">
              Delete Report?
            </h2>
            <span className="text-xs font-mono font-bold text-slate-500">{report.id}</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Are you sure you want to delete this report? It will be removed from your active reports and any assigned cleanup partner will be notified.
        </p>

        {report.assignedNgoName && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <span>
              This report is currently assigned to <b>{report.assignedNgoName}</b>. They will receive an automatic cancellation notice with your reason.
            </span>
          </div>
        )}

        {/* Required Reason Selector */}
        <div className="mt-4">
          <label className="field-label" htmlFor="delete-reason-select">
            Why are you deleting this report? <span className="text-red-500">*</span>
          </label>
          <select
            id="delete-reason-select"
            value={selectedReason}
            onChange={(e) => {
              setSelectedReason(e.target.value);
              setError('');
            }}
            className="field-input font-medium text-ink bg-white"
          >
            {DELETE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Textarea if Other is selected */}
        {selectedReason === 'Other' && (
          <div className="mt-3">
            <label className="field-label" htmlFor="custom-delete-reason">
              Please describe your reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="custom-delete-reason"
              rows={2}
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setError('');
              }}
              placeholder="Provide a brief explanation..."
              className="field-input text-ink resize-none text-xs"
            />
          </div>
        )}

        {error && <p className="mt-3 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="button-secondary flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !isFormValid}
            className="button-danger flex-1 justify-center"
          >
            {deleting ? (
              <>
                <span className="spinner mr-1.5" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} /> Delete Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyReportsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportIdParam = searchParams.get('reportId');
  const [reports, setReports] = useState<Report[]>([]);
  const [activeTab, setActiveTab] = useState<'reported' | 'resolved'>('reported');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [deletingReport, setDeletingReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  // Load citizen reports
  const fetchReports = async () => {
    if (!user) return;
    try {
      const data = await loadCitizenReports(user.id, user.email);
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReports();

    // Listen for custom report update events from NGO or Report submissions
    const handleUpdate = () => void fetchReports();
    window.addEventListener('geoclean-reports-updated', handleUpdate);
    return () => window.removeEventListener('geoclean-reports-updated', handleUpdate);
  }, [user]);

  // Automatically open report details modal if navigated with ?reportId=...
  useEffect(() => {
    if (reportIdParam && reports.length > 0) {
      const match = reports.find(
        (r) =>
          r.id === reportIdParam ||
          r.dbId === reportIdParam ||
          r.id.toLowerCase() === reportIdParam.toLowerCase()
      );
      if (match) {
        setSelectedReport(match);
        if (match.status === 'Resolved') {
          setActiveTab('resolved');
        } else {
          setActiveTab('reported');
        }
      }
    }
  }, [reportIdParam, reports]);

  const handleCloseModal = () => {
    setSelectedReport(null);
    if (searchParams.has('reportId')) {
      setSearchParams({}, { replace: true });
    }
  };

  // Two sections filter:
  // 1. Issues Reported: active, non-deleted, non-resolved
  const reportedList = useMemo(() => {
    return reports.filter((r) => !r.deleted && r.status !== 'Resolved');
  }, [reports]);

  // 2. Issues Resolved: non-deleted, status === 'Resolved'
  const resolvedList = useMemo(() => {
    return reports.filter((r) => !r.deleted && r.status === 'Resolved');
  }, [reports]);

  const handleDeleteConfirm = async (reason: string, customReason?: string) => {
    if (!deletingReport || !user) return;
    await softDeleteReport(
      deletingReport.id,
      user.id,
      reason,
      customReason,
      deletingReport.assignedNgoId,
      deletingReport.id
    );
    // Remove immediately from active UI state
    setReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
    setDeletingReport(null);
  };

  return (
    <DashboardLayout>
      <section className="page-shell py-10 sm:py-14">
        {/* Header */}
        <div className="section-kicker">
          <Clock3 size={15} /> Personal report tracker
        </div>
        <h1 className="mt-4 section-title">My Reports</h1>
        <p className="section-subtitle mt-3 max-w-2xl">
          Track the waste issues you have reported and follow their cleanup progress by partner NGOs.
        </p>

        {/* Exactly TWO Tabs: [ Issues Reported ] and [ Issues Resolved ] */}
        <div className="mt-8 flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('reported')}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition ${
              activeTab === 'reported'
                ? 'bg-forest text-white shadow-md shadow-forest/20 ring-2 ring-forest/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <AlertTriangle size={17} />
            <span>Issues Reported</span>
            <span
              className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'reported' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {reportedList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition ${
              activeTab === 'resolved'
                ? 'bg-forest text-white shadow-md shadow-forest/20 ring-2 ring-forest/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <CheckCircle2 size={17} />
            <span>Issues Resolved</span>
            <span
              className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'resolved' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {resolvedList.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Issues Reported */}
        {activeTab === 'reported' && (
          <div className="mt-8">
            {loading ? (
              <div className="dash-empty">
                <span className="spinner !h-6 !w-6 mb-2" />
                <p>Loading your reported issues...</p>
              </div>
            ) : reportedList.length > 0 ? (
              <div className="my-reports-grid">
                {reportedList.map((report) => (
                  <article key={report.id} className="my-report-card">
                    {/* Card Photo / Icon */}
                    <button
                      type="button"
                      onClick={() => setSelectedReport(report)}
                      className="report-card-image relative group text-left"
                      aria-label={`View details for ${report.id}`}
                    >
                      {report.photo || report.beforePhoto ? (
                        <img
                          src={report.photo || report.beforePhoto}
                          alt={`Reported ${report.issueType}`}
                          className="h-48 w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center bg-slate-100 text-slate-300">
                          <MapPin size={36} />
                        </div>
                      )}
                      {/* Status Tag Overlay */}
                      <span
                        className={`absolute top-3 right-3 rounded-lg px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${getStatusBadgeClass(
                          report.status
                        )}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                    </button>

                    {/* Card Body */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-base font-extrabold text-ink">{report.issueType}</h2>
                          <p className="report-id-small font-mono">{report.id}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                        {report.description || 'No additional description provided.'}
                      </p>

                      {/* Location & Date */}
                      <p className="report-location mt-3 truncate text-xs text-slate-600 flex items-center gap-1.5">
                        <MapPin size={13} className="text-forest flex-shrink-0" />
                        <span className="truncate">{report.readableLocation || report.location}</span>
                      </p>

                      <p className="report-date mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Calendar size={13} />
                        <span>{new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </p>

                      {/* Assigned NGO info */}
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                        {report.assignedNgoName || report.assignedTo ? (
                          <div className="flex items-center gap-1.5 text-forest font-semibold">
                            <Leaf size={13} />
                            <span>Assigned to: {report.assignedNgoName || report.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">NGO: Not assigned yet</span>
                        )}
                      </div>

                      {/* Actions: View Details and Delete Report */}
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="button-secondary flex-1 justify-center text-xs py-2"
                          onClick={() => setSelectedReport(report)}
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          className="delete-report-button"
                          onClick={() => setDeletingReport(report)}
                          title={`Delete report ${report.id}`}
                          aria-label={`Delete report ${report.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="directory-empty col-span-full py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-forest mb-4">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="text-lg font-bold text-ink">No active reported issues</h2>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  All your reported waste issues have been resolved or you have not submitted any active reports.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Issues Resolved */}
        {activeTab === 'resolved' && (
          <div className="mt-8">
            {loading ? (
              <div className="dash-empty">
                <span className="spinner !h-6 !w-6 mb-2" />
                <p>Loading resolved reports...</p>
              </div>
            ) : resolvedList.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {resolvedList.map((report) => {
                  const before = report.beforePhoto || report.photo;
                  const after = report.afterPhoto;

                  return (
                    <article
                      key={report.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      {/* Before / After Image Section (Desktop side-by-side, Mobile stacked) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Before Image */}
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          {before ? (
                            <img
                              src={before}
                              alt="Before cleaning"
                              className="h-44 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-44 w-full items-center justify-center text-slate-400 text-xs">
                              No Before Photo
                            </div>
                          )}
                          <span className="absolute top-2 left-2 rounded-lg bg-black/75 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                            BEFORE
                          </span>
                        </div>

                        {/* After Image */}
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50">
                          {after ? (
                            <img
                              src={after}
                              alt="After cleaning"
                              className="h-44 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-44 w-full flex-col items-center justify-center text-emerald-800 text-xs p-3 text-center">
                              <CheckCircle2 size={24} className="text-forest mb-1" />
                              <span className="font-bold">Site Cleaned</span>
                            </div>
                          )}
                          <span className="absolute top-2 left-2 rounded-lg bg-forest px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                            AFTER
                          </span>
                        </div>
                      </div>

                      {/* Resolved Card Info */}
                      <div className="mt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-base font-extrabold text-ink">{report.issueType}</h2>
                            <p className="report-id-small font-mono">{report.id}</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-extrabold border border-emerald-300">
                            ✓ Resolved
                          </span>
                        </div>

                        {/* Resolved By NGO */}
                        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-mint/50 p-2.5 text-xs text-forest font-bold">
                          <Leaf size={14} className="flex-shrink-0" />
                          <span>
                            Resolved by:{' '}
                            <span className="text-ink font-extrabold">
                              {report.resolvedByNgoName || report.assignedNgoName || report.assignedTo || 'Partner NGO'}
                            </span>
                          </span>
                        </div>

                        {/* Location & Dates */}
                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPin size={13} className="text-forest flex-shrink-0" />
                            <span className="truncate">{report.readableLocation || report.location}</span>
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                            <span>
                              Reported:{' '}
                              {new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium' })}
                            </span>
                            {report.resolvedAt && (
                              <span className="font-semibold text-emerald-700">
                                Resolved:{' '}
                                {new Date(report.resolvedAt).toLocaleString([], { dateStyle: 'medium' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action: ONLY View Details (Strictly NO Delete Button in Resolved) */}
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            className="button-primary w-full justify-center text-xs py-2.5"
                            onClick={() => setSelectedReport(report)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="directory-empty col-span-full py-16 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-forest mb-4">
                  <Leaf size={28} />
                </div>
                <h2 className="text-lg font-bold text-ink">No resolved issues yet</h2>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  When cleanup partner NGOs complete work on your reported issues and submit before/after proof, they will appear here.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* View Details Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={handleCloseModal}
        />
      )}

      {/* Delete Confirmation Modal (Only for Issues Reported) */}
      {deletingReport && (
        <DeleteConfirmationModal
          report={deletingReport}
          onClose={() => setDeletingReport(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </DashboardLayout>
  );
}
