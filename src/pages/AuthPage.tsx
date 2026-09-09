import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Leaf,
  Lock,
  Mail,
  MapPin,
  Phone,
  Recycle,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePlatformStats, formatStatCount } from '@/lib/platformStats';
import type { Role } from '@/lib/types';

type Mode = 'role' | 'login' | 'signup' | 'forgot';

type FloatingInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  icon: typeof Mail;
  trailing?: ReactNode;
};

function FloatingInput({ id, label, icon: Icon, trailing, className = '', ...props }: FloatingInputProps) {
  return (
    <div className="input-wrap floating-field">
      <Icon size={17} className="input-icon" />
      <input id={id} {...props} placeholder=" " className={`field-input ${trailing ? 'has-trailing' : ''} ${className}`} />
      <label className="floating-label" htmlFor={id}>{label}</label>
      {trailing}
    </div>
  );
}

export default function AuthPage() {
  const { login, signup, requestPasswordReset } = useAuth();
  const { citizens, resolved, ngos, loading: statsLoading } = usePlatformStats();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Registration form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [orgId, setOrgId] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const reset = () => {
    setError('');
    setSuccessMsg('');
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setConfirmPassword('');
    setOrganization('');
    setContactPerson('');
    setOrgId('');
    setLocation('');
    setLatitude('');
    setLongitude('');
  };

  const selectRole = (r: Role) => {
    setRole(r);
    setMode('login');
    reset();
  };

  const backToRoles = () => {
    setMode('role');
    setRole(null);
    reset();
  };

  const redirectTo = (r: Role) => {
    if (r === 'admin') navigate('/admin');
    else if (r === 'ngo') navigate('/ngo');
    else navigate('/user');
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!role) return;
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    const result = await login(email.trim(), password, role);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Login failed.');
      return;
    }
    redirectTo(role);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!role) return;
    if (role === 'admin') {
      setError('Admin accounts cannot be self-registered.');
      return;
    }

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (role === 'ngo') {
      if (!organization.trim()) return setError('Please enter your organization name.');
      if (!contactPerson.trim()) return setError('Please enter a contact person.');
      if (!cleanPhone || !/^\+?[0-9\s-]{10,15}$/.test(cleanPhone)) {
        return setError('Please enter a valid official mobile number.');
      }
      if (!location.trim()) return setError('Please enter your NGO location.');
    } else {
      if (!name.trim()) return setError('Please enter your full name.');
      if (cleanPhone && !/^\+?[0-9\s-]{10,15}$/.test(cleanPhone)) {
        return setError('Please enter a valid mobile number.');
      }
    }

    if (!password) return setError('Please enter a password.');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const payload =
      role === 'ngo'
        ? {
            name: organization.trim(),
            email: cleanEmail,
            password,
            phone: cleanPhone,
            organization: organization.trim(),
            contactPerson: contactPerson.trim(),
            orgId: orgId.trim() || undefined,
            location: location.trim(),
            latitude: latitude.trim() ? Number(latitude) : undefined,
            longitude: longitude.trim() ? Number(longitude) : undefined,
          }
        : {
            name: name.trim(),
            email: cleanEmail,
            password,
            phone: cleanPhone || undefined,
          };

    setSubmitting(true);
    const result = await signup(payload, role);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Registration failed.');
      return;
    }

    redirectTo(role);
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email.trim()) {
      setError('Enter your email address to reset your password.');
      return;
    }
    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (result.ok) {
      setSuccessMsg('If an account exists, a password-reset link has been sent to your email.');
    } else {
      setError(result.error || 'Unable to send a password reset email.');
    }
  };

  const roleCards: { role: Extract<Role, 'user' | 'ngo'>; icon: typeof User; title: string; desc: string }[] = [
    { role: 'user', icon: User, title: 'Citizen / User', desc: 'Report waste and track cleanup in your area.' },
    { role: 'ngo', icon: Leaf, title: 'NGO', desc: 'Manage cleanups and update report statuses.' },
  ];

  return (
    <div className="auth-page">
      <div className="auth-bg-glow one" />
      <div className="auth-bg-glow two" />
      <div className="auth-card">
        <div className="auth-brand">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-white shadow-lg shadow-forest/20">
            <Recycle size={26} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-[19px] font-extrabold tracking-tight text-ink">
              Geo<span className="text-forest">Clean</span>
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Clean City. Green Future.
            </p>
          </div>
        </div>

        {mode === 'role' && (
          <div className="animate-fade-in">
            <h1 className="auth-title">Welcome to GeoClean</h1>
            <p className="auth-subtitle">Choose your role to continue.</p>
            <div className="role-grid">
              {roleCards.map(({ role: r, icon: Icon, title, desc }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => selectRole(r)}
                  className="role-card"
                >
                  <span className="role-icon">
                    <Icon size={24} />
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-ink">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                  </div>
                  <ArrowRight size={18} className="role-arrow" />
                </button>
              ))}
            </div>
            <p className="auth-footer">
              By continuing you agree to GeoClean's Terms & Privacy Policy.
            </p>
          </div>
        )}

        {mode === 'login' && role && (
          <form onSubmit={handleLogin} className="animate-fade-in">
            <button type="button" onClick={backToRoles} className="back-link">
              <ArrowLeft size={15} /> Back to roles
            </button>
            <h1 className="auth-title">
              {role === 'admin' ? 'Admin Portal' : role === 'ngo' ? 'NGO / Organization Login' : 'Welcome Back'}
            </h1>
            <p className="auth-subtitle">
              {role === 'admin'
                ? 'Sign in to the admin control center.'
                : role === 'ngo'
                  ? 'Sign in to your organization account.'
                  : 'Sign in to your GeoClean account.'}
            </p>

            <FloatingInput
              id="login-email"
              label={role === 'admin' ? 'Admin Email' : role === 'ngo' ? 'Organization Email' : 'Email'}
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <FloatingInput
              id="login-password"
              label="Password"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />

            {role !== 'admin' && (
              <div className="forgot-row">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setError('');
                    setSuccessMsg('');
                    setMode('forgot');
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}
            {successMsg && <p className="auth-success">{successMsg}</p>}

            <div className="auth-action-group">
              <button type="submit" className="button-primary w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : role === 'admin' ? 'Admin Login' : 'Login'}
              </button>
            </div>

            {role !== 'admin' && (
              <p className="auth-switch">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setMode('signup');
                  }}
                  className="switch-link"
                >
                  {role === 'ngo' ? 'Register Your NGO' : 'Create Account'}
                </button>
              </p>
            )}

            {role === 'admin' && (
              <div className="admin-hint">
                <Shield size={14} /> Demo credentials: admin@geoclean.in / admin123
              </div>
            )}
          </form>
        )}

        {mode === 'forgot' && role && (
          <form onSubmit={handleForgotPassword} className="animate-fade-in">
            <button
              type="button"
              onClick={() => {
                setError('');
                setSuccessMsg('');
                setMode('login');
              }}
              className="back-link"
            >
              <ArrowLeft size={15} /> Back to login
            </button>
            <h1 className="auth-title">Reset your password</h1>
            <p className="auth-subtitle">Enter your account email and we will send one reset link.</p>
            <FloatingInput
              id="reset-email"
              label="Email"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <p className="auth-error">{error}</p>}
            {successMsg && <p className="auth-success">{successMsg}</p>}
            <div className="auth-action-group">
              <button type="submit" className="button-primary w-full" disabled={submitting}>
                {submitting ? 'Sending reset link…' : 'Send reset link'}
              </button>
            </div>
          </form>
        )}

        {/* Registration Form */}
        {mode === 'signup' && role && (
          <form onSubmit={handleSignup} className="animate-fade-in">
            <button type="button" onClick={backToRoles} className="back-link">
              <ArrowLeft size={15} /> Back to roles
            </button>
            <h1 className="auth-title">
              {role === 'ngo' ? 'Register Your NGO' : 'Create Your GeoClean Account'}
            </h1>
            <p className="auth-subtitle">
              {role === 'ngo'
                ? 'Join GeoClean as an organization partner.'
                : 'Join thousands of citizens making a difference.'}
            </p>

            {role === 'ngo' ? (
              <>
                <FloatingInput
                  id="org-name"
                  label="NGO / Organization Name"
                  icon={Building2}
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  required
                />
                <FloatingInput
                  id="org-email"
                  label="Official Email"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <FloatingInput
                  id="org-contact"
                  label="Contact Person"
                  icon={User}
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  required
                />
                <FloatingInput
                  id="org-phone"
                  label="Mobile Number"
                  icon={Phone}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                <FloatingInput
                  id="org-id"
                  label={<>Registration / Organization ID <span>(optional)</span></>}
                  icon={Building2}
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                />
                <FloatingInput
                  id="org-location"
                  label="Location / City / Area"
                  icon={MapPin}
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput
                    id="org-latitude"
                    label="Latitude (optional)"
                    icon={MapPin}
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                  <FloatingInput
                    id="org-longitude"
                    label="Longitude (optional)"
                    icon={MapPin}
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <FloatingInput
                  id="su-name"
                  label="Full Name"
                  icon={User}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <FloatingInput
                  id="su-email"
                  label="Email"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <FloatingInput
                  id="su-phone"
                  label={<>Mobile Number <span>(optional)</span></>}
                  icon={Phone}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </>
            )}

            <FloatingInput
              id="su-password"
              label="Password"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />
            <FloatingInput
              id="su-confirm"
              label="Confirm Password"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && <p className="auth-error">{error}</p>}
            {successMsg && <p className="auth-success">{successMsg}</p>}

            <div className="auth-action-group">
              <button type="submit" className="button-primary w-full" disabled={submitting}>
                {submitting ? (role === 'ngo' ? 'Registering NGO…' : 'Creating Account…') : role === 'ngo' ? 'Register NGO' : 'Create Account'}
              </button>
            </div>

            <p className="auth-switch">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  reset();
                  setMode('login');
                }}
                className="switch-link"
              >
                Login
              </button>
            </p>
          </form>
        )}
      </div>
      <div className="auth-side">
        <div className="auth-side-content">
          <span className="auth-side-icon"><Leaf size={28} /></span>
          <h2 className="auth-side-title">Together for a Cleaner, Greener Tomorrow</h2>
          <p className="auth-side-text">Report waste, track cleanup, and build healthier communities — one report at a time.</p>
          <div className="auth-side-stats">
            <div>
              <b>{formatStatCount(citizens, statsLoading)}</b>
              <span>Citizens</span>
            </div>
            <div>
              <b>{formatStatCount(resolved, statsLoading)}</b>
              <span>Resolved</span>
            </div>
            <div>
              <b>{formatStatCount(ngos, statsLoading)}</b>
              <span>NGOs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
