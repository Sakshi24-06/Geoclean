import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  Home,
  Leaf,
  LogOut,
  Menu,
  MapPin,
  Recycle,
  RefreshCw,
  Route,
  Shield,
  Sparkles,
  Truck,
  User,
  Users,
  X,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import DeleteAccountModal from '@/components/DeleteAccountModal';
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

type NavItem = { label: string; to: string; icon: typeof Home };

const citizenNav: NavItem[] = [
  { label: 'Home', to: '/user', icon: Home },
  { label: 'Impact', to: '/impact', icon: BarChart3 },
  { label: 'How It Works', to: '/how-it-works', icon: Route },
  { label: 'NGO Directory', to: '/ngos', icon: Users },
  { label: 'About Us', to: '/about', icon: Leaf },
  { label: 'My Reports', to: '/my-reports', icon: ClipboardList },
];

const ngoNav: NavItem[] = [
  { label: 'Dashboard', to: '/ngo', icon: Home },
  { label: 'Impact', to: '/impact', icon: BarChart3 },
  { label: 'NGO Directory', to: '/ngos', icon: Users },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: Home },
  { label: 'Reports', to: '/admin/reports', icon: ClipboardList },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Impact', to: '/impact', icon: BarChart3 },
  { label: 'NGO Directory', to: '/ngos', icon: Users },
  { label: 'Notifications', to: '/notifications', icon: Bell },
];

function NotificationIconBadge({ type }: { type: NotificationType }) {
  switch (type) {
    case 'REPORT_SUBMITTED':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
          <CheckCircle2 size={15} />
        </span>
      );
    case 'REPORT_ASSIGNED':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">
          <Truck size={15} />
        </span>
      );
    case 'REPORT_IN_PROGRESS':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-50 text-purple-600 border border-purple-200 shadow-sm">
          <RefreshCw size={15} className="animate-spin" style={{ animationDuration: '6s' }} />
        </span>
      );
    case 'REPORT_RESOLVING':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm">
          <Sparkles size={15} />
        </span>
      );
    case 'REPORT_RESOLVED':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/20">
          <Check size={15} strokeWidth={3} />
        </span>
      );
    case 'REPORT_DELETED':
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 border border-red-200 shadow-sm">
          <AlertTriangle size={15} />
        </span>
      );
    case 'COMMUNITY_UPDATE':
    default:
      return (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-forest border border-mint shadow-sm">
          <Leaf size={15} />
        </span>
      );
  }
}

