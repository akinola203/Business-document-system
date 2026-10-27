import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-[#16181F] border border-rose-500/30 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
            {/* Background Accent Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white tracking-tight">
                  {this.props.fallbackTitle || 'Studio Component Encountered an Error'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  A client-side error occurred while rendering the document preview.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0F1015] border border-slate-800 text-xs font-mono text-rose-300 mb-6 overflow-x-auto max-h-40 leading-relaxed">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recover Studio</span>
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = '/documents/invoices')}
                className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border border-slate-700 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Invoices</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
