import { Component, type ReactNode } from "react";

/** Shows a recovery screen instead of a blank page if a page crashes while rendering. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-fg-3">Your saved work is safe. Reload the page to continue.</p>
          <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg" onClick={() => location.assign("/")}>Reload</button>
        </div>
      </div>
    );
  }
}