export default function DashboardLayout({ children, onReport }: { children: ReactNode; onReport?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Load dynamic notices for the authenticated user
  const loadNotices = useCallback(async () => {
    if (!user?.id) return;
    if (user.role === 'ngo') {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('id, title, message, read, created_at, report_id, type, report_code')
          .order('created_at', { ascending: false })
          .limit(25);
        if (data) {
          setNotices(
            data.map((n) => ({
              id: n.id,
              userId: user.id,
              title: n.title,
              detail: n.message,
              time: new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
              createdAt: n.created_at,
              read: Boolean(n.read),
              icon: 'truck',
              type: (n.type as NotificationType) || 'REPORT_ASSIGNED',
              reportId: n.report_id || undefined,
              reportCode: n.report_code || n.report_id || undefined,
            }))
          );
        }
      } catch {}
    } else {
      // Citizen notifications
      const fetched = await fetchCitizenNotifications(user.id);
      setNotices(fetched);
    }
  }, [user?.id, user?.role]);

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

  const unread = notices.filter((n) => !n.read && !n.is_read).length;
  const grouped = groupNoticesBySection(notices);

  useEffect(() => {
    if (!notifOpen && !profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifOpen && bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen, profileOpen]);

  const nav = user?.role === 'admin' ? adminNav : user?.role === 'ngo' ? ngoNav : citizenNav;
  const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'ngo' ? 'NGO' : 'Citizen';
  const roleIcon = user?.role === 'admin' ? Shield : user?.role === 'ngo' ? Leaf : User;

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setShowLogoutModal(false);
    navigate('/login');
  };

  const handleNotificationClick = async (notice: Notice) => {
    const isUnread = !notice.read && !notice.is_read;
    if (isUnread && user?.id) {
      setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, read: true, is_read: true } : n)));
      void markNotificationRead(notice.id, user.id);
    }
    setNotifOpen(false);

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
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setNotices((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
    await markAllNotificationsRead(user.id);
  };

  const renderNoticeItem = (n: Notice) => {
    const isRead = Boolean(n.read || n.is_read);
    return (
      <button
        type="button"
        key={n.id}
        onClick={() => void handleNotificationClick(n)}
        className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
          isRead ? 'opacity-70 hover:bg-slate-50' : 'bg-emerald-50/40 hover:bg-emerald-50/80'
        }`}
      >
        <NotificationIconBadge type={n.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`block text-xs font-bold leading-snug ${isRead ? 'text-slate-700' : 'text-ink'}`}>
              {n.title}
            </span>
            {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-forest shadow-sm" />}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2">{n.detail}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-400">{n.time}</span>
            {(n.reportCode || n.reportId) && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                {n.reportCode || n.reportId}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
        <div className="page-shell flex h-[72px] items-center justify-between gap-4">
          <Link to={user?.role === 'admin' ? '/admin' : user?.role === 'ngo' ? '/ngo' : '/user'} className="flex items-center gap-3">
           <span className="grid h-10 w-10 place-items-center rounded-2xl bg-forest shadow-lg shadow-forest/20 overflow-hidden">
  <img
    src="/geoclean-icon.png"
    alt="GeoClean"
    className="h-8 w-8 object-contain"
  />
</span>
            <span className="hidden sm:block">
              <span className="block text-[17px] font-extrabold leading-none tracking-tight text-ink">Geo<span className="text-forest">Clean</span></span>
              <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500">Clean City. Green Future.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Dashboard navigation">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{item.label}</NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Notification Bell with Dynamic Unread Badge */}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="icon-button relative"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                id="notification-bell-btn"
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="notification-badge animate-scale-in" id="notification-badge-count">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="notification-panel animate-fade-down" style={{ width: 360, maxWidth: 'calc(100vw - 24px)', right: 0 }}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-ink text-sm">Notifications</p>
                      {unread > 0 && (
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-bold text-forest">
                          {unread} new
                        </span>
                      )}
                    </div>
                    {unread > 0 ? (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-forest hover:underline"
                        id="mark-all-read-dropdown-btn"
                      >
                        Mark all as read
                      </button>
                    ) : (
                      <button type="button" onClick={() => setNotifOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                        Close
                      </button>
                    )}
                  </div>

                  <div className="max-h-[380px] overflow-y-auto p-2 space-y-3 divide-y divide-slate-100">
                    {notices.length === 0 ? (
                      <div className="py-8 text-center px-4">
                        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-mint text-forest mb-2">
                          <Bell size={18} />
                        </div>
                        <p className="text-xs font-bold text-ink">No notifications yet</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Updates regarding your waste reports and community cleanup activities will appear here.
                        </p>
                      </div>
                    ) : (
                      <>
                        {grouped.today.length > 0 && (
                          <div className="pt-1 first:pt-0">
                            <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Today
                            </p>
                            <div className="space-y-1">
                              {grouped.today.map(renderNoticeItem)}
                            </div>
                          </div>
                        )}

                        {grouped.yesterday.length > 0 && (
                          <div className="pt-2">
                            <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Yesterday
                            </p>
                            <div className="space-y-1">
                              {grouped.yesterday.map(renderNoticeItem)}
                            </div>
                          </div>
                        )}

                        {grouped.earlier.length > 0 && (
                          <div className="pt-2">
                            <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Earlier
                            </p>
                            <div className="space-y-1">
                              {grouped.earlier.map(renderNoticeItem)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <Link
                    to="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-bold text-forest transition hover:bg-mint/30"
                    id="view-notification-center-link"
                  >
                    View notification center →
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Dropdown Trigger */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 transition hover:bg-mint/40"
                aria-label="Profile menu"
                aria-expanded={profileOpen}
                id="navbar-profile-trigger"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-xs font-bold text-white shadow-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <span className="hidden text-xs font-bold text-ink sm:block max-w-[120px] truncate">
                  {user?.name?.split(' ')[0]}
                </span>
              </button>
              {profileOpen && (
                <div className="notification-panel" style={{ minWidth: 230, maxWidth: 'calc(100vw - 32px)', right: 0 }}>
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-sm font-extrabold text-white shadow-sm shadow-forest/20">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-ink truncate text-sm">{user?.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-forest">
                        {(() => { const Icon = roleIcon; return <Icon size={10} />; })()} {roleLabel}
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      to={user?.role === 'ngo' ? '/ngo/profile' : '/profile'}
                      onClick={() => setProfileOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-mint/60 hover:text-forest"
                      id="menu-item-profile"
                    >
                      <User size={15} className="text-forest" /> Profile
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setShowLogoutModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      id="menu-item-logout"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setShowDeleteModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 transition hover:bg-red-50"
                      id="menu-item-delete-account"
                    >
                      <Trash2 size={15} /> Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>

            {onReport && (
              <button type="button" onClick={onReport} className="button-primary hidden sm:inline-flex"><MapPin size={16} /> Report Waste</button>
            )}
            <button type="button" onClick={() => setMenuOpen((o) => !o)} className="icon-button lg:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden">
            <nav className="page-shell flex flex-col gap-1" aria-label="Mobile navigation">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-forest text-white' : 'text-slate-700 hover:bg-mint/60 hover:text-forest'}`}>
                  {item.label}
                </NavLink>
              ))}
              <div className="my-2 border-t border-slate-100" />
              <Link
                to={user?.role === 'ngo' ? '/ngo/profile' : '/profile'}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-mint/60 hover:text-forest"
              >
                <User size={16} className="text-forest" /> Profile
              </Link>
              {onReport && (
                <button type="button" onClick={() => { setMenuOpen(false); onReport(); }} className="button-primary mt-2 justify-center"><MapPin size={16} /> Report Waste</button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowLogoutModal(true);
                }}
                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> Logout
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowDeleteModal(true);
                }}
                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} /> Delete Account
              </button>
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>

      {/* Logout Confirmation Dialog */}
      {showLogoutModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="navbar-logout-dialog-title"
        >
          <div className="success-modal animate-fade-up">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600 mx-auto shadow-sm">
              <LogOut size={28} />
            </div>
            <h2 id="navbar-logout-dialog-title" className="mt-4 text-xl font-extrabold text-ink">
              Logout?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to log out of your GeoClean account?
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                className="button-secondary flex-1"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
                onClick={handleConfirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? <span className="spinner !border-white !border-t-transparent" /> : <LogOut size={16} />}
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Dialog */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
