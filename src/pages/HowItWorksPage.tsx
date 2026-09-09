import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  Leaf,
  MapPin,
  Recycle,
  Route,
  Truck,
  User,
  Users,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

const steps = [
  { icon: Eye, title: 'Spot Waste', text: 'Find garbage or waste that needs attention in your area.' },
  { icon: Camera, title: 'Report Issue', text: 'Take a photo, select the issue type and describe the problem.' },
  { icon: MapPin, title: 'Capture Location', text: 'Share your current location so the right team can find it.' },
  { icon: Truck, title: 'Assign Cleanup', text: 'The report is assigned to an NGO or waste collection team.' },
  { icon: Recycle, title: 'Cleanup', text: 'The assigned team collects the waste and cleans the area.' },
  { icon: CheckCircle2, title: 'Resolve', text: 'The report is marked as resolved and the citizen is notified.' },
  { icon: Leaf, title: 'Measure Impact', text: 'Track the environmental impact of every cleanup action.' },
];

const roles = [
  {
    icon: User,
    title: 'Citizens',
    color: 'text-forest',
    bg: 'bg-mint',
    points: ['Report waste issues with photos and location', 'Track the status of submitted reports', 'View community impact and cleanliness scores', 'Receive notifications when issues are resolved'],
  },
  {
    icon: Leaf,
    title: 'NGOs',
    color: 'text-forest',
    bg: 'bg-mint',
    points: ['Receive assigned reports from admins', 'Coordinate cleanup operations', 'Update report status after cleanup', 'Track organization-level impact statistics'],
  },
];

export default function HowItWorksPage() {
  return (
    <DashboardLayout>
      <section className="page-shell py-12">
        <div className="section-kicker justify-center"><Route size={15} /> The complete process</div>
        <h1 className="mt-4 section-title text-center">How GeoClean Works</h1>
        <p className="section-subtitle mx-auto max-w-2xl text-center">From a street corner to a city-wide movement, every action moves us forward. Here's the complete journey of a waste report.</p>
      </section>

      <section className="page-shell pb-16">
        <div className="process-flow">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="process-flow-step">
                <div className="process-flow-icon"><Icon size={26} /></div>
                <div className="process-flow-num">{String(index + 1).padStart(2, '0')}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index < steps.length - 1 && <div className="process-flow-arrow" />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="page-shell pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="section-kicker justify-center"><Users size={15} /> Roles & responsibilities</div>
          <h2 className="mt-4 section-title">Who Does What</h2>
          <p className="section-subtitle mx-auto">GeoClean brings together key groups to create cleaner communities.</p>
        </div>
        <div className="mx-auto mt-12 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.title} className="role-detail-card">
                <span className={`role-detail-icon ${role.bg}`}><Icon size={26} className="text-forest" /></span>
                <h3>{role.title}</h3>
                <ul>
                  {role.points.map((p) => (
                    <li key={p}>
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </DashboardLayout>
  );
}
