import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Leaf,
  MapPin,
  RefreshCw,
  Sparkles,
  Truck,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/auth';
import type { Notice, NotificationType } from '@/lib/types';
import {
  fetchCitizenNotifications,
  groupNoticesBySection,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToRealtimeNotifications,
} from '@/lib/notificationService';
import { supabase } from '@/utils/supabase';

function NotificationTypeBadge({ type }: { type: NotificationType }) {
  switch (type) {
    case 'REPORT_SUBMITTED':
      return <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold">Report Submitted</span>;
    case 'REPORT_ASSIGNED':
      return <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[11px] font-bold">Cleanup Assigned</span>;
    case 'REPORT_IN_PROGRESS':
      return <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[11px] font-bold">In Progress</span>;
    case 'REPORT_RESOLVING':
      return <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-[11px] font-bold">Being Completed</span>;
    case 'REPORT_RESOLVED':
      return <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-bold">Issue Resolved</span>;
    case 'REPORT_DELETED':
      return <span className="rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-[11px] font-bold">Report Deleted</span>;
    case 'COMMUNITY_UPDATE':
    default:
      return <span className="rounded-full bg-mint text-forest px-2.5 py-0.5 text-[11px] font-bold">Community Update</span>;
  }
}

function NoticeIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case 'REPORT_SUBMITTED':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
          <CheckCircle2 size={20} />
        </span>
      );
    case 'REPORT_ASSIGNED':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">
          <Truck size={20} />
        </span>
      );
    case 'REPORT_IN_PROGRESS':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 shadow-sm">
          <RefreshCw size={20} />
        </span>
      );
    case 'REPORT_RESOLVING':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm">
          <Sparkles size={20} />
        </span>
      );
    case 'REPORT_RESOLVED':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
          <Check size={20} strokeWidth={3} />
        </span>
      );
    case 'REPORT_DELETED':
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 border border-red-200 shadow-sm">
          <AlertTriangle size={20} />
        </span>
      );
    case 'COMMUNITY_UPDATE':
    default:
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-mint text-forest border border-mint shadow-sm">
          <Leaf size={20} />
        </span>
      );
  }
}

