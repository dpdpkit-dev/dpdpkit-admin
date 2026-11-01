import { useState, type ReactNode } from "react";
import { api, DEFAULT_API_BASE, getApiBase, setApiBase, type DsrRequest } from "./api";
import { useLoad, type Loaded } from "./useLoad";

function Status<T>({ state, children }: { state: Loaded<T>; children: (data: T) => ReactNode }) {
  if (state.loading) return <p role="status">Loading…</p>;
  if (state.error || !state.data) {
    return (
      <p role="alert">
        Could not load: {state.error}{" "}
        <button type="button" onClick={state.reload}>
          Retry
        </button>
      </p>
    );
  }
  return <>{children(state.data)}</>;
}

const DAY = 86_400_000;

export function slaLabel(dueAt: string, now = Date.now()): string {
  const days = Math.ceil((new Date(dueAt).getTime() - now) / DAY);
  if (days < 0) return `overdue by ${-days}d`;
  return days === 0 ? "due today" : `${days}d left`;
}

export function isOverdue(r: DsrRequest, now = Date.now()): boolean {
  return r.status !== "closed" && new Date(r.due_at).getTime() < now;
}

export function Overview() {
  const requests = useLoad(api.requests);
  const retention = useLoad(api.retention);
  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview</h2>
      <Status state={requests}>
        {(rs) => (
          <ul>
            <li>Open requests: {rs.filter((r) => r.status !== "closed").length}</li>
            <li>Overdue requests: {rs.filter((r) => isOverdue(r)).length}</li>
          </ul>
        )}
      </Status>
      <Status state={retention}>
        {(items) => (
          <ul>
            <li>Upcoming erasures: {items.filter((i) => i.action === "erasure").length}</li>
            <li>Needs attention: {items.filter((i) => i.action === "needs_attention").length}</li>
          </ul>
        )}
      </Status>
    </section>
  );
}

export function RequestQueue() {
  const state = useLoad(api.requests);
  const [actionError, setActionError] = useState<string | null>(null);
  const close = async (id: string) => {
    try {
      await api.closeRequest(id);
      setActionError(null);
      state.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section aria-labelledby="h-queue">
      <h2 id="h-queue">Request queue</h2>
      {actionError && <p role="alert">{actionError}</p>}
      <Status state={state}>
        {(rs) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Assignee</th>
                <th scope="col">SLA</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rs.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.type}</td>
                  <td>{r.status}</td>
                  <td>{r.assignee ?? "unassigned"}</td>
                  <td>{r.status === "closed" ? "—" : slaLabel(r.due_at)}</td>
                  <td>
                    {r.status !== "closed" && (
                      <button type="button" onClick={() => close(r.id)}>
                        Close {r.id}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Status>
    </section>
  );
}

export function ConsentAnalytics() {
  const state = useLoad(api.consentStats);
  return (
    <section aria-labelledby="h-consent">
      <h2 id="h-consent">Consent analytics</h2>
      <Status state={state}>
        {(rows) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Purpose</th>
                <th scope="col">Notice version</th>
                <th scope="col">Grants</th>
                <th scope="col">Withdrawals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.purpose}@${s.notice_version}`}>
                  <td>{s.purpose}</td>
                  <td>{s.notice_version}</td>
                  <td>{s.grants}</td>
                  <td>{s.withdrawals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Status>
    </section>
  );
}

export function RetentionMonitor() {
  const state = useLoad(api.retention);
  return (
    <section aria-labelledby="h-retention">
      <h2 id="h-retention">Retention monitor</h2>
      <Status state={state}>
        {(items) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Action</th>
                <th scope="col">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.subject}</td>
                  <td>{i.action.replace("_", " ")}</td>
                  <td>{i.scheduled_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Status>
    </section>
  );
}

export function AuditExport() {
  const [result, setResult] = useState<string | null>(null);
  const verify = async () => {
    try {
      const v = await api.verifyLedger();
      setResult(
        v.ok
          ? `Ledger verified: ${v.checked} entries intact.`
          : `Ledger broken at entry ${v.first_bad_index} of ${v.checked}.`,
      );
    } catch (e) {
      setResult(`Verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <section aria-labelledby="h-audit">
      <h2 id="h-audit">Audit export</h2>
      <p>
        <a href={api.auditExportUrl()} download>
          Download evidence pack
        </a>
      </p>
      <button type="button" onClick={verify}>
        Verify ledger
      </button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}

export function Settings() {
  const [base, setBase] = useState(getApiBase());
  const [saved, setSaved] = useState(false);
  return (
    <section aria-labelledby="h-settings">
      <h2 id="h-settings">Settings</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApiBase(base);
          setSaved(true);
        }}
      >
        <label>
          API base path{" "}
          <input
            value={base}
            placeholder={DEFAULT_API_BASE}
            onChange={(e) => {
              setBase(e.target.value);
              setSaved(false);
            }}
          />
        </label>{" "}
        <button type="submit">Save</button>
        {saved && <p role="status">Saved. Reload screens to use the new base.</p>}
      </form>
    </section>
  );
}
