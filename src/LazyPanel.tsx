import {
  Component,
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import { OperationSpinner } from "./SyncFeedback";

/** Keep navigation and persisted state available if an optional chunk fails. */
class PanelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="form-error">
        Não foi possível abrir esta seção. Confira a conexão e tente novamente.
        <button
          type="button"
          className="outline-button"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Load secondary screens only when opened; all chunks remain precached offline. */
export function lazyPanel<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
) {
  const Panel = lazy(async () => {
    const { default: Loaded } = await load();
    return {
      default: function LoadedPanel(props: P) {
        useEffect(() => {
          // A route heading may not exist during the parent's navigation effect.
          // Do not steal focus from a modal or from controls used while loading.
          if (
            !document.querySelector('[role="dialog"]') &&
            document.activeElement?.closest("nav, .app-header")
          )
            document
              .querySelector<HTMLElement>("#main-content #page-title")
              ?.focus({ preventScroll: true });
        }, []);
        return <Loaded {...props} />;
      },
    };
  });
  return function DeferredPanel(props: P) {
    return (
      <PanelBoundary>
        <Suspense
          fallback={
            <span role="status" aria-label="Carregando seção">
              <OperationSpinner active />
            </span>
          }
        >
          <Panel {...props} />
        </Suspense>
      </PanelBoundary>
    );
  };
}
