import { useState } from "react";

const API = "http://localhost:3001";

const api = (path: string, token?: string, body?: unknown) =>
    fetch(`${API}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json());

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export default function App() {
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [email, setEmail] = useState("pavel@test.cz");
    const [password, setPassword] = useState("heslo");

    const [projects, setProjects] = useState<Any[]>([]);
    const [project, setProject] = useState<Any>(null);
    const [instrument, setInstrument] = useState<Any>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [result, setResult] = useState<Any>(null);
    const [strategy, setStrategy] = useState("");

    // ── Login ──
    async function login() {
        setError("");
        const res = await api("/auth/login", undefined, { email, password });
        if (!res.success) return setError(res.error.message);
        setToken(res.data.token);
        const pRes = await api("/projects", res.data.token);
        if (pRes.success) setProjects(pRes.data);
    }

    // ── Select project → load instrument ──
    async function selectProject(p: Any) {
        setProject(p);
        setResult(null);
        setAnswers({});
        setStrategy("");

        const res = await api(`/projects/${p.id}`, token);
        if (!res.success) return;
        const ivId = res.data.instrumentVersionId;

        const instrRes = await api("/instruments", token);
        if (!instrRes.success) return;

        for (const inst of instrRes.data) {
            const ver = inst.versions?.find((v: Any) => v.id === ivId);
            if (!ver) continue;

            const full = await api(`/instruments/${inst.id}`, token);
            if (!full.success) return;

            setInstrument(full.data);
            const v = full.data.versions?.find((vv: Any) => vv.id === ivId);
            if (v) setStrategy(v.scoringStrategy || "");
            return;
        }
    }

    // ── Submit ──
    async function submit() {
        setError("");
        const version = instrument.versions[0];
        const defaultVal = version.items[0]?.scaleType === "YES_NO" ? 0 : 3;

        const items = version.items.map((it: Any) => ({
            itemId: it.id,
            value: answers[it.id] ?? defaultVal,
        }));

        const res = await api(`/projects/${project.id}/responses`, token, { items });
        if (!res.success) return setError(res.error.message);
        setResult(res.data);
    }

    // ── Not logged in ──
    if (!token) {
        return (
            <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 400 }}>
                <h2>Sandbox — Login</h2>
                <div>
                    <label>
                        Email
                        <br />
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </label>
                </div>
                <div style={{ marginTop: 8 }}>
                    <label>
                        Password
                        <br />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </label>
                </div>
                {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
                <button onClick={login} style={{ marginTop: 12 }}>
                    Login
                </button>
            </div>
        );
    }

    // ── Project selector ──
    if (!project) {
        return (
            <div style={{ padding: 24, fontFamily: "monospace" }}>
                <h2>Select Project</h2>
                {projects.map((p: Any) => (
                    <div key={p.id} style={{ marginBottom: 8 }}>
                        <button onClick={() => selectProject(p)}>
                            {p.name} — {p.instrumentVersion?.instrument?.name} v
                            {p.instrumentVersion?.versionNumber}
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => {
                        setToken("");
                        setProjects([]);
                    }}
                    style={{ marginTop: 16 }}
                >
                    Logout
                </button>
            </div>
        );
    }

    // ── Instrument + scores ──
    const version = instrument?.versions?.[0];
    const isWRA = strategy === "WRA_ABSOLUTE_GAP";
    const is360 = strategy === "NORMATIVE_360";
    const isYesNo = version?.items?.[0]?.scaleType === "YES_NO";

    const groupedItems: Record<string, Any[]> = {};
    if (version) {
        for (const item of version.items) {
            const cName = item.construct.name;
            (groupedItems[cName] ??= []).push(item);
        }
    }

    return (
        <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <h2 style={{ margin: 0 }}>{project.name}</h2>
                <span style={{ color: "#666" }}>
          {strategy ? `(${strategy})` : ""}
        </span>
                <button
                    onClick={() => {
                        setProject(null);
                        setInstrument(null);
                        setResult(null);
                        setAnswers({});
                        setStrategy("");
                    }}
                >
                    ← Projects
                </button>
            </div>

            {!version ? (
                <p>Loading instrument…</p>
            ) : (
                <>
                    {Object.entries(groupedItems).map(([construct, items]) => (
                        <fieldset key={construct} style={{ marginBottom: 16 }}>
                            <legend>
                                <strong>{construct}</strong>
                            </legend>
                            {items.map((item: Any) => {
                                const opts = isYesNo
                                    ? [0, 1]
                                    : Array.from(
                                        { length: item.scaleType === "LIKERT_7" ? 7 : 5 },
                                        (_, i) => i + 1
                                    );

                                return (
                                    <div key={item.id} style={{ marginBottom: 10, paddingLeft: 8 }}>
                                        <div>
                                            <strong>#{item.position}</strong> {item.text}
                                            <span style={{ color: "#888", marginLeft: 8 }}>
                        [{item.measurementType}]
                                                {item.reverseScored && " (R)"}
                                                {item.behaviorPolarity && ` (${item.behaviorPolarity})`}
                                                {item.gapGroupId && ` gap:${item.gapGroupId}`}
                      </span>
                                        </div>
                                        <div style={{ marginTop: 4 }}>
                                            {opts.map((v) => (
                                                <label key={v} style={{ marginRight: 10 }}>
                                                    <input
                                                        type="radio"
                                                        name={`item-${item.id}`}
                                                        checked={answers[item.id] === v}
                                                        onChange={() => setAnswers((a) => ({ ...a, [item.id]: v }))}
                                                    />
                                                    {v}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </fieldset>
                    ))}

                    {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
                    <button onClick={submit} style={{ fontSize: 16, padding: "8px 24px" }}>
                        Submit Response
                    </button>

                    {result && (
                        <div style={{ marginTop: 24 }}>
                            <h3>Item Scores</h3>
                            <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
                                <thead>
                                {isWRA ? (
                                    <tr>
                                        <th>Item</th>
                                        <th>Raw</th>
                                        <th>Source</th>
                                        <th>Target</th>
                                        <th>Gap</th>
                                        <th>|Gap|</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Item</th>
                                        <th>Raw</th>
                                        <th>Normalized</th>
                                    </tr>
                                )}
                                </thead>
                                <tbody>
                                {result.itemScores.map((s: Any) => {
                                    const raw = result.items.find((i: Any) => i.itemId === s.itemId);
                                    return isWRA ? (
                                        <tr key={s.id}>
                                            <td>{s.itemId}</td>
                                            <td>{raw?.value ?? "—"}</td>
                                            <td>{s.sourceValue ?? "—"}</td>
                                            <td>{s.targetValue ?? "—"}</td>
                                            <td>{s.gapValue ?? "—"}</td>
                                            <td>{s.absoluteGapValue ?? "—"}</td>
                                        </tr>
                                    ) : (
                                        <tr key={s.id}>
                                            <td>{s.itemId}</td>
                                            <td>{raw?.value ?? "—"}</td>
                                            <td>{s.sourceValue ?? "—"}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>

                            <h3>Construct Scores</h3>
                            <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
                                <thead>
                                {isWRA ? (
                                    <tr>
                                        <th>Construct</th>
                                        <th>Source Mean</th>
                                        <th>Target Mean</th>
                                        <th>Gap Mean</th>
                                        <th>Mean |Gap|</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Construct</th>
                                        <th>Mean</th>
                                    </tr>
                                )}
                                </thead>
                                <tbody>
                                {result.constructScores.map((c: Any) =>
                                    isWRA ? (
                                        <tr key={c.id}>
                                            <td>{c.construct.name}</td>
                                            <td>{c.sourceMean?.toFixed(2) ?? "—"}</td>
                                            <td>{c.targetMean?.toFixed(2) ?? "—"}</td>
                                            <td>{c.gapMean?.toFixed(2) ?? "—"}</td>
                                            <td>{c.meanAbsoluteGap?.toFixed(2) ?? "—"}</td>
                                        </tr>
                                    ) : (
                                        <tr key={c.id}>
                                            <td>{c.construct.name}</td>
                                            <td>{c.sourceMean?.toFixed(2) ?? "—"}</td>
                                        </tr>
                                    )
                                )}
                                </tbody>
                            </table>

                            <h3>Global Score</h3>
                            {result.globalScore && (
                                <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
                                    <tbody>
                                    {isWRA ? (
                                        <>
                                            <tr>
                                                <td>Global Source Mean</td>
                                                <td>{result.globalScore.globalSourceMean?.toFixed(4)}</td>
                                            </tr>
                                            <tr>
                                                <td>Global Target Mean</td>
                                                <td>{result.globalScore.globalTargetMean?.toFixed(4)}</td>
                                            </tr>
                                            <tr>
                                                <td>Global Gap Mean</td>
                                                <td>{result.globalScore.globalGapMean?.toFixed(4)}</td>
                                            </tr>
                                            <tr>
                                                <td>Global Mean |Gap|</td>
                                                <td>{result.globalScore.globalMeanAbsoluteGap?.toFixed(4)}</td>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr>
                                            <td>Global Mean</td>
                                            <td>{result.globalScore.globalSourceMean?.toFixed(4)}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td>Scoring Model</td>
                                        <td>{result.globalScore.scoringModelVersion}</td>
                                    </tr>
                                    </tbody>
                                </table>
                            )}

                            {!isWRA && !is360 && (
                                <div style={{ marginTop: 8, color: "#a00" }}>
                                    Unknown scoring strategy: {strategy || "—"}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}