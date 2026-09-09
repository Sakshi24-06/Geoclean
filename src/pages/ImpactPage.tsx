import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Leaf,
  MapPin,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth';
import {
  deleteNgoCleanupResult,
  imageOf,
  loadCurrentNgo,
  loadNgoReports,
  type DbReport,
  type NgoServiceArea,
} from '@/lib/reportData';

const INITIAL_REPORT_COUNT = 6;
const REPORT_INCREMENT = 6;

export default function ImpactPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DbReport[]>([]);
  const [ngo, setNgo] = useState<NgoServiceArea | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_REPORT_COUNT);
  const [loading, setLoading] = useState<boolean>(true);

  // NGO Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DbReport | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (user?.role === 'ngo') {
        const [ngoInfo, items] = await Promise.all([loadCurrentNgo().catch(() => null), loadNgoReports()]);
        setNgo(ngoInfo);
        const resolved = items
          .filter((item) => !item.deleted && item.status === 'resolved')
          .sort((a, b) => {
            const dateA = new Date(a.resolved_at || a.created_at || 0).getTime();
            const dateB = new Date(b.resolved_at || b.created_at || 0).getTime();
            return dateB - dateA;
          });
        setReports(resolved);
      } else if (user?.role === 'user') {
        const items = await loadNgoReports();
        const resolved = items
          .filter((item) => !item.deleted && item.status === 'resolved')
          .sort((a, b) => {
            const dateA = new Date(a.resolved_at || a.created_at || 0).getTime();
            const dateB = new Date(b.resolved_at || b.created_at || 0).getTime();
            return dateB - dateA;
          });
        setReports(resolved);
      }
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ngo' || user?.role === 'user') {
      void fetchReports();

      const handleUpdate = () => void fetchReports();
      window.addEventListener('geoclean-reports-updated', handleUpdate);
      return () => window.removeEventListener('geoclean-reports-updated', handleUpdate);
    } else {
      setLoading(false);
    }
  }, [user?.role]);

  // Handle NGO deleting its own Before & After cleanup result
  const handleConfirmDelete = async () => {
    if (!deleteTarget || user?.role !== 'ngo') return;

    setDeleting(true);
    setDeleteError('');
    try {
      const ngoName = user.organization || user.name || ngo?.ngo_name || 'Green Earth NGO';
      // Pass deleteTarget so storage paths can be removed from Supabase storage as well
      await deleteNgoCleanupResult(deleteTarget.id, ngo?.id, ngoName, deleteTarget);

      // Only after successful deletion: remove from React state and refetch from Supabase
      const deletedId = deleteTarget.id;
      const deletedCode = deleteTarget.report_code;
      setReports((prev) => prev.filter((r) => r.id !== deletedId && r.report_code !== deletedCode));
      setDeleteTarget(null);
      setToastMessage('Cleanup result deleted successfully.');
      setTimeout(() => setToastMessage(''), 4000);
      await fetchReports();
    } catch (err) {
      console.error('Failed to delete cleanup result:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete cleanup result. Please try again.');
    } finally {
      setDeleting(false);
    }
  };


  if (user?.role !== 'ngo' && user?.role !== 'user') {
    return (
      <DashboardLayout>
        <section className="page-shell py-12">
          <div className="section-kicker">
            <Sparkles size={15} /> Impact analytics
          </div>
          <h1 className="mt-4 section-title">Our Impact Together</h1>
          <p className="section-subtitle mt-3">
            Track GeoClean activity and help make every neighborhood healthier.
          </p>
        </section>
      </DashboardLayout>
    );
  }

  const areas = new Set(reports.map((report) => report.address)).size;
  const isNgo = user.role === 'ngo';

  // Strict ownership checking: true only if this report was assigned to or resolved by the logged-in NGO
  const isOwnNgoResult = (report: DbReport) =>
    isNgo &&
    (report.assigned_ngo_id === ngo?.id ||
      report.assigned_ngo_id === user?.id ||
      report.resolved_by === ngo?.id ||
      report.ngo_assignments?.some((a) => a.ngo_id === ngo?.id || a.ngo_id === user?.id));

  const visibleReports = reports.slice(0, visibleCount);
  const hasMore = visibleCount < reports.length;

  const handleToggleReports = () => {
    if (hasMore) {
      setVisibleCount((prev) => Math.min(prev + REPORT_INCREMENT, reports.length));
    } else {
      setVisibleCount(INITIAL_REPORT_COUNT);
    }
  };

  return (
    <DashboardLayout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={16} className="text-forest flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <section className="page-shell py-12">
        <div className="section-kicker">
          <Leaf size={15} /> {isNgo ? 'NGO impact' : 'Community impact'}
        </div>
        <h1 className="mt-4 section-title">
          {isNgo ? 'Your Cleanup Impact' : 'NGO Cleanup Impact'}
        </h1>
        <p className="section-subtitle mt-3">
          {isNgo
            ? 'Completed cleanup work, verified with before and after photos.'
            : 'See the verified cleanup work completed by NGOs for reports available to you.'}
        </p>
      </section>

      {/* Stat Cards */}
      <section className="page-shell pb-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="impact-stat-card">
            <CheckCircle2 size={22} className="text-forest" />
            <strong>{reports.length}</strong>
            <span>Reports resolved</span>
          </div>
          <div className="impact-stat-card">
            <MapPin size={22} className="text-forest" />
            <strong>{areas}</strong>
            <span>Areas cleaned</span>
          </div>
          <div className="impact-stat-card">
            <Leaf size={22} className="text-forest" />
            <strong>{reports.filter((r) => imageOf(r, 'after')).length}</strong>
            <span>Verified results</span>
          </div>
        </div>
      </section>

      {/* Before & After Results Section */}
      <section className="page-shell pb-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-ink">Before &amp; After Results</h2>
          {reports.length > 0 && (
            <span className="text-xs font-bold text-slate-500">
              Showing {visibleReports.length} of {reports.length} resolved reports
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-8 flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-500">
            <span className="spinner" />
            <span>Loading resolved reports…</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="dash-empty mt-5">
            <Leaf size={32} />
            <p>Resolved reports with cleaning photos will appear here.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {visibleReports.map((report) => (
                <article key={report.id} className="dash-card overflow-hidden group">
                  <div className="grid sm:grid-cols-2">
                    {(['before', 'after'] as const).map((kind) => (
                      <div key={kind} className="p-3">
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-forest">
                          {kind === 'before' ? 'Before Cleaning' : 'After Cleaning'}
                        </p>
                        {imageOf(report, kind) ? (
                          <img
                            className="h-52 w-full rounded-xl object-cover"
                            src={imageOf(report, kind)}
                            alt={`${kind} cleaning`}
                          />
                        ) : (
                          <div className="grid h-52 place-items-center rounded-xl bg-mint text-xs text-slate-500">
                            Photo unavailable
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Card Details & Action Row */}
                  <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <b>
                        {report.report_code} · {report.waste_type}
                      </b>
                      <p className="mt-1 text-sm text-slate-500 truncate">
                        {report.address} · Cleaned{' '}
                        {report.resolved_at
                          ? new Date(report.resolved_at).toLocaleDateString()
                          : ''}
                      </p>
                    </div>

                    {/* Strict NGO Delete Button (ONLY visible to authenticated NGO that owns the result) */}
                    {isOwnNgoResult(report) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(report);
                          setDeleteError('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:bg-red-600 hover:text-white hover:border-red-600 shadow-sm cursor-pointer shrink-0"
                        title="Delete this cleanup result"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* View More / Show Less Button */}
            {reports.length > INITIAL_REPORT_COUNT && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={handleToggleReports}
                  className="button-secondary inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold shadow-sm transition hover:shadow-md"
                  id="toggle-impact-reports-btn"
                >
                  {hasMore ? (
                    <>
                      <span>View More</span>
                      <ChevronDown size={16} />
                    </>
                  ) : (
                    <>
                      <span>Show Less</span>
                      <ChevronUp size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Strict Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="report-modal max-w-md p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-red-600">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="text-base font-extrabold text-ink">Delete Cleanup Result</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4">
              <p className="text-sm font-bold text-slate-800">
                Are you sure you want to delete this cleanup result?
              </p>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                This will permanently delete the Before &amp; After result for report{' '}
                <span className="font-mono font-bold text-forest">{deleteTarget.report_code}</span>.
              </p>

              {deleteError && (
                <div className="mt-3.5 p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl leading-relaxed">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="button-secondary px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="button-danger inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition cursor-pointer"
              >
                {deleting ? (
                  <>
                    <span className="spinner !h-3.5 !w-3.5 !border-white !border-t-transparent" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

