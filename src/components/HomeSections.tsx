import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  Facebook,
  Leaf,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Quote,
  Recycle,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Youtube,
} from 'lucide-react';
import { useCountUp, useInView } from '@/lib/hooks';
import { usePlatformStats, formatStatCount } from '@/lib/platformStats';
import { supabase } from '@/utils/supabase';
import heroTeam from '@/assets/geoclean-hero-team.jpg';

export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-forest text-white shadow-lg shadow-forest/20">
        <Recycle size={25} strokeWidth={2.4} />
      </span>
      <span>
        <span className="block text-[18px] font-extrabold leading-none tracking-tight text-ink">
          Geo<span className="text-forest">Clean</span>
        </span>
        <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Clean City. Green Future.
        </span>
      </span>
    </span>
  );
}

export function Hero({ onReport }: { onReport: () => void }) {
  const { citizens, resolved, ngos, loading: statsLoading } = usePlatformStats();

  return (
    <section id="home" className="hero-section overflow-hidden">
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />
      <div className="page-shell grid items-center gap-12 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
        <div className="relative z-10 animate-fade-up">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> Citizen-powered cleanliness
          </div>
          <h1 className="mt-6 max-w-[620px] text-5xl font-extrabold leading-[1.05] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[72px]">
            Together for a <span className="text-forest">Cleaner, Greener</span> Tomorrow
          </h1>
          <p className="mt-7 max-w-[540px] text-base leading-7 text-slate-600 sm:text-lg">
            GeoClean connects citizens, waste collectors and local authorities to report waste, track resolution and build cleaner communities.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button type="button" onClick={onReport} className="button-primary">
              <MapPin size={18} /> Report an Issue
            </button>
          </div>

          {/* 3 Real Platform Statistics */}
          <div className="mt-10 flex items-center gap-6 sm:gap-8 border-t border-slate-200/80 pt-6">
            <div>
              <b className="block font-['Manrope',sans-serif] text-2xl sm:text-3xl font-extrabold text-ink">
                {formatStatCount(citizens, statsLoading)}
              </b>
              <span className="text-xs sm:text-sm font-bold text-slate-500">Citizens</span>
            </div>
            <div className="h-9 w-px bg-slate-200" />
            <div>
              <b className="block font-['Manrope',sans-serif] text-2xl sm:text-3xl font-extrabold text-ink">
                {formatStatCount(resolved, statsLoading)}
              </b>
              <span className="text-xs sm:text-sm font-bold text-slate-500">Resolved</span>
            </div>
            <div className="h-9 w-px bg-slate-200" />
            <div>
              <b className="block font-['Manrope',sans-serif] text-2xl sm:text-3xl font-extrabold text-ink">
                {formatStatCount(ngos, statsLoading)}
              </b>
              <span className="text-xs sm:text-sm font-bold text-slate-500">NGOs</span>
            </div>
          </div>
        </div>
        <HeroIllustration />
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <div className="hero-photo-wrap animate-fade-in">
      <img
        className="hero-photo"
        src={heroTeam}
        alt="GeoClean waste cleanup volunteer team picking up plastic waste on community streets"
      />
    </div>
  );
}

export function QuoteSection() {
  return (
    <section className="w-full border-y border-[#dceddf] bg-[#eef7f0] py-18 sm:py-22 md:py-24 my-10 sm:my-14">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-mint text-forest shadow-sm">
          <Leaf size={26} strokeWidth={2.3} />
        </div>
        <blockquote className="font-['Manrope',sans-serif] text-2xl font-extrabold leading-snug tracking-tight text-ink sm:text-3xl md:text-4xl lg:text-[40px]">
          "Small Actions create cleaner streets and cleaner streets create healthier communities"
        </blockquote>
      </div>
    </section>
  );
}

