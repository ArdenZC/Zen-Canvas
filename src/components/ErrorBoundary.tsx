import { Component, type ReactNode } from "react";
import { useI18nContext, useNavigationContext } from "../contexts/AppContexts";
import { maturityCopy, type MaturityCopy } from "../i18n/maturityCopy";
import { buttonSecondary, cn, glassButtonPrimary } from "../utils/tw";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface BoundaryProps extends Props {
  copy: MaturityCopy;
  onBackToOverview: () => void;
}

interface State {
  error: Error | null;
}

class RecoverableViewErrorBoundary extends Component<BoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private backToOverview = () => {
    this.setState({ error: null });
    this.props.onBackToOverview();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const { copy } = this.props;
      return (
        <section className="grid min-h-64 place-items-center px-4 py-8" role="alert" data-view-error-boundary>
          <div className="grid w-full max-w-xl gap-4 rounded-[var(--zc-radius-panel)] border border-[var(--zc-border)] bg-[var(--zc-surface)] p-5 shadow-[var(--zc-shadow-raised)]">
            <div>
              <strong className="block text-base font-semibold text-[var(--zc-text-primary)]">
                {this.props.fallbackLabel ?? copy.viewErrorTitle}
              </strong>
              <p className="mt-2 text-sm leading-6 text-[var(--zc-text-secondary)]">{copy.viewErrorDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={glassButtonPrimary} onClick={this.retry}>{copy.retry}</button>
              <button type="button" className={buttonSecondary} onClick={this.backToOverview}>{copy.backToOverview}</button>
            </div>
            <details className="rounded-[var(--zc-radius-control)] border border-[var(--zc-divider)] px-3 py-2" data-view-error-technical-details>
              <summary className={cn("cursor-pointer text-xs font-medium text-[var(--zc-text-secondary)]", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]")}>{copy.technicalDetails}</summary>
              <code className="mt-2 block break-all text-xs leading-5 text-[var(--zc-text-tertiary)]">{error.message}</code>
            </details>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export function ViewErrorBoundary(props: Props) {
  const { language } = useI18nContext();
  const { setView } = useNavigationContext();
  return (
    <RecoverableViewErrorBoundary
      {...props}
      copy={maturityCopy(language)}
      onBackToOverview={() => setView("scanner")}
    />
  );
}
