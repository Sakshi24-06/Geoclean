import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import ReportModal, { SuccessModal } from '@/components/ReportModal';
import { Hero, QuoteSection, ReportPrompt, ImpactSection, HowItWorksSection, AboutSection, Footer } from '@/components/HomeSections';
import type { Report } from '@/lib/types';

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<Report>();

  const handleSubmitted = (report: Report) => {
    setReportOpen(false);
    setSubmittedReport(report);
  };

  const trackReport = () => {
    setSubmittedReport(undefined);
    navigate('/my-reports');
  };

  return (
    <DashboardLayout onReport={() => setReportOpen(true)}>
      <Hero onReport={() => setReportOpen(true)} />
      <QuoteSection />
      <div id="report"><ReportPrompt onReport={() => setReportOpen(true)} /></div>
      <ImpactSection onReport={() => setReportOpen(true)} />
      <HowItWorksSection onReport={() => setReportOpen(true)} />
      <AboutSection />
      <Footer onReport={() => setReportOpen(true)} />
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onSubmitted={handleSubmitted} />}
      {submittedReport && <SuccessModal report={submittedReport} onClose={() => setSubmittedReport(undefined)} onTrack={trackReport} />}
    </DashboardLayout>
  );
}
