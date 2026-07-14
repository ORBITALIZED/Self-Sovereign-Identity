import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional fallback component shown when an error is caught. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors from any descendant and shows a friendly
 * fallback instead of unmounting the whole app. Logs to the console so a
 * developer can inspect the stack; production builds could redirect the
 * log into a tracking service here.
 *
 * Exported both as a named and as a default export so the existing
 * `import ErrorBoundary from ...` (default) and a future
 * `import { ErrorBoundary } from ...` (named) both keep compiling.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught render error", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="surface-card max-w-md mx-auto mt-12 p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-red-300">Something went wrong</h2>
          <p className="text-sm text-slate-300">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
