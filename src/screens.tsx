import { useState, type ReactNode } from "react";
import { api, defaultApiBase, getApiBase, setApiBase, type RequestUpdate, type RightsRequest } from "./api";
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

export function Overview() {
  const requests = useLoad(api.requests);
  const retention = useLoad(api.retention);
  return (
    <section aria-labelledby="h-overview">
      <h2 id="h-overview">Overview</h2>
      <Status state={requests}>
        {(rs) => (
          <ul>
            <li>Open requests: {rs.filter((r) => !r.closed_at).length}</li>
            <li>Overdue requests: {rs.filter((r) => r.overdue).length}</li>
          </ul>
        )}
      </Status>
      <Status state={retention}>
        {(r) => (
          <ul>
            <li>Upcoming erasures: {r.items.filter((i) => i.action === "erase").length}</li>
            <li>Needs attention: {r.needs_attention.length}</li>
          </ul>
        )}
      </Status>
    </section>
  );
}

function RequestActions({ request, onUpdate }: { request: RightsRequest; onUpdate: (u: RequestUpdate) => void }) {
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState("");
  const awaitingStart = request.status === "received" || request.status === "identity_pending";
  return (
    <details>
      <summary>Manage {request.id}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpdate({ action: "assign", assignee: assignee.trim() });
        }}
      >
        <label>
          Assign to <input required value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        </label>{" "}
        <button type="submit">Assign</button>
      </form>
      {awaitingStart && (
        <p>
          <button type="button" onClick={() => onUpdate({ action: "start" })}>
            Start
          </button>{" "}
          <button type="button" onClick={() => onUpdate({ action: "verify_identity", verified: true })}>
            Identity verified
          </button>{" "}
          <button type="button" onClick={() => onUpdate({ action: "verify_identity", verified: false })}>
            Identity not verified (rejects)
          </button>
        </p>
      )}
      <label>
        Response or rejection reason
        <br />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {request.kind === "erasure" && (
        <p>Responding to an erasure request erases this person's data, except anything under a legal hold.</p>
      )}
      <p>
        <button type="button" disabled={!message.trim()} onClick={() => onUpdate({ action: "respond", message })}>
          Respond and complete
        </button>{" "}
        <button type="button" disabled={!message.trim()} onClick={() => onUpdate({ action: "reject", message })}>
          Reject
        </button>
      </p>
    </details>
  );
}

