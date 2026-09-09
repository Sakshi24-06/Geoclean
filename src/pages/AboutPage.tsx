import DashboardLayout from '@/components/DashboardLayout';
import { AboutSection, Footer } from '@/components/HomeSections';

export default function AboutPage() {
  return (
    <DashboardLayout>
      <AboutSection />
      <Footer onReport={() => {}} />
    </DashboardLayout>
  );
}
