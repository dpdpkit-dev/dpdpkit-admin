import { Component, useEffect, useState, type ReactNode } from "react";
import { AuditExport, ConsentAnalytics, IncidentRegister, Overview, RequestQueue, RetentionMonitor, Settings } from "./screens";

const SCREENS = [
  { id: "overview", label: "Overview", View: Overview },
  { id: "requests", label: "Request queue", View: RequestQueue },
  { id: "consent", label: "Consent analytics", View: ConsentAnalytics },
  { id: "retention", label: "Retention monitor", View: RetentionMonitor },
  { id: "incidents", label: "Incident register", View: IncidentRegister },
  { id: "audit", label: "Audit export", View: AuditExport },
  { id: "settings", label: "Settings", View: Settings },
] as const;

// Hash routing keeps the bundle working under any adapter mount path without server-side fallbacks.
function fromHash(): string {
  const id = window.location.hash.replace(/^#\/?/, "");
  return SCREENS.some((s) => s.id === id) ? id : SCREENS[0].id;
}

// One screen failing to render must not take the navigation and the other screens with it.
class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p role="alert">
        This screen could not be displayed. The backend may be a different version from this dashboard.
      </p>
    );
  }
}

export function App() {
  const [current, setCurrent] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setCurrent(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const { View } = SCREENS.find((s) => s.id === current)!;
  return (
    <main>
      <h1>dpdpkit admin</h1>
      <nav aria-label="Screens">
        <ul className="nav">
          {SCREENS.map((s) => (
            <li key={s.id}>
              <a href={`#/${s.id}`} aria-current={s.id === current ? "page" : undefined}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ScreenBoundary key={current}>
        <View />
      </ScreenBoundary>
    </main>
  );
}