export function ReportPrompt({ onReport }: { onReport: () => void }) {
  return (
    <section className="page-shell pb-20">
      <div className="report-prompt">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">See waste? Say something.</h2>
          <p className="mt-3 max-w-xl text-slate-600">
            Help keep your city clean by sharing what you see. It takes less than a minute to submit a report.
          </p>
        </div>
        <button type="button" onClick={onReport} className="button-primary whitespace-nowrap">
          <Send size={17} /> Report an Issue <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}

export function ImpactSection({ onReport }: { onReport: () => void }) {
  const view = useInView();
  const { reported, resolved, citizens, ngos, loading: statsLoading } = usePlatformStats();

  const stats = [
    { value: reported, label: 'Issues Reported', icon: AlertTriangle },
    { value: resolved, label: 'Issues Resolved', icon: CircleCheck },
    { value: citizens, label: 'Citizen Connected', icon: Users },
    { value: ngos, label: 'NGO Connected', icon: Building2 },
  ];

  return (
    <section id="impact" ref={view.ref} className="page-shell pb-20">
      <div className="impact-card">
        <div className="impact-copy">
          <span className="section-kicker light">
            <Sparkles size={15} /> Community impact
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Our Impact Together</h2>
          <p className="mt-3 max-w-[270px] text-sm leading-6 text-white/70">
            Every report contributes to a cleaner and healthier community.
          </p>
          <button
            type="button"
            onClick={onReport}
            className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-lime transition hover:gap-3"
          >
            Make a difference <ArrowRight size={16} />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-4">
          {stats.map((stat) => (
            <ImpactStat
              key={stat.label}
              stat={stat}
              active={view.visible}
              loading={statsLoading}
            />
          ))}
        </div>
        <div className="impact-decoration">
          <GlobeIllustration />
        </div>
      </div>
    </section>
  );
}

function GlobeIllustration() {
  return (
    <div className="globe">
      <span />
      <span />
      <span />
      <Leaf className="globe-leaf leaf-left" />
      <Leaf className="globe-leaf leaf-right" />
    </div>
  );
}

function ImpactStat({
  stat,
  active,
  loading,
}: {
  stat: { value: number | null; label: string; icon: typeof AlertTriangle };
  active: boolean;
  loading: boolean;
}) {
  const Icon = stat.icon;
  const counted = useCountUp(stat.value ?? 0, active && stat.value !== null);
  const displayValue = loading ? '—' : stat.value === null ? '—' : counted;

  return (
    <div className="impact-stat">
      <span className="impact-icon">
        <Icon size={20} />
      </span>
      <strong>{displayValue}</strong>
      <span>{stat.label}</span>
    </div>
  );
}

export function HowItWorksSection({ onReport }: { onReport: () => void }) {
  const navigate = useNavigate();
  const steps = [
    {
      icon: Eye,
      title: 'Spot the Waste',
      text: 'Find garbage or waste that needs attention.',
      onClick: undefined,
    },
    {
      icon: Route,
      title: 'How It Works',
      text: 'Learn how GeoClean connects citizens, NGOs, and authorities.',
      onClick: () => navigate('/how-it-works'),
    },
    {
      icon: Truck,
      title: 'We Take Action',
      text: 'Collectors and authorities receive the report and coordinate cleanup.',
      onClick: undefined,
    },
    {
      icon: CheckCircle2,
      title: 'Track the Impact',
      text: 'Follow the status and see how your report helps your community.',
      onClick: undefined,
    },
  ];

  return (
    <section id="how-it-works" className="page-shell pb-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="section-kicker justify-center">
          <Route size={15} /> A simple path to change
        </div>
        <h2 className="mt-4 section-title">How GeoClean Works</h2>
        <p className="section-subtitle mx-auto">
          From a street corner to a city-wide movement, every action moves us forward.
        </p>
      </div>
      <div className="relative mt-14 grid gap-9 md:grid-cols-4 md:gap-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isClickable = Boolean(step.onClick);

          return (
            <div
              key={step.title}
              onClick={step.onClick}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') step.onClick?.(); } : undefined}
              className={`process-step ${isClickable ? 'cursor-pointer transition hover:-translate-y-1' : ''}`}
            >
              <div className="step-number">0{index + 1}</div>
              <span className="step-icon">
                <Icon size={24} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {index < steps.length - 1 && <ChevronRight className="step-arrow hidden md:block" size={20} />}
            </div>
          );
        })}
      </div>
      <div className="mt-12 text-center">
        <button type="button" onClick={onReport} className="button-secondary">
          Start with a report <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}

