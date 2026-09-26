import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/utils/supabase';
import { STORAGE_KEYS, type AuthUser, type Role } from './types';
import { createNotification } from './notificationService';

type SignupData = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  organization?: string;
  contactPerson?: string;
  orgId?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  website?: string;
  services?: string;
};

type AuthResult = { ok: boolean; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, role: Role) => Promise<AuthResult>;
  signup: (data: SignupData, role: Role) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updateProfile: (patch: Partial<AuthUser>) => Promise<AuthResult>;
  deleteAccount: () => Promise<AuthResult>;
  logout: () => Promise<void>;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string | null;
  role: Role;
  created_at: string;
  area?: string | null;
  locality?: string | null;
  landmark?: string | null;
  street?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  ngos?: {
    ngo_name: string;
    address: string;
    description: string | null;
    website: string | null;
    services: string | null;
  }[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

function asUser(profile: ProfileRow, userMetadata?: Record<string, unknown>): AuthUser {
  const ngo = profile.ngos?.[0];
  const meta = userMetadata || {};

  const area = profile.area || (meta.area as string) || undefined;
  const locality = profile.locality || (meta.locality as string) || undefined;
  const landmark = profile.landmark || (meta.landmark as string) || undefined;
  const street = profile.street || (meta.street as string) || undefined;
  const district = profile.district || (meta.district as string) || undefined;
  const state = profile.state || (meta.state as string) || undefined;
  const pincode = profile.pincode || (meta.pincode as string) || undefined;
  const avatarUrl = profile.avatar_url || (meta.avatar_url as string) || (meta.picture as string) || undefined;

  const fallbackAddressParts = [area, locality, district, state, pincode].filter(Boolean);
  const derivedLocation = ngo?.address || profile.address || (meta.address as string) || (fallbackAddressParts.length > 0 ? fallbackAddressParts.join(', ') : undefined);

  return {
    id: profile.id,
    role: profile.role,
    name: profile.full_name || (meta.full_name as string) || profile.email,
    email: profile.email,
    phone: profile.mobile_number || (meta.mobile_number as string) || undefined,
    organization: ngo?.ngo_name,
    location: derivedLocation,
    area,
    locality,
    landmark,
    street,
    district,
    state,
    pincode,
    avatarUrl,
    description: ngo?.description || undefined,
    website: ngo?.website || undefined,
    services: ngo?.services || undefined,
    createdAt: profile.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (id: string) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setUser(null);
      return;
    }

    const userMetadata = authData.user.user_metadata;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, mobile_number, role, created_at, ngos(ngo_name, address, description, website, services)')
      .eq('id', id)
      .single();

    if (error || !data) {
      if (authData?.user) {
        const meta = userMetadata || {};
        const area = (meta.area as string) || undefined;
        const locality = (meta.locality as string) || undefined;
        const landmark = (meta.landmark as string) || undefined;
        const street = (meta.street as string) || undefined;
        const district = (meta.district as string) || undefined;
        const state = (meta.state as string) || undefined;
        const pincode = (meta.pincode as string) || undefined;
        const addrParts = [area, locality, district, state, pincode].filter(Boolean);

        setUser({
          id: authData.user.id,
          role: (meta.role as Role) || 'user',
          name: (meta.full_name as string) || authData.user.email || 'Citizen',
          email: authData.user.email || '',
          phone: (meta.mobile_number as string) || undefined,
          area,
          locality,
          landmark,
          street,
          district,
          state,
          pincode,
          avatarUrl: (meta.avatar_url as string) || undefined,
          location: (meta.address as string) || (addrParts.length > 0 ? addrParts.join(', ') : undefined),
          createdAt: authData.user.created_at,
        });
        return;
      }
      setUser(null);
      return;
    }

    setUser(asUser(data as ProfileRow, userMetadata));
  }, []);

  useEffect(() => {
    let active = true;
    const hydrate = async (id: string) => {
      if (!active) return;
      setLoading(true);
      await loadProfile(id);
      if (active) setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        return hydrate(data.session.user.id);
      }
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void hydrate(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Login calls signInWithPassword and hydrates profile immediately
  // Login calls signInWithPassword, verifies profile, auto-heals if needed, and sets user
  const login = useCallback(
    async (email: string, password: string, expectedRole: Role): Promise<AuthResult> => {
      const cleanEmail = email.trim();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        console.error('[GeoClean Login Error]:', signInError.name, signInError.message);
        if (/email not confirmed/i.test(signInError.message)) {
          return { ok: false, error: 'Please verify your email address before logging in.' };
        }
        if (/rate limit|too many requests/i.test(signInError.message)) {
          return { ok: false, error: 'Too many login attempts. Please wait a moment and try again.' };
        }
        if (
          signInError.name === 'AuthRetryableFetchError' ||
          /fetch failed|network|could not resolve host/i.test(signInError.message)
        ) {
          return {
            ok: false,
            error:
              'Authentication service is unreachable. Please verify your internet connection or Supabase project status.',
          };
        }
        return { ok: false, error: 'Invalid email or password.' };
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        return {
          ok: false,
          error: `Signed in, but the authenticated user could not be read: ${authError?.message || 'No user returned.'}`,
        };
      }

      let profile: ProfileRow | null = null;
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, mobile_number, role, created_at')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('[GeoClean Login Profile Query]:', profileError.message);
      }

      if (existingProfile) {
        profile = existingProfile as ProfileRow;
      } else {
        // Auto-heal missing profile row using metadata from Supabase Auth
        const meta = authData.user.user_metadata || {};
        const metaRole = (meta.role as Role) || expectedRole || 'user';
        const metaName = (meta.full_name as string) || authData.user.email?.split('@')[0] || 'User';
        const metaMobile = (meta.mobile_number as string) || null;

        const { data: healedProfile, error: healError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: authData.user.id,
              full_name: metaName,
              email: authData.user.email || cleanEmail,
              mobile_number: metaMobile,
              role: metaRole,
            },
            { onConflict: 'id' }
          )
          .select('id, full_name, email, mobile_number, role, created_at')
          .maybeSingle();

        if (healError || !healedProfile) {
          console.error('[GeoClean Profile Auto-Heal Failed]:', healError);
          await supabase.auth.signOut();
          return {
            ok: false,
            error: 'Unable to load or create your user profile. Please try again.',
          };
        }
        profile = healedProfile as ProfileRow;
      }

      if (profile.role !== expectedRole) {
        await supabase.auth.signOut();
        return {
          ok: false,
          error:
            expectedRole === 'ngo'
              ? 'This account is not registered as an NGO account.'
              : `This account is not registered as a ${expectedRole}.`,
        };
      }

      let ngo: any = null;
      if (expectedRole === 'ngo') {
        const { data: existingNgo, error: ngoError } = await supabase
          .from('ngos')
          .select('ngo_name, address, description, website, services')
          .eq('profile_id', authData.user.id)
          .maybeSingle();

        if (existingNgo) {
          ngo = existingNgo;
        } else {
          // Auto-heal missing NGO row
          const meta = authData.user.user_metadata || {};
          const ngoName = (meta.ngo_name as string) || (meta.full_name as string) || 'NGO Partner';
          const address = (meta.address as string) || 'Pune, Maharashtra';
          const { data: healedNgo, error: healNgoError } = await supabase
            .from('ngos')
            .upsert(
              {
                profile_id: authData.user.id,
                ngo_name: ngoName,
                address,
                latitude: meta.latitude ? Number(meta.latitude) : null,
                longitude: meta.longitude ? Number(meta.longitude) : null,
                mobile_number: (meta.mobile_number as string) || profile.mobile_number || null,
                description: 'Authorized GeoClean cleanup partner in Pune.',
                services: 'Waste Management, Community Cleanup',
              },
              { onConflict: 'profile_id' }
            )
            .select('ngo_name, address, description, website, services')
            .maybeSingle();

          if (healNgoError || !healedNgo) {
            console.error('[GeoClean NGO Auto-Heal Failed]:', healNgoError);
            await supabase.auth.signOut();
            return {
              ok: false,
              error: 'Could not load your NGO organization record: No NGO record found.',
            };
          }
          ngo = healedNgo;
        }
      }

      setUser(asUser({ ...profile, ngos: ngo ? [ngo] : [] }, authData.user.user_metadata));
      setLoading(false);
      return { ok: true };
    },
    []
  );

  // Creates user account, populates profile, and logs in immediately without OTP
  const signup = useCallback(
    async (data: SignupData, role: Role): Promise<AuthResult> => {
      const cleanEmail = data.email.trim();
      const fullName = data.name.trim();
      const mobileNumber = data.phone?.trim() || null;

      try {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              full_name: fullName,
              mobile_number: mobileNumber,
              role,
              ngo_name: data.organization?.trim() || null,
              address: data.location?.trim() || null,
              latitude: data.latitude ?? null,
              longitude: data.longitude ?? null,
              contact_person: data.contactPerson?.trim() || null,
              registration_id: data.orgId?.trim() || null,
            },
          },
        });

        if (error) {
          console.error('[GeoClean Signup Error]:', error.name, error.message, error.status);
          const msg = error.message || '';
          const isDuplicate =
            error.code === '23505' ||
            error.status === 422 ||
            /already registered|duplicate key|users_email_partial_key|already exists/i.test(msg);
          const isLimited = /rate limit|too many requests/i.test(msg) || error.status === 429;
          const isNetworkError =
            error.name === 'AuthRetryableFetchError' ||
            /fetch failed|network|failed to fetch|timeout|could not resolve host|abort/i.test(msg);
          const isConfigError = /signup.*disabled|signups not allowed|instance.*not allowed/i.test(msg);
          const isDatabaseTriggerError = /database error|error saving new user/i.test(msg);
          const isInvalidEmail = /invalid email|valid email|email address.*invalid/i.test(msg);

          return {
            ok: false,
            error: isDuplicate
              ? 'An account with this email already exists. Please log in instead.'
              : isLimited
              ? 'Too many authentication requests. Please wait a moment and try again.'
              : isNetworkError
              ? 'Authentication service is currently unreachable. If your database project was recently paused, please verify it is active in the Supabase Dashboard.'
              : isConfigError
              ? 'Registration is temporarily unavailable.'
              : isDatabaseTriggerError
              ? 'Unable to create your profile. Please try again.'
              : isInvalidEmail
              ? 'Please enter a valid email address.'
              : msg.toLowerCase().includes('password')
              ? msg
              : 'Unable to complete registration right now. Please try again.',
          };
        }

        // When email confirmation is enabled, Supabase returns a user with empty identities for duplicates
        if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
          return {
            ok: false,
            error: 'An account with this email already exists. Please log in instead.',
          };
        }

        let signedInUser = signUpData?.user;

        // If session was not automatically established, sign in with credentials
        if (!signedInUser || !signUpData.session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: data.password,
          });

          if (signInError) {
            console.warn('[GeoClean Signup Post-SignIn Notice]:', signInError.message);
            if (/email not confirmed/i.test(signInError.message)) {
              return {
                ok: false,
                error: 'Account created! Please check your email to confirm your account before logging in.',
              };
            }
          } else if (signInData.user) {
            signedInUser = signInData.user;
          }
        }

        if (signedInUser) {
          // 1. Upsert profiles row
          const { error: profError } = await supabase.from('profiles').upsert(
            {
              id: signedInUser.id,
              full_name: fullName || signedInUser.email || 'Citizen',
              email: signedInUser.email || cleanEmail,
              mobile_number: mobileNumber,
              role,
            },
            { onConflict: 'id' }
          );

          if (profError) {
            console.error('[GeoClean Profile Insert Error]:', profError.message || profError);
            return {
              ok: false,
              error: 'Unable to create your profile. Please try again.',
            };
          }

          // 2. If NGO role, populate public.ngos row
          if (role === 'ngo') {
            const ngoName = data.organization || data.name || 'NGO Partner';
            const address = data.location || 'Pune, Maharashtra';
            const description = data.description || 'Authorized GeoClean cleanup partner in Pune.';
            const website = data.website || null;
            const services = data.services || 'Waste Management, Community Cleanup';

            const { error: ngoErr } = await supabase.from('ngos').upsert(
              {
                profile_id: signedInUser.id,
                ngo_name: ngoName,
                address,
                latitude: data.latitude ?? null,
                longitude: data.longitude ?? null,
                mobile_number: mobileNumber,
                description,
                website,
                services,
              },
              { onConflict: 'profile_id' }
            );

            if (ngoErr) {
              console.error('[GeoClean NGO Insert Error]:', ngoErr.message || ngoErr);
              return {
                ok: false,
                error: 'Unable to create your NGO profile record. Please try again.',
              };
            }

            window.dispatchEvent(new CustomEvent('geoclean-ngos-updated'));
          }

          // 3. Create welcome notification for citizen
          if (role === 'user') {
            void createNotification({
              userId: signedInUser.id,
              type: 'COMMUNITY_UPDATE',
              title: 'Welcome to GeoClean 🌱',
              message: 'Thank you for helping keep Pune clean! Together, we can build a cleaner, greener community.',
              metadata: { source: 'registration' },
            });
          }

          await loadProfile(signedInUser.id);
        }

        return { ok: true };
      } catch (err) {
        console.error('[GeoClean Signup Unexpected Error]:', err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'An error occurred during registration.',
        };
      }
    },
    [loadProfile]
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=1`,
    });

    if (error) {
      return {
        ok: false,
        error: /rate limit|too many requests/i.test(error.message)
          ? 'Too many authentication email requests. Please wait and try again later.'
          : 'Unable to send a password reset email right now. Please try again later.',
      };
    }
    return { ok: true };
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>): Promise<AuthResult> => {
      if (!user) return { ok: false, error: 'You are not signed in.' };

      const computedLocation =
        patch.location ??
        [
          patch.area ?? user.area,
          patch.locality ?? user.locality,
          patch.district ?? user.district,
          patch.state ?? user.state,
          patch.pincode ?? user.pincode,
        ]
          .filter(Boolean)
          .join(', ');

      // 1. Update Supabase Auth user metadata
      const metaUpdate: Record<string, unknown> = {
        full_name: patch.name ?? user.name,
        mobile_number: patch.phone ?? user.phone ?? null,
        area: patch.area ?? user.area ?? null,
        locality: patch.locality ?? user.locality ?? null,
        landmark: patch.landmark ?? user.landmark ?? null,
        street: patch.street ?? user.street ?? null,
        district: patch.district ?? user.district ?? null,
        state: patch.state ?? user.state ?? null,
        pincode: patch.pincode ?? user.pincode ?? null,
        address: computedLocation || user.location || null,
        avatar_url: patch.avatarUrl ?? user.avatarUrl ?? null,
      };

      if (patch.organization) metaUpdate.ngo_name = patch.organization;

      const { error: metaError } = await supabase.auth.updateUser({
        data: metaUpdate,
      });

      if (metaError) {
        return { ok: false, error: metaError.message };
      }

      // 2. Update public.profiles table
      const profileUpdate: Record<string, unknown> = {
        full_name: patch.name ?? user.name,
        mobile_number: patch.phone ?? user.phone ?? null,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        return { ok: false, error: profileError.message };
      }

      // 3. If NGO role, update public.ngos
      if (user.role === 'ngo') {
        const { error: ngoError } = await supabase
          .from('ngos')
          .update({
            ngo_name: patch.organization ?? patch.name ?? user.organization,
            address: patch.location ?? user.location,
            description: patch.description ?? user.description,
            website: patch.website ?? user.website,
            services: patch.services ?? user.services,
          })
          .eq('profile_id', user.id);

        if (ngoError) return { ok: false, error: ngoError.message };
        window.dispatchEvent(new CustomEvent('geoclean-ngos-updated'));
      }

      await loadProfile(user.id);
      return { ok: true };
    },
    [loadProfile, user]
  );

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    const currentUser = user;
    if (!currentUser) return { ok: false, error: 'You are not signed in.' };

    try {
      // 1. Execute secure Postgres RPC
      const { data, error: rpcError } = await supabase.rpc('delete_user_account');

      if (rpcError) {
        console.warn('RPC delete_user_account notice, applying client-safe cleanup:', rpcError.message);
        // Fallback cleanup
        if (currentUser.role === 'ngo') {
          await supabase.from('ngos').delete().eq('profile_id', currentUser.id);
        }
        await supabase.from('notifications').delete().eq('user_id', currentUser.id);
        const { error: profErr } = await supabase.from('profiles').delete().eq('id', currentUser.id);
        if (profErr && !/does not exist|not found/i.test(profErr.message)) {
          return { ok: false, error: profErr.message || rpcError.message };
        }
      } else if (data && typeof data === 'object' && 'ok' in (data as Record<string, unknown>) && !(data as Record<string, unknown>).ok) {
        return { ok: false, error: ((data as Record<string, unknown>).error as string) || 'Failed to delete account.' };
      }

      // 2. Clear local storage records for this account
      localStorage.removeItem(STORAGE_KEYS.auth);
      localStorage.removeItem(`geoclean-read-notices-${currentUser.id}`);

      // If NGO account, trigger live directory refresh
      if (currentUser.role === 'ngo') {
        window.dispatchEvent(new CustomEvent('geoclean-ngos-updated'));
      }

      // 3. Sign out of authentication session
      try {
        await supabase.auth.signOut();
      } catch {}

      setUser(null);
      return { ok: true };
    } catch (err) {
      console.error('deleteAccount error:', err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting your account.',
      };
    }
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, requestPasswordReset, updateProfile, deleteAccount, logout }),
    [user, loading, login, signup, requestPasswordReset, updateProfile, deleteAccount, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

