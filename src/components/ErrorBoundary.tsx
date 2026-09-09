import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
          <div className="max-w-md w-full rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="button-primary inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs"
              >
                <RefreshCw size={14} /> Reload Page
              </button>
              <a
                href="/"
                className="button-secondary inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs"
              >
                <Home size={14} /> Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