type TabType = 'all' | 'unread' | 'reports' | 'community';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadNotices = useCallback(async () => {
    if (!user?.id) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (user.role === 'ngo') {
        const { data, error: dbErr } = await supabase
          .from('notifications')
          .select('id, title, message, read, created_at, report_id, type, report_code')
          .order('created_at', { ascending: false })
          .limit(50);

        if (dbErr) throw dbErr;

        if (data) {
          setNotices(
            data.map((n) => ({
              id: n.id,
              userId: user.id,
              title: n.title || 'Notification',
              detail: n.message || '',
              time: new Date(n.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
              createdAt: n.created_at || new Date().toISOString(),
              read: Boolean(n.read),
              icon: 'truck',
              type: (n.type as NotificationType) || 'REPORT_ASSIGNED',
              reportId: n.report_id || undefined,
              reportCode: n.report_code || n.report_id || undefined,
            }))
          );
        }
      } else {
        const list = await fetchCitizenNotifications(user.id);
        setNotices(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : 'Unable to load notifications. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, authLoading]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  // Real-time synchronization
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToRealtimeNotifications(user.id, () => {
      void loadNotices();
    });
    return () => unsubscribe();
  }, [user?.id, loadNotices]);

  const unreadCount = useMemo(() => notices.filter((n) => !n.read && !n.is_read).length, [notices]);

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const isUnread = !n.read && !n.is_read;
      if (activeTab === 'unread') return isUnread;
      if (activeTab === 'reports') return n.type !== 'COMMUNITY_UPDATE';
      if (activeTab === 'community') return n.type === 'COMMUNITY_UPDATE';
      return true;
    });
  }, [notices, activeTab]);

  const grouped = useMemo(() => groupNoticesBySection(filteredNotices), [filteredNotices]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleMarkRead = async (id: string) => {
    if (!user?.id) return;
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, read: true, is_read: true } : n)));
    const res = await markNotificationRead(id, user.id);
    if (!res.ok) {
      showToast('Could not sync read status to server.');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setNotices((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
    const res = await markAllNotificationsRead(user.id);
    if (!res.ok) {
      showToast('Could not sync mark-all-read to server.');
    }
  };

  const handleOpenReport = async (notice: Notice) => {
    const isUnread = !notice.read && !notice.is_read;
    if (isUnread && user?.id) {
      void handleMarkRead(notice.id);
    }

    if (notice.type === 'REPORT_DELETED') {
      showToast('This report was deleted and is no longer available.');
      return;
    }

    const code = notice.reportCode || notice.reportId;
    if (code) {
      if (user?.role === 'ngo') {
        navigate('/ngo');
      } else if (user?.role === 'admin') {
        navigate('/admin/reports');
      } else {
        navigate(`/my-reports?reportId=${encodeURIComponent(code)}`);
      }
    } else if (notice.type === 'COMMUNITY_UPDATE') {
      navigate('/impact');
    }
  };

  const renderNoticeCard = (notice: Notice) => {
    const hasReport = Boolean(notice.reportCode || notice.reportId);
    const isRead = Boolean(notice.read || notice.is_read);

    return (
      <article
        key={notice.id}
        className={`relative flex flex-col sm:flex-row items-start gap-4 rounded-2xl border p-5 transition-all shadow-sm ${
          isRead
            ? 'border-slate-200/80 bg-white opacity-90 hover:opacity-100 hover:border-slate-300'
            : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 ring-1 ring-emerald-300/40'
        }`}
      >
        <NoticeIcon type={notice.type} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold text-ink">{notice.title}</h2>
            <NotificationTypeBadge type={notice.type} />
            {(notice.reportCode || notice.reportId) && (
              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                Report ID: {notice.reportCode || notice.reportId}
              </span>
            )}
            {!isRead && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                New
              </span>
            )}
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-700">{notice.detail}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-slate-400" /> {notice.time}
            </span>
            {notice.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-forest" /> {notice.location}
              </span>
            )}
            {notice.ngoName && (
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Truck size={12} className="text-forest" /> NGO: {notice.ngoName}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full sm:w-auto items-center justify-end gap-2 pt-2 sm:pt-0">
          {hasReport && notice.type !== 'REPORT_DELETED' && (
            <button
              type="button"
              onClick={() => void handleOpenReport(notice)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-forest shadow-sm transition hover:bg-mint/40"
            >
              <span>{notice.type === 'REPORT_RESOLVED' ? 'View Resolution' : 'View Report'}</span>
              <ExternalLink size={12} />
            </button>
          )}

          {notice.type === 'COMMUNITY_UPDATE' && (
            <button
              type="button"
              onClick={() => void handleOpenReport(notice)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-forest shadow-sm transition hover:bg-mint/40"
            >
              <span>View Impact</span>
              <ExternalLink size={12} />
            </button>
          )}

          {!isRead && (
            <button
              type="button"
              onClick={() => void handleMarkRead(notice.id)}
              className="rounded-xl bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest transition hover:bg-forest hover:text-white"
            >
              Mark as read
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <DashboardLayout>
      <section className="page-shell py-8 sm:py-12">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/my-reports"
            className="inline-flex items-center gap-2 text-xs font-bold text-forest hover:underline transition"
            id="back-to-my-reports-link"
          >
            <ArrowLeft size={14} /> Back to My Reports
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200/80 pb-6">
          <div>
            <div className="section-kicker">
              <Bell size={15} /> Activity Center
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Notification Center
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-xl">
              Stay updated on your reported waste issues and community activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="button-secondary"
              disabled={unreadCount === 0}
              onClick={handleMarkAllRead}
              id="mark-all-read-page-btn"
            >
              <Check size={16} /> Mark all as read
            </button>
          </div>
        </div>

        {/* Filter Tabs & Counter */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'all' ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id="tab-all-notifications"
            >
              All ({notices.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'unread' ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              id="tab-unread-notifications"
            >
              Unread
              {unreadCount > 0 && (
                <span className="rounded-full bg-lime px-1.5 py-0.2 text-[10px] text-forest font-extrabold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'reports' ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Reports
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('community')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'community' ? 'bg-forest text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Community
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Showing {filteredNotices.length} notification{filteredNotices.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Notification Feed Body */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center shadow-sm">
              <span className="spinner mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50/50 p-12 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-red-100 text-red-600 mb-3">
                <AlertTriangle size={26} />
              </div>
              <h3 className="text-base font-extrabold text-ink">Unable to load notifications. Please try again.</h3>
              <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void loadNotices()}
                className="button-primary mt-4 text-xs py-2 px-4 inline-flex items-center gap-2"
                id="retry-notifications-btn"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-14 text-center shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-mint text-forest mb-4 shadow-sm shadow-forest/10">
                <Bell size={28} />
              </div>
              <h3 className="text-lg font-extrabold text-ink">No notifications yet</h3>
              <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Updates about your reports and community activity will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.today.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Today
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {grouped.today.map(renderNoticeCard)}
                  </div>
                </div>
              )}

              {grouped.yesterday.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Yesterday
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {grouped.yesterday.map(renderNoticeCard)}
                  </div>
                </div>
              )}

              {grouped.earlier.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Earlier
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {grouped.earlier.map(renderNoticeCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Toast Message */}
        {toastMessage && (
          <div className="toast animate-toast-in">
            <AlertTriangle size={16} className="text-amber-600" />
            <span>{toastMessage}</span>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export { NotificationsPage as NotificationCenter };