export function AboutSection() {
  const features = [
    { icon: Users, title: 'Community Driven', text: 'Citizens actively contribute to cleaner neighborhoods.' },
    { icon: ShieldCheck, title: 'Smart Reporting', text: 'Photos and location data make waste reports useful and actionable.' },
    { icon: Sparkles, title: 'Measurable Impact', text: 'Track reports, resolutions, pickups and waste collected.' },
  ];
  return (
    <section id="about" className="border-t border-slate-100 bg-[#f7fbf8] py-24">
      <div className="page-shell grid items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="section-kicker">
            <Leaf size={15} /> Who we are
          </div>
          <h2 className="mt-4 section-title">About GeoClean</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            GeoClean is a community-driven platform designed to make waste reporting simple, transparent and actionable. We connect citizens, waste collectors and local authorities to identify waste issues, coordinate cleanup and measure environmental impact.
          </p>
          <div className="mt-8 space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-forest/[0.06]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-forest">
                    <Icon size={21} />
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{f.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{f.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <AboutArt />
      </div>
    </section>
  );
}

function AboutArt() {
  return (
    <div className="about-art">
      <div className="about-circle about-circle-one" />
      <div className="about-circle about-circle-two" />
      <div className="about-plant plant-one">
        <span />
        <span />
        <span />
      </div>
      <div className="about-plant plant-two">
        <span />
        <span />
        <span />
      </div>
      <div className="about-card">
        <Leaf size={25} />
        <strong>Cleaner choices.</strong>
        <span>Lasting change.</span>
      </div>
      <div className="about-stat">
        <CheckCircle2 size={19} />
        <span>
          <b>98%</b> satisfaction
        </span>
      </div>
    </div>
  );
}

export function Footer({ onReport }: { onReport: () => void }) {
  const links: [string, string[][]][] = [
    ['COMPANY', [['Home', '#home'], ['About Us', '#about'], ['Our Team', '#about'], ['Impact', '#impact']]],
    ['RESOURCES', [['How It Works', '#how-it-works'], ['Blog', '#about'], ['Help Center', '#about'], ['FAQs', '#about']]],
    ['SERVICES', [['Report Waste', '#report'], ['Track Report', '#notifications']]],
    ['SUPPORT', [['Contact', '#footer'], ['Privacy Policy', '#footer'], ['Terms & Conditions', '#footer']]],
  ];
  return (
    <footer id="footer" className="footer">
      <div className="page-shell">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_2fr_1.1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/60">
              Building cleaner communities through technology, collaboration and responsible action.
            </p>
            <div className="mt-6 flex gap-2">
              <a className="social-button" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <span>ig</span>
              </a>
              <a className="social-button" href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={16} />
              </a>
              <a className="social-button" href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <Linkedin size={16} />
              </a>
              <a className="social-button" href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
                <Youtube size={16} />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-7 gap-y-9 sm:grid-cols-4">
            {links.map(([title, items]) => (
              <div key={title}>
                <p className="footer-heading">{title}</p>
                <div className="mt-4 space-y-3">
                  {items.map(([label, href]) => (
                    <a
                      key={label}
                      onClick={label === 'Report Waste' ? (e) => { e.preventDefault(); onReport(); } : undefined}
                      href={href}
                      className="footer-link"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="footer-heading">CONTACT US</p>
            <div className="mt-4 space-y-4 text-sm text-white/70">
              <a href="tel:+919876543210" className="flex gap-3 hover:text-lime">
                <Phone size={16} className="shrink-0 text-lime" /> +91 98765 43210
              </a>
              <a href="mailto:support@geoclean.in" className="flex gap-3 hover:text-lime">
                <Mail size={16} className="shrink-0 text-lime" /> support@geoclean.in
              </a>
              <p className="flex gap-3">
                <MapPin size={16} className="shrink-0 text-lime" /> 123 Green Avenue,<br /> Clean City, India - 400001
              </p>
            </div>
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row">
          <p>&copy; 2026 GeoClean. All rights reserved.</p>
          <p>Made for a cleaner, greener future.</p>
        </div>
      </div>
    </footer>
  );
}

export { Clock3 };
