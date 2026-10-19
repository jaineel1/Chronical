import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a thrown render error or a storage failure shows a readable page instead
 * of blank paper. Keeps the player's data untouched; a reload usually clears it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Chronicle error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const storage = /indexeddb|quota|database|dexie|storage/i.test(this.state.error.message);
    return (
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        <header className="bg-ink px-6 py-3.5 text-paper">Chronicle</header>
        <main className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-6 pt-10">
          <p className="letter">
            <span className="drop">S</span>omething broke on this screen. Your log is still on this device; nothing was lost.
          </p>
          {storage ? (
            <p className="text-mid">
              This browser refused local storage. Private windows and some in-app browsers do that. Open Chronicle in Safari or Chrome
              directly, or add it to your Home Screen.
            </p>
          ) : null}
          <pre className="whitespace-pre-wrap border border-faint p-3 text-mid">{this.state.error.message}</pre>
          <button type="button" className="h-12 bg-walnut px-4 text-[18px] text-paper" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      </div>
    );
  }
}
