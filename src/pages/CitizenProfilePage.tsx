import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  Compass,
  Edit3,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DeleteAccountModal from '@/components/DeleteAccountModal';
import { useAuth } from '@/lib/auth';

interface FormErrors {
  name?: string;
  phone?: string;
  area?: string;
  locality?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export default function CitizenProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Form states initialized from authenticated user
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [area, setArea] = useState(user?.area || '');
  const [locality, setLocality] = useState(user?.locality || '');
  const [landmark, setLandmark] = useState(user?.landmark || '');
  const [street, setStreet] = useState(user?.street || '');
  const [district, setDistrict] = useState(user?.district || '');
  const [state, setState] = useState(user?.state || '');
  const [pincode, setPincode] = useState(user?.pincode || '');

  const [errors, setErrors] = useState<FormErrors>({});

  const startEditing = () => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setArea(user?.area || '');
    setLocality(user?.locality || '');
    setLandmark(user?.landmark || '');
    setStreet(user?.street || '');
    setDistrict(user?.district || '');
    setState(user?.state || '');
    setPincode(user?.pincode || '');
    setErrors({});
    setErrorMessage('');
    setEditing(true);
  };

  const cancelEditing = () => {
    // Discard unsaved changes and reset form to current user values
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setArea(user?.area || '');
    setLocality(user?.locality || '');
    setLandmark(user?.landmark || '');
    setStreet(user?.street || '');
    setDistrict(user?.district || '');
    setState(user?.state || '');
    setPincode(user?.pincode || '');
    setErrors({});
    setErrorMessage('');
    setEditing(false);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // 1. Full Name: required
    if (!name.trim()) {
      newErrors.name = 'Full Name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Full Name must be at least 2 characters.';
    }

    // 2. Mobile Number: required and valid format
    const cleanedPhone = phone.trim().replace(/[\s-]/g, '');
    if (!phone.trim()) {
      newErrors.phone = 'Mobile Number is required.';
    } else if (!/^(?:\+?91)?[6-9]\d{9}$/.test(cleanedPhone) && !/^\+?[0-9]{10,15}$/.test(cleanedPhone)) {
      newErrors.phone = 'Enter a valid 10-digit mobile number.';
    }

    // 3. Area: required
    if (!area.trim()) {
      newErrors.area = 'Area is required.';
    }

    // 4. Locality: required
    if (!locality.trim()) {
      newErrors.locality = 'Locality is required.';
    }

    // 5. District: required
    if (!district.trim()) {
      newErrors.district = 'District is required.';
    }

    // 6. State: required
    if (!state.trim()) {
      newErrors.state = 'State is required.';
    }

    // 7. PIN Code: required and valid Indian PIN format (6 digits, not starting with 0)
    const cleanedPin = pincode.trim();
    if (!cleanedPin) {
      newErrors.pincode = 'PIN Code is required.';
    } else if (!/^[1-9][0-9]{5}$/.test(cleanedPin)) {
      newErrors.pincode = 'Enter a valid 6-digit Indian PIN code (e.g. 411057).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validate()) {
      return;
    }

    setSaving(true);
    const result = await updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      area: area.trim(),
      locality: locality.trim(),
      landmark: landmark.trim() || undefined,
      street: street.trim() || undefined,
      district: district.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
    });
    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error || 'Failed to update profile. Please try again.');
      return;
    }

    setSuccessMessage('Profile updated successfully.');
    setEditing(false);

    // Clear toast message after 4 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setShowLogoutModal(false);
    navigate('/login');
  };

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;

  const displayLocation =
    user?.location ||
    [user?.area, user?.locality, user?.district, user?.state, user?.pincode].filter(Boolean).join(', ') ||
    'Address not configured';

  return (
    <DashboardLayout>
      <section className="page-shell py-10 sm:py-14">
        {/* Header Bar */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="section-kicker">
              <User size={15} /> Citizen Account
            </div>
            <h1 className="mt-4 section-title">Citizen Profile</h1>
            <p className="section-subtitle mt-3">
              View and manage your GeoClean citizen profile and personal address.
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              className="button-secondary"
              onClick={startEditing}
              id="edit-profile-btn"
            >
              <Edit3 size={16} /> Edit Profile
            </button>
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={cancelEditing}
              id="cancel-edit-top-btn"
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="toast" role="status" aria-live="polite">
            <CheckCircle2 className="text-forest shrink-0" size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Content Card */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left Column / Main Profile Card */}
          <div className="lg:col-span-8">
            {!editing ? (
              /* ================= VIEW PROFILE ================= */
              <div className="dash-card p-6 sm:p-8">
                {/* Profile Photo & Basic Identity */}
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                  <div className="relative">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || 'Citizen'}
                        className="h-20 w-20 rounded-2xl object-cover ring-4 ring-mint"
                      />
                    ) : (
                      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-forest text-2xl font-black text-white shadow-lg shadow-forest/20 ring-4 ring-mint">
                        {user?.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-extrabold tracking-tight text-ink">
                        {user?.name || 'Citizen User'}
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-bold text-forest">
                        <User size={13} /> Citizen
                      </span>
                    </div>
                    {formattedDate && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Calendar size={14} className="text-forest" />
                        <span>Member since {formattedDate}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="my-7 border-t border-slate-100" />

                {/* Account Details */}
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                  Account Information
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Email Address
                    </span>
                    <p className="mt-1 flex items-center gap-2 font-bold text-ink">
                      <Mail size={16} className="text-forest shrink-0" />
                      <span className="truncate">{user?.email || 'Not available'}</span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        <Lock size={10} /> Verified
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Mobile Number
                    </span>
                    <p className="mt-1 flex items-center gap-2 font-bold text-ink">
                      <Phone size={16} className="text-forest shrink-0" />
                      <span>{user?.phone || 'Not added'}</span>
                    </p>
                  </div>
                </div>

                <div className="my-7 border-t border-slate-100" />

                {/* Address & Location */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                    Location & Address Details
                  </h3>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Full Address
                  </span>
                  <p className="mt-1 flex items-start gap-2 text-sm font-bold text-ink">
                    <MapPin size={17} className="text-forest shrink-0 mt-0.5" />
                    <span>{displayLocation}</span>
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Area
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.area || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Locality
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.locality || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Landmark
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.landmark || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Street
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.street || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      District
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.district || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      State
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-ink">
                      {user?.state || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-mint/30 p-3.5 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      PIN Code
                    </span>
                    <p className="mt-1 text-xs font-extrabold text-forest font-mono">
                      {user?.pincode || '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={startEditing}
                  >
                    <Edit3 size={16} /> Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              /* ================= EDIT PROFILE ================= */
              <form
                onSubmit={handleSave}
                noValidate
                className="dash-card p-6 sm:p-8 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-ink">Edit Profile</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Update your account details and address information.
                    </p>
                  </div>
                  <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-forest">
                    Editing
                  </span>
                </div>

                {/* Profile Fields */}
                <div className="mt-6 space-y-5">
                  {/* Full Name */}
                  <div>
                    <label className="field-label !mt-0" htmlFor="profile-full-name">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="profile-full-name"
                        type="text"
                        className={`field-input ${errors.name ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        placeholder="e.g. Rahul Sharma"
                        required
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                        <AlertCircle size={13} /> {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Email (Read-only) & Mobile */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-email">
                        Email Address <span className="text-slate-400 font-normal">(Read-only)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="profile-email"
                          type="email"
                          className="field-input !bg-slate-100 !text-slate-600 cursor-not-allowed"
                          value={user?.email || ''}
                          disabled
                          readOnly
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Lock size={15} />
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Email is used for authentication identity and cannot be changed here.
                      </p>
                    </div>

                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-phone">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        className={`field-input ${errors.phone ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        placeholder="e.g. 9876543210"
                        required
                      />
                      {errors.phone && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="my-6 border-t border-slate-100" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                    Address Information
                  </h3>

                  {/* Area & Locality */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-area">
                        Area <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-area"
                        type="text"
                        className={`field-input ${errors.area ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={area}
                        onChange={(e) => {
                          setArea(e.target.value);
                          if (errors.area) setErrors((prev) => ({ ...prev, area: undefined }));
                        }}
                        placeholder="e.g. Kothrud / Wakad"
                        required
                      />
                      {errors.area && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.area}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-locality">
                        Locality <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-locality"
                        type="text"
                        className={`field-input ${errors.locality ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={locality}
                        onChange={(e) => {
                          setLocality(e.target.value);
                          if (errors.locality) setErrors((prev) => ({ ...prev, locality: undefined }));
                        }}
                        placeholder="e.g. Sector 2 / Near Metro Station"
                        required
                      />
                      {errors.locality && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.locality}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Landmark & Street */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-landmark">
                        Landmark <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="profile-landmark"
                        type="text"
                        className="field-input"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="e.g. Opposite City Hospital"
                      />
                    </div>

                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-street">
                        Street <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="profile-street"
                        type="text"
                        className="field-input"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="e.g. MG Road, 4th Cross"
                      />
                    </div>
                  </div>

                  {/* District, State, PIN Code */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-district">
                        District <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-district"
                        type="text"
                        className={`field-input ${errors.district ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={district}
                        onChange={(e) => {
                          setDistrict(e.target.value);
                          if (errors.district) setErrors((prev) => ({ ...prev, district: undefined }));
                        }}
                        placeholder="e.g. Pune"
                        required
                      />
                      {errors.district && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.district}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-state">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-state"
                        type="text"
                        className={`field-input ${errors.state ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={state}
                        onChange={(e) => {
                          setState(e.target.value);
                          if (errors.state) setErrors((prev) => ({ ...prev, state: undefined }));
                        }}
                        placeholder="e.g. Maharashtra"
                        required
                      />
                      {errors.state && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.state}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="field-label !mt-0" htmlFor="profile-pincode">
                        PIN Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="profile-pincode"
                        type="text"
                        maxLength={6}
                        className={`field-input font-mono ${errors.pincode ? '!border-red-500 ring-2 ring-red-100' : ''}`}
                        value={pincode}
                        onChange={(e) => {
                          setPincode(e.target.value);
                          if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: undefined }));
                        }}
                        placeholder="e.g. 411038"
                        required
                      />
                      {errors.pincode && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle size={13} /> {errors.pincode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={cancelEditing}
                    disabled={saving}
                    id="cancel-edit-btn"
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={saving}
                    id="save-profile-btn"
                  >
                    {saving ? (
                      <>
                        <span className="spinner" /> Saving Changes…
                      </>
                    ) : (
                      <>
                        <Save size={16} /> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column / Account Actions & Security */}
          <div className="space-y-6 lg:col-span-4">
            {/* Quick Summary Card */}
            <div className="dash-card p-6">
              <h3 className="text-base font-extrabold text-ink">Account Overview</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Account Type</span>
                  <span className="font-extrabold text-forest">Citizen</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Status</span>
                  <span className="font-extrabold text-forest">Active</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Reports Synchronization</span>
                  <span className="font-extrabold text-slate-700">Automatic</span>
                </div>
              </div>
            </div>

            {/* Separated Session & Logout Card */}
            <div className="dash-card border-red-100 p-6">
              <h3 className="text-base font-extrabold text-ink">Account Session</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Sign out of your active GeoClean citizen session securely.
              </p>

              <div className="my-4 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 hover:border-red-300"
                id="profile-logout-btn"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="mt-5 dash-card border-red-200 bg-red-50/30 p-6">
              <h3 className="text-base font-extrabold text-red-700">Danger Zone</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Permanently delete your citizen account, submitted reports, and personal profile data.
              </p>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 py-3 text-sm font-bold text-white shadow-md shadow-red-600/10 transition hover:bg-red-700"
                id="profile-delete-account-btn"
              >
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LOGOUT CONFIRMATION MODAL ================= */}
      {showLogoutModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div className="success-modal animate-fade-up">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600 mx-auto shadow-sm">
              <LogOut size={28} />
            </div>
            <h2 id="logout-dialog-title" className="mt-4 text-xl font-extrabold text-ink">
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
                id="cancel-logout-modal-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 px-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
                onClick={handleConfirmLogout}
                disabled={loggingOut}
                id="confirm-logout-modal-btn"
              >
                {loggingOut ? <span className="spinner !border-white !border-t-transparent" /> : <LogOut size={16} />}
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE ACCOUNT MODAL ================= */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </DashboardLayout>
  );
}
