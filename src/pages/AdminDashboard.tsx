import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Leaf,
  MapPin,
  Recycle,
  Trash2,
  Truck,
  Users,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { STORAGE_KEYS, type Report } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePlatformStats, formatStatCount } from '@/lib/platformStats';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { citizens: realCitizens, ngos: realNgos, resolved: realResolved } = usePlatformStats();
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<'overview' | 'reports' | 'users'>('overview');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.reports);
      const list = raw ? (JSON.parse(raw) as Report[]) : [];
      setReports(list.filter((r) => !r.deleted));
    } catch {
      setReports([]);
    }
  }, []);

  const updateStatus = (id: string, status: Report['status']) => {
    const updated = reports.map((r) => (r.id === id ? { ...r, status } : r));
    setReports(updated);
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
  };

  const deleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
  };

  const activeReports = reports.filter((r) => !r.deleted);
  const pending = activeReports.filter((r) => r.status === 'Submitted' || r.status === 'Available').length;
  const inProgress = activeReports.filter((r) => r.status === 'In Progress' || r.status === 'Assigned' || r.status === 'Resolving').length;
  const resolved = realResolved > 0 ? realResolved : activeReports.filter((r) => r.status === 'Resolved').length;

  const stats = [
    { label: 'Total Reports', value: reports.length, icon: AlertTriangle },
    { label: 'Pending', value: pending, icon: Clock3 },
    { label: 'In Progress', value: inProgress, icon: Truck },
    { label: 'Resolved', value: formatStatCount(resolved), icon: CheckCircle2 },
    { label: 'Registered NGOs', value: formatStatCount(realNgos), icon: Leaf },
    { label: 'Registered Citizens', value: formatStatCount(realCitizens), icon: Users },
    { label: 'Cleanliness Score', value: '72%', icon: BarChart3 },
  ];

  return (
    <DashboardLayout>
      <section className="page-shell py-10">
        <div className="section-kicker"><BarChart3 size={15} /> Admin Portal</div>
        <h1 className="mt-4 section-title">Welcome, {user?.name}</h1>
        <p className="section-subtitle max-w-xl">Oversee the entire GeoClean platform — reports, users, NGOs, and analytics.</p>
      </section>

      <section className="page-shell pb-6">
        <div className="flex gap-1.5">
          {(['overview', 'reports', 'users'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`dash-filter ${tab === t ? 'active' : ''}`}>
              {t === 'overview' ? 'Overview' : t === 'reports' ? 'Reports' : 'Users & NGOs'}
            </button>
          ))}
        </div>
      </section>

      {tab === 'overview' && (
        <section className="page-shell pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="dash-stat-card">
                  <span className="dash-stat-icon"><Icon size={20} /></span>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="dash-card">
              <h2 className="border-b border-slate-100 px-6 py-5 text-lg font-extrabold tracking-tight text-ink">Recent Reports</h2>
              <div className="p-4">
                {reports.length === 0 ? (
                  <div className="dash-empty"><AlertTriangle size={28} /><p>No reports submitted yet.</p></div>
                ) : (
                  <div className="space-y-3">
                    {reports.slice(0, 5).map((r) => (
                      <div key={r.id} className="report-row compact">
                        <div className="flex-1 min-w-0">
                          <span className="report-row-id">{r.id}</span>
                          <span className={`report-status ${r.status.toLowerCase().replace(' ', '-')}`}>{r.status}</span>
                          <p className="mt-1 text-sm font-bold text-ink">{r.issueType}</p>
                          <p className="truncate text-xs text-slate-500">{r.location}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="dash-card">
              <h2 className="border-b border-slate-100 px-6 py-5 text-lg font-extrabold tracking-tight text-ink">Platform Distribution</h2>
              <div className="p-6">
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm font-bold"><span className="text-ink">Resolved</span><span className="text-forest">{resolved} / {reports.length || 0}</span></div>
                    <div className="admin-bar-track"><div className="admin-bar-fill bg-forest" style={{ width: `${reports.length ? (resolved / reports.length) * 100 : 0}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold"><span className="text-ink">In Progress</span><span className="text-amber-500">{inProgress}</span></div>
                    <div className="admin-bar-track"><div className="admin-bar-fill bg-amber-400" style={{ width: `${reports.length ? (inProgress / reports.length) * 100 : 0}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold"><span className="text-ink">Pending</span><span className="text-slate-400">{pending}</span></div>
                    <div className="admin-bar-track"><div className="admin-bar-fill bg-slate-300" style={{ width: `${reports.length ? (pending / reports.length) * 100 : 0}%` }} /></div>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-3">
                  <div className="admin-mini-stat"><Users size={18} /><b>{formatStatCount(realCitizens)}</b><span>Citizens</span></div>
                  <div className="admin-mini-stat"><Leaf size={18} /><b>{formatStatCount(realNgos)}</b><span>NGOs</span></div>
                  <div className="admin-mini-stat"><Truck size={18} /><b>{formatStatCount(realResolved)}</b><span>Resolved</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section className="page-shell pb-20">
          <div className="dash-card">
            <h2 className="border-b border-slate-100 px-6 py-5 text-lg font-extrabold tracking-tight text-ink">Reports Management</h2>
            <div className="p-4">
              {reports.length === 0 ? (
                <div className="dash-empty"><AlertTriangle size={28} /><p>No reports to manage.</p></div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div key={r.id} className="report-row">
                      <div className="report-row-photo">
                        {r.photo ? <img src={r.photo} alt={r.issueType} /> : <MapPin size={22} className="text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="report-row-id">{r.id}</span>
                          <span className={`report-status ${r.status.toLowerCase().replace(' ', '-')}`}>{r.status}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-ink">{r.issueType}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{r.location}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.status === 'Submitted' && <button onClick={() => updateStatus(r.id, 'In Progress')} className="dash-action-btn">Start</button>}
                        {r.status === 'In Progress' && <button onClick={() => updateStatus(r.id, 'Resolved')} className="dash-action-btn resolve">Resolve</button>}
                        {r.status === 'Resolved' && <button onClick={() => updateStatus(r.id, 'Submitted')} className="dash-action-btn">Reopen</button>}
                        <button onClick={() => deleteReport(r.id)} className="dash-action-btn danger" aria-label="Delete report"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'users' && (
        <section className="page-shell pb-20">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="dash-card">
              <h2 className="border-b border-slate-100 px-6 py-5 text-lg font-extrabold tracking-tight text-ink">Active Citizens</h2>
              <div className="p-4">
                <div className="space-y-3">
                  {[
                    { name: 'Aarav Mehta', email: 'aarav@example.com', reports: 24 },
                    { name: 'Riya Sharma', email: 'riya@example.com', reports: 18 },
                    { name: 'Nikhil Kumar', email: 'nikhil@example.com', reports: 12 },
                    { name: 'Jaya Patel', email: 'jaya@example.com', reports: 9 },
                  ].map((u) => (
                    <div key={u.email} className="user-row">
                      <span className="user-avatar">{u.name[0]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink">{u.name}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                      <span className="text-xs font-bold text-forest">{u.reports} reports</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="dash-card">
              <h2 className="border-b border-slate-100 px-6 py-5 text-lg font-extrabold tracking-tight text-ink">Active NGOs Partners</h2>
              <div className="p-4">
                <div className="space-y-3">
                  {[
                    { name: 'Green Earth Foundation', email: 'org@greenearth.org', resolved: 142 },
                    { name: 'Clean City Initiative', email: 'org@cleancity.org', resolved: 98 },
                    { name: 'Eco Warriors', email: 'org@ecowarriors.org', resolved: 67 },
                  ].map((u) => (
                    <div key={u.email} className="user-row">
                      <span className="user-avatar"><Leaf size={16} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink">{u.name}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                      <span className="text-xs font-bold text-forest">{u.resolved} resolved</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}