export function RequestQueue() {
  const state = useLoad(api.requests);
  const [actionError, setActionError] = useState<string | null>(null);
  const update = async (id: string, change: RequestUpdate) => {
    try {
      await api.updateRequest(id, change);
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
                <th scope="col">Principal</th>
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
                  <td>{r.principal}</td>
                  <td>{r.kind}</td>
                  <td>{r.status.replace("_", " ")}</td>
                  <td>{r.assignee ?? "unassigned"}</td>
                  <td>{r.closed_at ? "—" : slaLabel(r.due_at)}</td>
                  <td>{!r.closed_at && <RequestActions request={r} onUpdate={(u) => update(r.id, u)} />}</td>
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
                <th scope="col">Denials</th>
                <th scope="col">Withdrawals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.purpose}@${s.notice_version}`}>
                  <td>{s.purpose}</td>
                  <td>{s.notice_version ?? "—"}</td>
                  <td>{s.grants}</td>
                  <td>{s.denials}</td>
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
        {(r) => (
          <>
            <h3>Upcoming warnings and erasures</h3>
            {r.items.length === 0 ? (
              <p>Nothing scheduled in the next 7 days.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Principal</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Action</th>
                    <th scope="col">Scheduled</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((i) => (
                    <tr key={`${i.schedule_id}:${i.action}`}>
                      <td>{i.principal}</td>
                      <td>{i.purpose}</td>
                      <td>{i.action === "erase" ? "erasure" : "warning"}</td>
                      <td>{i.at.slice(0, 10)}</td>
                      <td>{i.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3>Needs attention</h3>
            {r.needs_attention.length === 0 ? (
              <p>Nothing needs attention.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Principal</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {r.needs_attention.map((a) => (
                    <tr key={a.schedule_id}>
                      <td>{a.principal}</td>
                      <td>{a.purpose}</td>
                      <td>{a.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Status>
    </section>
  );
}

const HOUR = 3_600_000;

export function clockLabel(dueAt: string, now = Date.now()): string {
  const hours = Math.floor((new Date(dueAt).getTime() - now) / HOUR);
  if (hours < 0) return `overdue by ${-hours}h`;
  return `${hours}h left`;
}

export function IncidentRegister() {
  const state = useLoad(api.incidents);
  const [title, setTitle] = useState("");
  const [awareAt, setAwareAt] = useState("");
  const [affected, setAffected] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  const create = async () => {
    try {
      await api.createIncident({
        title: title.trim(),
        aware_at: new Date(awareAt).toISOString(),
        ...(affected ? { affected_count: Number(affected) } : {}),
      });
      setTitle("");
      setAwareAt("");
      setAffected("");
      setActionError(null);
      state.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };
  const showDraft = async (id: string) => {
    try {
      setDraft({ id, text: await api.incidentReport(id) });
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section aria-labelledby="h-incidents">
      <h2 id="h-incidents">Incident register</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label>
          Title <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>{" "}
        <label>
          Aware at{" "}
          <input type="datetime-local" required value={awareAt} onChange={(e) => setAwareAt(e.target.value)} />
        </label>{" "}
        <label>
          Affected principals{" "}
          <input type="number" min="0" value={affected} onChange={(e) => setAffected(e.target.value)} />
        </label>{" "}
        <button type="submit">Record incident</button>
      </form>
      {actionError && <p role="alert">{actionError}</p>}
      <Status state={state}>
        {(items) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Incident</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Board report (72h)</th>
                <th scope="col">CERT-In (6h)</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td>{i.title}</td>
                  <td>{i.status ?? "open"}</td>
                  <td>{clockLabel(i.board_report_due)}</td>
                  <td>{i.cert_in_report_due ? clockLabel(i.cert_in_report_due) : "—"}</td>
                  <td>
                    <button type="button" onClick={() => showDraft(i.id)}>
                      View draft report {i.id}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Status>
      {draft && (
        <section aria-label={`Draft report ${draft.id}`}>
          <h3>Draft report {draft.id}</h3>
          <p>Draft only. dpdpkit never submits to the Board or CERT-In; send it yourself after review.</p>
          <pre>{draft.text}</pre>
        </section>
      )}
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
          : `Ledger check failed at row ${v.failed_row ?? "unknown"} after ${v.checked} entries: ${v.reason ?? "no reason given"}.`,
      );
    } catch (e) {
      setResult(`Verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  // Fetched rather than linked: a plain link would save an error response (say, a missing role) as the download.
  const download = async () => {
    try {
      const { name, blob } = await api.auditExport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      setResult(`Downloaded ${name}.`);
    } catch (e) {
      setResult(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <section aria-labelledby="h-audit">
      <h2 id="h-audit">Audit export</h2>
      <p>
        <button type="button" onClick={download}>
          Download evidence pack
        </button>
      </p>
      <button type="button" onClick={verify}>
        Verify ledger
      </button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}

export function Settings() {
  const notice = useLoad(api.notice);
  const [base, setBase] = useState(getApiBase());
  const [saved, setSaved] = useState(false);
  return (
    <section aria-labelledby="h-settings">
      <h2 id="h-settings">Settings</h2>
      <h3>Current notice and purposes</h3>
      <p>These come from your dpdpkit configuration and are read-only here.</p>
      <Status state={notice}>
        {(n) => (
          <>
            <ul>
              <li>Title: {n.title}</li>
              <li>Version: {n.version}</li>
              <li>Published: {n.published_at.slice(0, 10)}</li>
              <li>Languages: {n.available_locales.join(", ")}</li>
              <li>Content hash: {n.content_hash}</li>
            </ul>
            <table>
              <thead>
                <tr>
                  <th scope="col">Purpose</th>
                  <th scope="col">Legal basis</th>
                  <th scope="col">Required</th>
                  <th scope="col">Data items</th>
                </tr>
              </thead>
              <tbody>
                {n.purposes.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.legal_basis.replace("_", " ")}</td>
                    <td>{p.required ? "yes" : "no"}</td>
                    <td>{p.data_items.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Status>
      <h3>Connection</h3>
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
            placeholder={defaultApiBase()}
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
