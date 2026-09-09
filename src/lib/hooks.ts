import { useEffect, useState } from 'react';
import { STORAGE_KEYS, type Report } from './types';

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.reports);
      setReports(raw ? (JSON.parse(raw) as Report[]) : []);
    } catch {
      setReports([]);
    }
  }, []);

  const save = (updated: Report[]) => {
    setReports(updated);
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(updated));
  };

  const addReport = (report: Report) => save([report, ...reports]);
  const updateReport = (id: string, patch: Partial<Report>) =>
    save(reports.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return { reports, addReport, updateReport };
}

export function useCountUp(target: number, active: boolean, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, duration, target]);
  return value;
}

export function useInView() {
  const ref = useInViewRef();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return { ref, visible };
}

import { useRef } from 'react';
function useInViewRef() {
  return useRef<HTMLDivElement>(null);
}
