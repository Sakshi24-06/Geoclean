import { useEffect, useMemo, useState } from 'react';
import { Building2, ExternalLink, Leaf, Loader2, Mail, MapPin, Phone, RefreshCw, Search, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchNgoDirectory, subscribeNgoDirectory } from '@/lib/ngoService';
import type { NgoDirectoryItem } from '@/lib/types';

const CATEGORIES = [
  'All',
  'Waste Management',
  'Recycling',
  'Environment',
  'Cleanliness',
  'Community Cleanup',
];

export default function NgoDirectoryPage() {
  const [organizations, setOrganizations] = useState<NgoDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<NgoDirectoryItem | null>(null);

  const loadNgos = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchNgoDirectory();
      setOrganizations(items);
    } catch (err) {
      console.error('Failed to load NGOs directory:', err);
      setError('Unable to load organizations from the database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNgos();
    const unsubscribe = subscribeNgoDirectory(() => {
      void fetchNgoDirectory().then((items) => {
        setOrganizations(items);
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return organizations.filter((ngo) => {
      const matchesCategory =
        category === 'All' ||
        ngo.categories.some(
          (c) =>
            c.toLowerCase().includes(category.toLowerCase()) ||
            category.toLowerCase().includes(c.toLowerCase())
        );

      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        ngo.name,
        ngo.location,
        ngo.categories.join(' '),
        ngo.description,
        ngo.activities,
        ngo.phone || '',
        ngo.email || '',
        ngo.website || '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [organizations, query, category]);

  const clearFilters = () => {
    setQuery('');
    setCategory('All');
  };

  return (
    <DashboardLayout>
      <section className="directory-hero">
        <div className="page-shell py-14 sm:py-18">
          <div className="section-kicker">
            <Leaf size={15} /> Registered organizations
          </div>
          <h1 className="mt-4 section-title max-w-3xl">
            Pune Environmental &amp; Waste Management Organizations
          </h1>
          <p className="section-subtitle mt-4 max-w-2xl">
            Explore registered organizations working toward cleaner communities and a healthier environment in Pune.
          </p>
        </div>
      </section>

      <section className="page-shell py-10 sm:py-14">
        <div className="directory-toolbar">
          <div className="directory-search">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search registered NGOs in Pune by name, area, or service..."
              aria-label="Search NGOs in Pune"
            />
          </div>
          <div className="directory-filters" aria-label="NGO categories">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={category === item ? 'active' : ''}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-500">
            {loading ? (
              'Loading organizations…'
            ) : (
              `${results.length} organization${results.length === 1 ? '' : 's'} found`
            )}
          </p>
          <button
            type="button"
            onClick={() => void loadNgos()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-forest transition hover:underline"
            title="Refresh NGO directory"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && organizations.length === 0 ? (
          <div className="my-12 flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-500">
            <Loader2 size={36} className="animate-spin text-forest" />
            <p className="text-sm font-medium">Fetching registered NGO records from database…</p>
          </div>
        ) : error && organizations.length === 0 ? (
          <div className="directory-empty my-8 p-8">
            <Search size={30} className="text-red-500" />
            <h2 className="text-red-700">{error}</h2>
            <button type="button" className="button-primary mt-5" onClick={() => void loadNgos()}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : organizations.length === 0 ? (
          <div className="directory-empty mt-6">
            <Building2 size={36} className="text-forest" />
            <h2>No registered organizations yet</h2>
            <p>NGOs and environmental groups that register on GeoClean will appear here automatically.</p>
          </div>
        ) : results.length > 0 ? (
          <div className="ngo-grid mt-6">
            {results.map((ngo) => (
              <article key={ngo.id || ngo.name} className="ngo-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="ngo-logo" aria-hidden="true">
                    <Leaf size={31} />
                  </div>
                  <span className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-forest">
                    Partner
                  </span>
                </div>
                <h2>{ngo.name}</h2>
                <p>{ngo.description}</p>
                <div className="ngo-meta">
                  <span>
                    <MapPin size={14} /> {ngo.location}
                  </span>
                  {ngo.categories[0] && <span>{ngo.categories[0]}</span>}
                  {ngo.phone && (
                    <span title={ngo.phone}>
                      <Phone size={12} /> {ngo.phone}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="button-secondary mt-5 w-full justify-center"
                  onClick={() => setSelected(ngo)}
                >
                  View Details
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="directory-empty mt-6">
            <Search size={30} />
            <h2>No organizations found</h2>
            <p>Try searching for a different keyword or select another category filter.</p>
            <button type="button" className="button-secondary mt-5" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ngo-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="ngo-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close organization details"
            >
              <X size={20} />
            </button>
            <div className="ngo-logo">
              <Leaf size={31} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-forest">
              {selected.source || 'Registered GeoClean Partner'}
            </p>
            <h2 id="ngo-modal-title">{selected.name}</h2>
            <p className="ngo-modal-copy">{selected.description}</p>

            <div className="ngo-detail-row">
              <MapPin size={17} />
              <span>{selected.location}</span>
            </div>

            {selected.phone && (
              <div className="ngo-detail-row !mt-2">
                <Phone size={17} />
                <a href={`tel:${selected.phone}`} className="text-forest hover:underline">
                  {selected.phone}
                </a>
              </div>
            )}

            {selected.email && (
              <div className="ngo-detail-row !mt-2">
                <Mail size={17} />
                <a href={`mailto:${selected.email}`} className="text-forest hover:underline">
                  {selected.email}
                </a>
              </div>
            )}

            <div className="ngo-tags">
              {selected.categories.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <h3>Areas of work</h3>
            <p className="ngo-modal-copy">{selected.activities}</p>

            {selected.website ? (
              <a
                href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="button-primary mt-6 inline-flex"
              >
                <ExternalLink size={17} /> Visit Website
              </a>
            ) : selected.phone ? (
              <a href={`tel:${selected.phone}`} className="button-primary mt-6 inline-flex">
                <Phone size={17} /> Call Organization
              </a>
            ) : selected.email ? (
              <a href={`mailto:${selected.email}`} className="button-primary mt-6 inline-flex">
                <Mail size={17} /> Email Organization
              </a>
            ) : (
              <button
                type="button"
                className="button-secondary mt-6"
                onClick={() => setSelected(null)}
              >
                Close Details
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
