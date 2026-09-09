import { useEffect, useState } from 'react';
import { Building2, Crosshair, Edit3, Globe2, MapPin, Phone, Save, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import { useAuth } from '@/lib/auth';
import { loadCurrentNgo, saveCurrentNgoLocation, type NgoServiceArea } from '@/lib/reportData';

export default function NgoProfilePage() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.organization || user?.name || '');
  const [location, setLocation] = useState(user?.location || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [description, setDescription] = useState(user?.description || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [services, setServices] = useState(user?.services || '');
  const [serviceArea, setServiceArea] = useState<NgoServiceArea | null>(null);
  const [detected, setDetected] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationState, setLocationState] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadServiceArea = async () => {
    try {
      setServiceArea(await loadCurrentNgo());
    } catch (error) {
      setLocationState(error instanceof Error ? error.message : 'Unable to load your saved service location.');
    }
  };

  useEffect(() => {
    void loadServiceArea();
  }, []);

  const save = async () => {
    if (!name.trim() || !location.trim()) return;
    const result = await updateProfile({
      name: name.trim(),
      organization: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      description: description.trim(),
      website: website.trim(),
      services: services.trim(),
    });
    if (result.ok) setEditing(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('Location services are not supported by this browser.');
      return;
    }
    setDetecting(true);
    setLocationState('Detecting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetected({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState('Location detected');
        setDetecting(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Please allow location access in your browser.'
            : error.code === error.POSITION_UNAVAILABLE
            ? 'Unable to detect your location. Please try again.'
            : error.code === error.TIMEOUT
            ? 'Location request timed out. Please try again.'
            : 'Unable to detect your location. Please try again.';
        setLocationState(message);
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const saveLocation = async () => {
    if (!detected) {
      setLocationState('Use Current Location before saving.');
      return;
    }
    setSavingLocation(true);
    setLocationState('Saving...');
    try {
      const updated = await saveCurrentNgoLocation(detected.latitude, detected.longitude);
      setServiceArea(updated);
      setDetected(null);
      setLocationState('Location saved successfully');
    } catch (error) {
      setLocationState(error instanceof Error ? error.message : 'Database update error: unable to save location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const shownLatitude = detected?.latitude ?? serviceArea?.latitude;
  const shownLongitude = detected?.longitude ?? serviceArea?.longitude;

  return (
    <DashboardLayout>
      <section className="page-shell py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="section-kicker">
              <Building2 size={15} /> Organization account
            </div>
            <h1 className="mt-4 section-title">NGO Profile</h1>
            <p className="section-subtitle mt-3">
              Keep your organization and service area ready for local cleanup coordination.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Cancel' : <><Edit3 size={16} /> Edit Profile</>}
          </button>
        </div>

        <div className="profile-card mt-9">
          <div className="ngo-logo">
            <Building2 size={31} />
          </div>
          {editing ? (
            <div className="profile-form">
              <label className="field-label" htmlFor="ngo-profile-name">NGO name</label>
              <input
                id="ngo-profile-name"
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label className="field-label" htmlFor="ngo-profile-location">Location / service area</label>
              <input
                id="ngo-profile-location"
                className="field-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <label className="field-label" htmlFor="ngo-profile-phone">Contact phone</label>
              <input
                id="ngo-profile-phone"
                className="field-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <label className="field-label" htmlFor="ngo-profile-description">Description</label>
              <textarea
                id="ngo-profile-description"
                className="field-input min-h-[100px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <label className="field-label" htmlFor="ngo-profile-website">Website</label>
              <input
                id="ngo-profile-website"
                className="field-input"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              <label className="field-label" htmlFor="ngo-profile-services">Services</label>
              <input
                id="ngo-profile-services"
                className="field-input"
                value={services}
                onChange={(e) => setServices(e.target.value)}
              />

              <button
                type="button"
                onClick={() => void save()}
                className="button-primary mt-7"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          ) : (
            <>
              <h2>{user?.organization || user?.name}</h2>
              <p className="ngo-modal-copy">
                {user?.description ||
                  'Authorized GeoClean cleanup partner. Profile details are visible only within the authenticated NGO workspace.'}
              </p>
              <div className="profile-details">
                <p><MapPin size={17} /> {user?.location || 'Location not added'}</p>
                <p><Phone size={17} /> {user?.phone || 'Contact number not added'}</p>
                <p><Globe2 size={17} /> {user?.website || user?.email}</p>
                {user?.services && <p>Services: {user.services}</p>}
              </div>
            </>
          )}
        </div>

        {/* Service Location Card */}
        <section className="dash-card mt-7 p-6 max-w-[680px]">
          <div className="section-kicker">
            <MapPin size={15} /> Service location
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-ink">Service Location</h2>
          <p className="mt-2 text-sm text-slate-500">
            Saved location: {serviceArea?.address || user?.location || 'Not available'}
          </p>
          <div className="map-preview mt-5">
            <div className="map-grid" />
            <MapPin className="relative z-10 text-forest" size={31} fill="currentColor" />
            <span className="relative z-10 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-forest shadow">
              {shownLatitude !== null && shownLatitude !== undefined ? 'Service location' : 'No coordinates saved'}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-mint/50 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Latitude</span>
              <p className="mt-1 font-extrabold text-ink">{shownLatitude ?? 'Not saved'}</p>
            </div>
            <div className="rounded-xl bg-mint/50 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Longitude</span>
              <p className="mt-1 font-extrabold text-ink">{shownLongitude ?? 'Not saved'}</p>
            </div>
          </div>
          {locationState && (
            <p
              className={`mt-4 text-sm font-semibold ${
                locationState.includes('success') || locationState === 'Location detected'
                  ? 'text-forest'
                  : locationState === 'Detecting location...' || locationState === 'Saving...'
                  ? 'text-slate-500'
                  : 'text-red-600'
              }`}
            >
              {locationState}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="button-secondary"
              disabled={detecting || savingLocation}
              onClick={detectLocation}
            >
              <Crosshair size={16} /> {detecting ? 'Detecting location...' : 'Use Current Location'}
            </button>
            <button
              type="button"
              className="button-primary"
              disabled={!detected || detecting || savingLocation}
              onClick={() => void saveLocation()}
            >
              <Save size={16} /> {savingLocation ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </section>

        {/* Danger Zone: Delete Account */}
        <section className="dash-card mt-7 border-red-200 bg-red-50/30 p-6 max-w-[680px]">
          <h3 className="text-base font-extrabold text-red-700">Danger Zone</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Permanently delete your NGO account, organization directory listing, and cleanup partner profile.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/10 transition hover:bg-red-700"
              id="ngo-delete-account-btn"
            >
              <Trash2 size={16} /> Delete Account
            </button>
          </div>
        </section>
      </section>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </DashboardLayout>
  );
}
