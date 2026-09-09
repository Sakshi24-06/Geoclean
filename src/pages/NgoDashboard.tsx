import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Filter,
  History,
  Inbox,
  Layers,
  Leaf,
  LocateFixed,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DashboardLayout from '@/components/DashboardLayout';
import ReportDetailModal from '@/components/ngo/ReportDetailModal';
import { useAuth } from '@/lib/auth';
import {
  claimWasteReport,
  imageOf,
  loadAllTrackingReports,
  loadCurrentNgo,
  loadNgoReports,
  statusLabel,
  type DbReport,
  type NgoServiceArea,
  type TrackingReport,
  type TrackingStatus,
} from '@/lib/reportData';
import { supabase } from '@/utils/supabase';
import { formatRequestDate, formatRequestDateTime } from '@/utils/dateFormat';

type SectionId = 'new-requests' | 'assigned-work' | 'completed-work' | 'request-history';

const INITIAL_VISIBLE_COUNT = 4;

// Custom HTML pin markers for Leaflet map with GeoClean styling
function createStatusIcon(status: TrackingStatus, isSelected: boolean, isAssignedToMe: boolean) {
  let bgClass = 'bg-emerald-500 text-white';
  let borderColor = '#10B981';

  switch (status) {
    case 'unclaimed':
      bgClass = 'bg-emerald-500 text-white';
      borderColor = '#10B981';
      break;
    case 'claimed':
      bgClass = isAssignedToMe ? 'bg-amber-500 text-white' : 'bg-amber-500 text-white';
      borderColor = '#F59E0B';
      break;
    case 'in_progress':
      bgClass = isAssignedToMe ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white';
      borderColor = '#3B82F6';
      break;
    case 'resolved':
      bgClass = 'bg-slate-600 text-white';
      borderColor = '#64748B';
      break;
  }

  const selectedRing = isSelected ? 'scale-125 shadow-2xl ring-4 ring-offset-2 ring-forest z-50' : 'hover:scale-110';

  const html = `
    <div class="relative flex items-center justify-center transition-transform duration-200 cursor-pointer ${selectedRing}" style="width: 38px; height: 38px;">
      ${status === 'unclaimed' ? `<span class="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping" style="background-color: ${borderColor};"></span>` : ''}
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg border-2 border-white ${bgClass}">
        ${
          status === 'unclaimed'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
            : status === 'claimed'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3m15 0h2v-3.34a4 4 0 0 0-1.17-2.83L19 8h-5v9h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'
            : status === 'in_progress'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        }
      </div>
      <div class="absolute -bottom-1 w-2 h-2 rotate-45 border-r border-b border-white ${bgClass}"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-map-pin',
    html,
    iconSize: [38, 44],
    iconAnchor: [19, 44],
    popupAnchor: [0, -44],
  });
}

function LargeRequestRow({
  report,
  actionText,
  onClick,
}: {
  report: DbReport;
  actionText: string;
  onClick: () => void;
}) {
  const before = imageOf(report, 'before');
  const after = imageOf(report, 'after');
  const normStatus = report.status.replace('_', '-');

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col md:flex-row items-start md:items-stretch gap-4 md:gap-6 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-forest hover:shadow-md cursor-pointer w-full"
    >
      {/* Large Image on Left */}
      <div className="relative h-48 sm:h-52 md:h-auto md:w-60 lg:w-72 flex-shrink-0 w-full overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
        {after && before ? (
          <div className="grid grid-cols-2 h-full w-full">
            <div className="relative h-full w-full">
              <img src={before} alt="Before cleanup" className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                Before
              </span>
            </div>
            <div className="relative h-full w-full border-l border-white/50">
              <img src={after} alt="After cleanup" className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                After
              </span>
            </div>
          </div>
        ) : after || before ? (
          <img
            src={after || before}
            alt="Waste issue"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-300">
            <MapPin size={38} />
          </div>
        )}
      </div>

      {/* Middle Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 w-full">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-forest bg-forest/5 px-2.5 py-1 rounded-lg border border-forest/15">
                {report.report_code}
              </span>
              <span className={`report-status ${normStatus}`}>
                {statusLabel(report.status)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Calendar size={12} />
              {formatRequestDateTime(report.created_at)}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-ink group-hover:text-forest transition-colors">
            {report.waste_type}
          </h3>

          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
            <MapPin size={14} className="text-forest mt-0.5 flex-shrink-0" />
            <span className="font-medium">{report.address}</span>
          </p>

          {report.description && (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              "{report.description}"
            </p>
          )}

          {report.profiles?.full_name && (
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              <span>
                Reported by: <b className="text-slate-700">{report.profiles.full_name}</b>
              </span>
            </p>
          )}

          {report.resolved_at && (
            <p className="mt-1.5 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>
                Completed on {formatRequestDate(report.resolved_at)}
              </span>
            </p>
          )}
        </div>

        {/* Bottom Action Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-extrabold text-forest flex items-center gap-1 group-hover:underline">
            {actionText} <ArrowRight size={14} />
          </span>
          <span className="text-[11px] font-semibold text-slate-400">Click to view details</span>
        </div>
      </div>
    </div>
  );
}

export default function NgoDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DbReport[]>([]);
  const [trackingReports, setTrackingReports] = useState<TrackingReport[]>([]);
  const [ngo, setNgo] = useState<NgoServiceArea | null>(null);
  const [selected, setSelected] = useState<DbReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Active section in the Work Management area
  const [activeSection, setActiveSection] = useState<SectionId | null>('new-requests');

  // View More expansion state for Work Management
  const [showAllItems, setShowAllItems] = useState<Record<SectionId, boolean>>({
    'new-requests': false,
    'assigned-work': false,
    'completed-work': false,
    'request-history': false,
  });

  // Map & All Cleanup Requests state
  const [trackingFilter, setTrackingFilter] = useState<'all' | TrackingStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const handleCardClick = (id: SectionId) => {
    if (activeSection === id) {
      setActiveSection(null);
    } else {
      setActiveSection(id);
      const el = document.getElementById('work-management-list');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const handleViewMoreClick = (e: React.MouseEvent, id: SectionId) => {
    e.stopPropagation();
    setActiveSection(id);
    setShowAllItems((prev) => ({ ...prev, [id]: true }));
    const el = document.getElementById('work-management-list');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const toggleShowAll = (id: SectionId) => {
    setShowAllItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Main data loader
  const refresh = useCallback(async () => {
    try {
      const [serviceArea, rawReports, trackingRes] = await Promise.all([
        loadCurrentNgo(),
        loadNgoReports(),
        loadAllTrackingReports(user?.id),
      ]);
      setNgo(serviceArea);
      setReports(rawReports.filter((r) => !r.deleted));
      setTrackingReports(trackingRes.reports);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();

    const handleUpdate = () => void refresh();
    window.addEventListener('geoclean-reports-updated', handleUpdate);

    // Supabase Realtime synchronization
    const channelTopic = `ngo-dashboard-live-${Date.now()}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waste_reports' },
        () => {
          void refresh();
        }
      );

    channel.subscribe((status, err) => {
      if (err) console.warn('[NgoDashboard] Realtime notice:', status, err);
    });

    return () => {
      window.removeEventListener('geoclean-reports-updated', handleUpdate);
      try {
        void supabase.removeChannel(channel);
      } catch {}
    };
  }, [refresh]);

  const ngoName = user?.organization || user?.name || ngo?.ngo_name || 'Green Earth NGO';
  const ngoId = ngo?.id || user?.id || 'ngo-default';

  const ours = (report: DbReport) =>
    report.assigned_ngo_id === ngo?.id ||
    report.assigned_ngo_id === user?.id ||
    report.ngo_assignments?.some((a) => a.ngo_id === ngo?.id || a.ngo_id === user?.id);

  // 1. Available to accept
  const available = useMemo(
    () =>
      reports.filter(
        (report) =>
          !report.deleted &&
          !report.assigned_ngo_id &&
          (report.status === 'available' || report.status === 'released' || report.status === 'submitted')
      ),
    [reports]
  );

  // 2. Assigned to our organization & active
  const assigned = useMemo(
    () =>
      reports.filter(
        (report) =>
          !report.deleted &&
          ours(report) &&
          (report.status === 'assigned' || report.status === 'in_progress' || report.status === 'resolving')
      ),
    [reports, ngo?.id, user?.id]
  );

  // 3. Completed / Resolved by our organization
  const completed = useMemo(
    () =>
      reports.filter((report) => !report.deleted && report.status === 'resolved' && ours(report)),
    [reports, ngo?.id, user?.id]
  );

  // 4. Request History
  const history = useMemo(
    () =>
      reports.filter(
        (report) =>
          !report.deleted &&
          (ours(report) ||
            report.status === 'resolved' ||
            report.status === 'assigned' ||
            report.status === 'in_progress' ||
            report.status === 'resolving' ||
            report.status === 'released')
      ),
    [reports, ngo?.id, user?.id]
  );

  const inProgressCount = assigned.filter(
    (report) => report.status === 'in_progress' || report.status === 'resolving'
  ).length;

  const stats = [
    {
      label: 'Available Requests',
      value: available.length,
      icon: AlertTriangle,
      sectionId: 'new-requests' as SectionId,
    },
    {
      label: 'Assigned Reports',
      value: assigned.length,
      icon: Truck,
      sectionId: 'assigned-work' as SectionId,
    },
    {
      label: 'In Progress / Resolving',
      value: inProgressCount,
      icon: Clock3,
      sectionId: 'assigned-work' as SectionId,
    },
    {
      label: 'Resolved Cleanups',
      value: completed.length,
      icon: CheckCircle2,
      sectionId: 'completed-work' as SectionId,
    },
  ];

  const handleStatClick = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    const el = document.getElementById('work-management-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sections: {
    id: SectionId;
    title: string;
    description: string;
    caption: string;
    count: number;
    countLabel: string;
    items: DbReport[];
    actionText: string;
    icon: typeof Inbox;
    emptyMessage: string;
  }[] = [
    {
      id: 'new-requests',
      title: 'New Requests',
      description: 'Nearby waste reports available for your NGO to claim.',
      caption: `${available.length} requests available`,
      count: available.length,
      countLabel: 'available to claim',
      items: available,
      actionText: 'Available to claim',
      icon: Inbox,
      emptyMessage: 'No new requests available at this moment.',
    },
    {
      id: 'assigned-work',
      title: 'Assigned Work',
      description: 'Cleanup requests currently assigned to your NGO.',
      caption: `${assigned.length} active requests`,
      count: assigned.length,
      countLabel: 'active cleanups',
      items: assigned,
      actionText: 'Open Work',
      icon: Truck,
      emptyMessage: 'No work is currently assigned to your NGO.',
    },
    {
      id: 'completed-work',
      title: 'Completed Work',
      description: 'Cleanup requests successfully completed by your NGO.',
      caption: `${completed.length} completed`,
      count: completed.length,
      countLabel: 'resolved tasks',
      items: completed,
      actionText: 'View Completed Cleanup',
      icon: CheckCircle2,
      emptyMessage: 'No completed work recorded yet.',
    },
    {
      id: 'request-history',
      title: 'Request History',
      description: 'View the complete history of requests handled by your NGO.',
      caption: `${history.length} requests`,
      count: history.length,
      countLabel: 'total historical reports',
      items: history,
      actionText: 'View History Details',
      icon: History,
      emptyMessage: 'No request history available.',
    },
  ];

  const currentSectionData = sections.find((s) => s.id === activeSection);

  // Filtered Tracking Reports for Map and "All Cleanup Requests" list
  const filteredTrackingReports = useMemo(() => {
    return trackingReports.filter((r) => {
      const matchesStatus = trackingFilter === 'all' || r.trackingStatus === trackingFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        r.reportCode.toLowerCase().includes(query) ||
        r.wasteType.toLowerCase().includes(query) ||
        r.address.toLowerCase().includes(query) ||
        (r.workingNgoName && r.workingNgoName.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [trackingReports, trackingFilter, searchQuery]);

  // Selected Tracking Report
  const selectedTrackingReport = useMemo(() => {
    return trackingReports.find((r) => r.id === selectedTrackingId) || null;
  }, [trackingReports, selectedTrackingId]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = ngo?.latitude || 18.5204;
    const initialLng = ngo?.longitude || 73.8567;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ngo]);

  // Render Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markersMapRef.current.clear();

    filteredTrackingReports.forEach((report) => {
      const isSelected = report.id === selectedTrackingId;
      const icon = createStatusIcon(report.trackingStatus, isSelected, report.isAssignedToCurrentNgo);

      const marker = L.marker([report.latitude, report.longitude], {
        icon,
        title: `${report.reportCode} - ${report.wasteType}`,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const popupContent = `
        <div style="font-family: 'DM Sans', sans-serif; min-width: 210px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 13px; color: #12251d;">${report.reportCode}</span>
            <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 999px; text-transform: uppercase; ${
              report.trackingStatus === 'unclaimed'
                ? 'background: #d1fae5; color: #065f46;'
                : report.trackingStatus === 'claimed'
                ? 'background: #fef3c7; color: #92400e;'
                : report.trackingStatus === 'in_progress'
                ? 'background: #dbeafe; color: #1e40af;'
                : 'background: #f1f5f9; color: #475569;'
            }">
              ${report.status}
            </span>
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #0b7a43; margin-bottom: 4px;">${report.wasteType}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; line-height: 1.3;">📍 ${report.address}</div>
          <div style="font-size: 11px; font-weight: 600; color: #334155; padding-top: 5px; border-top: 1px solid #e2e8f0;">
            ${
              report.trackingStatus === 'unclaimed'
                ? '<span style="color: #059669; font-weight: 700;">🟢 Available to claim</span>'
                : `Working NGO: <strong>${report.workingNgoName || 'Partner NGO'}</strong>`
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { offset: [0, -32] });

      marker.on('click', () => {
        setSelectedTrackingId(report.id);
      });

      marker.addTo(markersGroup);
      markersMapRef.current.set(report.id, marker);
    });

    if (selectedTrackingReport && map) {
      map.flyTo([selectedTrackingReport.latitude, selectedTrackingReport.longitude], 15, { duration: 0.8 });
      const targetMarker = markersMapRef.current.get(selectedTrackingReport.id);
      if (targetMarker && !targetMarker.isPopupOpen()) {
        targetMarker.openPopup();
      }
    }
  }, [filteredTrackingReports, selectedTrackingReport, selectedTrackingId]);

  // Focus on map for a specific report
  const handleFocusReportOnMap = (report: TrackingReport) => {
    setSelectedTrackingId(report.id);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([report.latitude, report.longitude], 16, { duration: 1 });
      const targetMarker = markersMapRef.current.get(report.id);
      if (targetMarker) targetMarker.openPopup();

      const mapElem = document.getElementById('dashboard-map-section');
      if (mapElem) {
        mapElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleFitAllMapMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredTrackingReports.length === 0) return;
    const bounds = L.latLngBounds(filteredTrackingReports.map((r) => [r.latitude, r.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  };

  const handleLocateServiceBase = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (ngo?.latitude && ngo?.longitude) {
      map.flyTo([ngo.latitude, ngo.longitude], 14, { duration: 1 });
    } else {
      map.flyTo([18.5204, 73.8567], 14, { duration: 1 });
    }
  };

  // Concurrency-Safe Claim Handler
  const handleClaimTrackingReport = async (report: TrackingReport) => {
    setClaimFeedback(null);
    setClaimingId(report.id);

    try {
      await claimWasteReport(report.id, user?.id, ngoName);
      setClaimFeedback({
        type: 'success',
        message: `Successfully claimed request ${report.reportCode}! Added to your active Assigned Work.`,
      });
      await refresh();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to claim request. Please try again.';
      setClaimFeedback({
        type: 'error',
        message: msg,
      });
      await refresh();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <DashboardLayout>
      {/* 1. Header */}
      <section className="page-shell py-10">
        <div className="section-kicker">
          <Leaf size={15} /> NGO Dashboard
        </div>
        <h1 className="mt-4 section-title">Welcome, {ngoName}</h1>
        <p className="section-subtitle max-w-xl">
          Nearby requests, active cleanups, and completed impact work in your community.
        </p>
      </section>

      {/* 2. Statistics Cards */}
      <section className="page-shell pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => handleStatClick(stat.sectionId)}
                className="dash-stat-card group transition-all duration-200 hover:-translate-y-1 hover:border-forest hover:shadow-md cursor-pointer text-left block w-full"
              >
                <div className="flex items-center justify-between">
                  <span className="dash-stat-icon group-hover:bg-emerald-200 transition-colors">
                    <Icon size={20} />
                  </span>
                  <span className="text-[11px] font-bold text-forest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    View <ArrowRight size={12} />
                  </span>
                </div>
                <strong className="mt-2 text-2xl font-black text-ink block">{stat.value}</strong>
                <span className="text-xs font-semibold text-slate-500 block">{stat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Work Management Section */}
      <section id="work-management-section" className="page-shell pb-14 scroll-mt-20">
        <div className="mb-4">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Work Management</h2>
          <p className="text-xs text-slate-500">
            Quick access to your available, active, completed, and historical cleanup tasks.
          </p>
        </div>

        {error && (
          <div className="mb-6 auth-error text-sm p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200">
            Unable to load NGO requests: {error}
          </div>
        )}

        {/* Four Horizontal Category Cards in a single row on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <div
                key={section.id}
                onClick={() => handleCardClick(section.id)}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 cursor-pointer text-left ${
                  isActive
                    ? 'border-forest ring-2 ring-forest/20 shadow-md bg-emerald-50/20'
                    : 'border-slate-200/90 hover:border-forest/60 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${
                        isActive
                          ? 'bg-forest text-white'
                          : 'bg-emerald-50 text-forest border border-emerald-200/70 group-hover:bg-emerald-100/70'
                      }`}
                    >
                      <Icon size={22} />
                    </span>
                    <span
                      className={`font-mono text-xs font-black px-2.5 py-1 rounded-full ${
                        isActive
                          ? 'bg-forest text-white'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-forest'
                      }`}
                    >
                      {section.count}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-extrabold text-ink group-hover:text-forest transition-colors">
                    {section.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
                    {section.caption}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => handleViewMoreClick(e, section.id)}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-forest transition-all group-hover:translate-x-0.5"
                  >
                    <span>View More</span>
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <span className="text-[11px] font-semibold text-slate-400">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-forest font-bold">
                        <span>Active</span>
                        <ChevronUp size={14} />
                      </span>
                    ) : (
                      <ChevronDown size={14} className="text-slate-300 group-hover:text-forest" />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Request List Viewer for Selected Work Management Category */}
        <div id="work-management-list" className="mt-6 scroll-mt-24">
          {loading ? (
            <div className="dash-empty py-16 text-center dash-card bg-white">
              <span className="spinner !h-7 !w-7 mb-2 text-forest" />
              <p className="text-sm font-bold text-slate-500">Loading requests…</p>
            </div>
          ) : currentSectionData ? (
            <div className="dash-card overflow-hidden border border-slate-200 shadow-sm bg-white">
              <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-white flex-shrink-0">
                    <currentSectionData.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-extrabold text-ink">
                        {currentSectionData.title}
                      </h3>
                      <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-mono text-xs font-black text-forest">
                        {currentSectionData.count}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{currentSectionData.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSection(null)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors"
                  >
                    <X size={14} />
                    <span>Collapse</span>
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 bg-slate-50/30">
                {currentSectionData.items.length > 0 ? (
                  <div className="space-y-4">
                    {(() => {
                      const isShowingAll = showAllItems[currentSectionData.id];
                      const displayItems = isShowingAll
                        ? currentSectionData.items
                        : currentSectionData.items.slice(0, INITIAL_VISIBLE_COUNT);
                      const hasMore = currentSectionData.items.length > INITIAL_VISIBLE_COUNT;

                      return (
                        <>
                          {displayItems.map((report) => (
                            <LargeRequestRow
                              key={report.id}
                              report={report}
                              actionText={currentSectionData.actionText}
                              onClick={() => setSelected(report)}
                            />
                          ))}

                          {hasMore && (
                            <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
                              <span className="text-xs font-semibold text-slate-500">
                                Showing {displayItems.length} of {currentSectionData.items.length}{' '}
                                {currentSectionData.title.toLowerCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleShowAll(currentSectionData.id)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-forest/20 bg-white px-5 py-2 text-xs font-extrabold text-forest transition-all hover:bg-forest hover:text-white shadow-sm"
                              >
                                <span>
                                  {isShowingAll
                                    ? 'Show Less ↑'
                                    : `View More (${currentSectionData.items.length - INITIAL_VISIBLE_COUNT} more) →`}
                                </span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white p-6">
                    <currentSectionData.icon size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-500">{currentSectionData.emptyMessage}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="dash-card border border-dashed border-slate-200 bg-white/70 p-6 text-center text-xs text-slate-500">
              Select one of the 4 sections above to view requests.
            </div>
          )}
        </div>
      </section>

      {/* 4. Compact Two-Column Garbage Cleanup Request Tracking Section */}
      <section id="dashboard-map-section" className="page-shell pb-20 scroll-mt-20">
        {/* Section Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-extrabold text-forest">
                <Compass size={13} className="animate-spin" style={{ animationDuration: '20s' }} /> Live Operations
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Real-time Shared Tracking
              </span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
              Garbage Cleanup <span className="text-forest">Request Tracking</span>
            </h2>
            <p className="text-xs text-slate-500">
              Shared live tracking map & coordination panel. Click any map marker or list item to view real-time request details and working NGO assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleFitAllMapMarkers}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <Maximize2 size={13} />
              <span>Fit All Markers</span>
            </button>
            <button
              type="button"
              onClick={handleLocateServiceBase}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-forest hover:bg-mint/40 transition shadow-sm"
            >
              <LocateFixed size={13} />
              <span>My Base</span>
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
              title="Sync latest live requests"
            >
              <RefreshCw size={13} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {claimFeedback && (
          <div
            className={`mb-4 flex items-center justify-between rounded-2xl p-4 text-sm font-semibold animate-fade-in border shadow-sm ${
              claimFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {claimFeedback.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
              )}
              <span>{claimFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setClaimFeedback(null)}
              className="p-1 hover:opacity-75"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Compact Filters & Search Bar */}
        <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Request ID or Location..."
              className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Compact Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setTrackingFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                trackingFilter === 'all'
                  ? 'bg-forest text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({trackingReports.length})
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('unclaimed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                trackingFilter === 'unclaimed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Unclaimed ({trackingReports.filter((r) => r.trackingStatus === 'unclaimed').length})
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('claimed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                trackingFilter === 'claimed'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Claimed ({trackingReports.filter((r) => r.trackingStatus === 'claimed').length})
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('in_progress')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                trackingFilter === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              In Progress ({trackingReports.filter((r) => r.trackingStatus === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setTrackingFilter('resolved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                trackingFilter === 'resolved'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Resolved ({trackingReports.filter((r) => r.trackingStatus === 'resolved').length})
            </button>
          </div>
        </div>

        {/* Compact Two-Column Tracking Grid: Left (58%) Map | Right (42%) Request Details & List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Interactive Map (58% width on desktop) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[400px] sm:h-[480px] lg:h-[560px] relative">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Status Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] rounded-2xl bg-white/95 backdrop-blur-md p-2.5 border border-slate-200/80 shadow-lg text-[11px] font-bold space-y-1">
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Map Status Legend</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                  <span>🟢 Unclaimed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                  <span>🟡 Claimed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-200" />
                  <span>🔵 In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-500 ring-2 ring-slate-200" />
                  <span>⚪ Resolved</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Selected Request Details & Scrollable Request List (42% width on desktop) */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[480px] sm:h-[520px] lg:h-[560px]">
            {/* Right Panel Header */}
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-white flex-shrink-0">
                  <Layers size={14} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-ink truncate">
                    {selectedTrackingReport ? `Selected: ${selectedTrackingReport.reportCode}` : 'Request Tracking & List'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {filteredTrackingReports.length} {filteredTrackingReports.length === 1 ? 'request' : 'requests'} matching filter
                  </span>
                </div>
              </div>

              {selectedTrackingReport && (
                <button
                  type="button"
                  onClick={() => setSelectedTrackingId(null)}
                  className="text-[11px] font-bold text-forest hover:text-forest-dark bg-white border border-forest/20 hover:bg-forest/10 px-2.5 py-1 rounded-lg transition"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Right Panel Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {/* 1. Selected Request Details Card (Shown when a marker/item is selected) */}
              {selectedTrackingReport ? (
                <div className="rounded-2xl border border-forest/30 bg-white p-4 shadow-sm space-y-3 ring-2 ring-forest/10 animate-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-forest bg-forest/10 px-2.5 py-1 rounded-lg border border-forest/20">
                        {selectedTrackingReport.reportCode}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${selectedTrackingReport.statusBadgeClass}`}>
                        {selectedTrackingReport.status}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Calendar size={12} />
                      {formatRequestDate(selectedTrackingReport.createdAt)}
                    </span>
                  </div>

                  {/* Photo & Title row */}
                  <div className="flex gap-3 items-center">
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                      {selectedTrackingReport.photo ? (
                        <img
                          src={selectedTrackingReport.photo}
                          alt={selectedTrackingReport.wasteType}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-slate-300">
                          <MapPin size={22} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-extrabold text-ink leading-snug">
                        {selectedTrackingReport.wasteType}
                      </h4>
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
                        <MapPin size={13} className="text-forest mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{selectedTrackingReport.address}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status & Responsible NGO Info Box */}
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">Current Status:</span>
                      <span className="font-extrabold text-ink">
                        {selectedTrackingReport.trackingStatus === 'unclaimed' && '🟢 Unclaimed (Available)'}
                        {selectedTrackingReport.trackingStatus === 'claimed' && '🟡 Claimed / Assigned'}
                        {selectedTrackingReport.trackingStatus === 'in_progress' && '🔵 In Progress'}
                        {selectedTrackingReport.trackingStatus === 'resolved' && '⚪ Resolved'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-semibold text-[11px]">Working NGO:</span>
                      <span className="font-extrabold text-ink">
                        {selectedTrackingReport.trackingStatus === 'unclaimed' ? (
                          <span className="text-emerald-600">None — Available to claim</span>
                        ) : (
                          selectedTrackingReport.workingNgoName || 'Partner NGO'
                        )}
                      </span>
                    </div>

                    {selectedTrackingReport.rawReport.description && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60 line-clamp-2">
                        "{selectedTrackingReport.rawReport.description}"
                      </p>
                    )}
                  </div>

                  {/* Claim Protection & Action Buttons */}
                  <div className="pt-2 flex flex-col gap-2">
                    {selectedTrackingReport.trackingStatus === 'unclaimed' ? (
                      <button
                        type="button"
                        onClick={() => handleClaimTrackingReport(selectedTrackingReport)}
                        disabled={claimingId === selectedTrackingReport.id}
                        className="button-primary w-full text-xs py-2.5 justify-center shadow-sm"
                        id={`selected-claim-btn-${selectedTrackingReport.reportCode}`}
                      >
                        {claimingId === selectedTrackingReport.id ? 'Claiming Request…' : 'Claim Request'}
                      </button>
                    ) : selectedTrackingReport.isAssignedToCurrentNgo ? (
                      <div className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>Assigned to your NGO. You are managing this cleanup.</span>
                      </div>
                    ) : (
                      <div className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200 font-semibold">
                        This request is already being handled by <strong>{selectedTrackingReport.workingNgoName || 'another NGO'}</strong>.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelected(selectedTrackingReport.rawReport)}
                      className="button-secondary w-full text-xs py-2 justify-center flex items-center gap-1"
                    >
                      <span>View Full Details & Timeline</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Prompt when no request is selected */
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500 space-y-1">
                  <MapPin size={22} className="mx-auto text-slate-400" />
                  <p className="font-bold text-slate-700">Select a request on the map or list</p>
                  <p className="text-[11px] text-slate-400">Click any marker or item below to view full details and NGO assignments.</p>
                </div>
              )}

              {/* 2. Scrollable Compact Request List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    {selectedTrackingReport ? 'All Other Requests' : 'All Cleanup Requests'} ({filteredTrackingReports.length})
                  </span>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <span className="spinner mx-auto !h-5 !w-5" />
                    <p className="text-[11px] font-bold">Loading live requests…</p>
                  </div>
                ) : filteredTrackingReports.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 space-y-1">
                    <Filter size={24} className="mx-auto text-slate-300" />
                    <p className="font-bold text-xs text-slate-700">No requests found</p>
                    <p className="text-[11px] text-slate-400">Try changing the status filter or search keyword.</p>
                  </div>
                ) : (
                  filteredTrackingReports.map((report) => {
                    const isSelected = report.id === selectedTrackingId;
                    return (
                      <div
                        key={report.id}
                        onClick={() => handleFocusReportOnMap(report)}
                        className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'border-forest bg-mint/30 shadow-sm ring-1 ring-forest/30'
                            : 'border-slate-200/80 bg-white hover:border-forest/50 hover:bg-slate-50/70 shadow-xs'
                        }`}
                      >
                        {/* Thumbnail & Core Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                            {report.photo ? (
                              <img src={report.photo} alt={report.wasteType} className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-slate-300">
                                <MapPin size={14} />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-ink">{report.reportCode}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-extrabold ${report.statusBadgeClass}`}>
                                {report.status}
                              </span>
                              {report.trackingStatus === 'unclaimed' && (
                                <span className="rounded bg-emerald-500 text-white px-1.5 py-0.2 text-[8px] font-extrabold">
                                  AVAIL
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] font-bold text-forest truncate">{report.wasteType}</p>
                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                              <MapPin size={10} className="text-slate-400 shrink-0" />
                              <span>{report.address}</span>
                            </p>
                          </div>
                        </div>

                        {/* Right side info / action */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {formatRequestDate(report.createdAt)}
                          </span>

                          <span className="text-[10px] font-extrabold">
                            {report.trackingStatus === 'unclaimed' ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                🟢 Available
                              </span>
                            ) : (
                              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[110px] block">
                                {report.workingNgoName || 'Other NGO'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Selected Report Detail Modal */}
      {selected && (
        <ReportDetailModal
          report={selected}
          ours={ours(selected)}
          ngoName={ngoName}
          ngoId={ngoId}
          onClose={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </DashboardLayout>
  );
}
