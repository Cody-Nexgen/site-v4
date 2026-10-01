import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { setPageVersion } from '../../lib/pageVersions';

/** Loading + crash guard around a lazily loaded legacy page. */
export function LegacyFrame({ pageId, fill = false, children }: { pageId: string; fill?: boolean; children: ReactNode }) {
    return (
        <LegacyErrorBoundary pageId={pageId}>
            <Suspense
                fallback={
                    <div className={`flex items-center justify-center ${fill ? 'fixed inset-0 bg-page' : 'min-h-[40vh]'}`}>
                        <span className="size-6 animate-spin rounded-full border-2 border-[var(--fz-text-4)] border-t-transparent" />
                    </div>
                }
            >
                {children}
            </Suspense>
        </LegacyErrorBoundary>
    );
}

class LegacyErrorBoundary extends Component<{ pageId: string; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[Legacy ${this.props.pageId}]`, error, info.componentStack);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
                <p className="text-[15px] font-semibold text-[var(--fz-text-1)]">The legacy version of this page didn't load</p>
                <p className="text-body-sm text-[var(--fz-text-3)]">Your data is fine. Switch back to the new version to keep going.</p>
                <button
                    type="button"
                    onClick={() => {
                        void setPageVersion(this.props.pageId, 'new');
                        this.setState({ failed: false });
                    }}
                    className="mt-1 rounded-lg bg-[var(--fz-text-1)] px-3.5 py-2 text-[13px] font-medium text-[var(--fz-bg-app)]"
                >
                    Use the new version
                </button>
            </div>
        );
    }
}
