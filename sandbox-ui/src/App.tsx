import { useState } from "react";

const API = "http://localhost:3001";

// ── Scale metadata (inline copy from backend scaleConfig.ts) ──

interface ScaleMeta { min: number; max: number; values: number[] }

const SCALE_META: Record<string, ScaleMeta> = {
    YES_NO:   { min: 0, max: 1,  values: [0, 1] },
    LIKERT_5: { min: 1, max: 5,  values: [1, 2, 3, 4, 5] },
    SCALE_3:  { min: 1, max: 3,  values: [1, 2, 3] },
    LIKERT_7: { min: 1, max: 7,  values: [1, 2, 3, 4, 5, 6, 7] },
    SCALE_6:  { min: 1, max: 6,  values: [1, 2, 3, 4, 5, 6] },
    SCALE_10: { min: 1, max: 10, values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
};

// Labels keyed by "LABEL_SET:SCALE_TYPE"
const LABEL_MAP: Record<string, Record<number, string>> = {
    "AGREEMENT:SCALE_3":  { 1: "Nesouhlasím", 2: "Neutrální", 3: "Souhlasím" },
    "AGREEMENT:LIKERT_5": { 1: "Silně nesouhlasím", 2: "Nesouhlasím", 3: "Neutrální", 4: "Souhlasím", 5: "Silně souhlasím" },
    "AGREEMENT:SCALE_6":  { 1: "Silně nesouhlasím", 2: "Nesouhlasím", 3: "Spíše nesouhlasím", 4: "Spíše souhlasím", 5: "Souhlasím", 6: "Silně souhlasím" },
    "AGREEMENT:LIKERT_7": { 1: "Silně nesouhlasím", 2: "Nesouhlasím", 3: "Spíše nesouhlasím", 4: "Neutrální", 5: "Spíše souhlasím", 6: "Souhlasím", 7: "Silně souhlasím" },
    "FREQUENCY:SCALE_3":  { 1: "Nikdy", 2: "Někdy", 3: "Vždy" },
    "FREQUENCY:LIKERT_5": { 1: "Nikdy", 2: "Zřídka", 3: "Někdy", 4: "Často", 5: "Vždy" },
    "FREQUENCY:SCALE_6":  { 1: "Nikdy", 2: "Velmi zřídka", 3: "Zřídka", 4: "Někdy", 5: "Často", 6: "Vždy" },
    "FREQUENCY:LIKERT_7": { 1: "Nikdy", 2: "Velmi zřídka", 3: "Zřídka", 4: "Někdy", 5: "Často", 6: "Velmi často", 7: "Vždy" },
    "QUALITY:SCALE_3":  { 1: "Špatné", 2: "Průměrné", 3: "Výborné" },
    "QUALITY:LIKERT_5": { 1: "Velmi špatné", 2: "Špatné", 3: "Průměrné", 4: "Dobré", 5: "Výborné" },
    "QUALITY:SCALE_6":  { 1: "Velmi špatné", 2: "Špatné", 3: "Podprůměrné", 4: "Průměrné", 5: "Dobré", 6: "Výborné" },
    "QUALITY:LIKERT_7": { 1: "Velmi špatné", 2: "Špatné", 3: "Podprůměrné", 4: "Průměrné", 5: "Nadprůměrné", 6: "Dobré", 7: "Výborné" },
    "IMPORTANCE:SCALE_3":  { 1: "Nedůležité", 2: "Neutrální", 3: "Důležité" },
    "IMPORTANCE:LIKERT_5": { 1: "Nedůležité", 2: "Málo důležité", 3: "Neutrální", 4: "Důležité", 5: "Velmi důležité" },
    "IMPORTANCE:SCALE_6":  { 1: "Zcela nedůležité", 2: "Nedůležité", 3: "Málo důležité", 4: "Poměrně důležité", 5: "Důležité", 6: "Velmi důležité" },
    "IMPORTANCE:LIKERT_7": { 1: "Zcela nedůležité", 2: "Nedůležité", 3: "Málo důležité", 4: "Neutrální", 5: "Poměrně důležité", 6: "Důležité", 7: "Velmi důležité" },
};

function getScaleOptions(scaleType: string): number[] {
    return SCALE_META[scaleType]?.values ?? SCALE_META.LIKERT_5.values;
}

function getLabel(labelSet: string | null | undefined, scaleType: string, value: number): string | undefined {
    if (!labelSet) return undefined;
    return LABEL_MAP[`${labelSet}:${scaleType}`]?.[value];
}

// ── Centralized Czech respondent-facing strings ──

const CS = {
    respondent: "Odpovídá",
    feedbackFor: "Dává zpětnou vazbu pro",
    relationship: "Vztah",
    selfTarget: "sebe",
    rel: {
        SELF: "Sebehodnocení",
        MANAGER: "Nadřízený",
        PEER: "Kolega",
        SUBORDINATE: "Podřízený",
    } as Record<string, string>,
};

// ── Scale label helpers ──

/** Inline label for a single radio option. Long scales (7+) show just the number. */
function formatOptionLabel(labelSet: string | null | undefined, scaleType: string, value: number): string {
    const lbl = getLabel(labelSet, scaleType, value);
    if (!lbl) return String(value);
    if (getScaleOptions(scaleType).length >= 7) return String(value);
    return `${value} – ${lbl}`;
}

/** Compact min / mid / max legend for long scales (7+). Returns null when not applicable. */
function renderScaleLegend(labelSet: string | null | undefined, scaleType: string) {
    if (!labelSet) return null;
    const options = getScaleOptions(scaleType);
    if (options.length < 7) return null;
    const labels = LABEL_MAP[`${labelSet}:${scaleType}`];
    if (!labels) return null;
    const min = options[0];
    const max = options[options.length - 1];
    const mid = options[Math.floor((options.length - 1) / 2)];
    return (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8, fontStyle: "italic" }}>
            {min} = {labels[min]}  …  {mid} = {labels[mid]}  …  {max} = {labels[max]}
        </div>
    );
}

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
    const [userName, setUserName] = useState("");

    const [projects, setProjects] = useState<Any[]>([]);
    const [project, setProject] = useState<Any>(null);
    const [assignments, setAssignments] = useState<Any[]>([]);
    const [currentAssignment, setCurrentAssignment] = useState<Any>(null);
    const [instrument, setInstrument] = useState<Any>(null);
    const [strategy, setStrategy] = useState("");

    // Questionnaire state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [wraAnswers, setWraAnswers] = useState<Record<number, { source?: number; target?: number }>>({});
    const [answers360, setAnswers360] = useState<Record<number, number>>({});

    const [result, setResult] = useState<Any>(null);

    // ── Login ──
    async function login() {
        setError("");
        const res = await api("/auth/login", undefined, { email, password });
        if (!res.success) return setError(res.error.message);
        setToken(res.data.token);
        setUserName(res.data.user?.name || "");
        const pRes = await api("/projects", res.data.token);
        if (pRes.success) setProjects(pRes.data);
    }

    // ── Select project → load assignments ──
    async function selectProject(p: Any) {
        setProject(p);
        setCurrentAssignment(null);
        setInstrument(null);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");

        const aRes = await api(`/projects/${p.id}/assignments`, token);
        if (aRes.success) setAssignments(aRes.data);
    }

    // ── Pick assignment → load instrument ──
    async function pickAssignment(a: Any) {
        setCurrentAssignment(a);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");

        const res = await api(`/projects/${project.id}`, token);
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
        const isWRA = strategy === "WRA_ABSOLUTE_GAP";

        const items = version.items.map((it: Any) => {
            if (isWRA) {
                const a = wraAnswers[it.id] ?? {};
                return { itemId: it.id, source: a.source ?? 0, target: a.target ?? 0 };
            } else {
                return { itemId: it.id, source: answers360[it.id] ?? 0 };
            }
        });

        const body: Any = { items };
        if (currentAssignment) body.assignmentId = currentAssignment.id;
        const res = await api(`/projects/${project.id}/responses`, token, body);
        if (!res.success) return setError(res.error.message);
        setResult(res.data);
    }

    function goBack() {
        setProject(null);
        setCurrentAssignment(null);
        setAssignments([]);
        setInstrument(null);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");
    }

    function backToAssignments() {
        setCurrentAssignment(null);
        setInstrument(null);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");
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

    // ── Assignment picker ──
    if (project && !currentAssignment) {
        const pending = assignments.filter((a: Any) => !a.response);
        const completed = assignments.filter((a: Any) => a.response);
        return (
            <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 700 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>{project.name}</h2>
                    <button onClick={goBack}>← Projects</button>
                </div>
                {assignments.length === 0 ? (
                    <p>No assignments found for you in this project.</p>
                ) : (
                    <>
                        {pending.length > 0 && (
                            <>
                                <h3>Pending Assignments</h3>
                                {pending.map((a: Any) => (
                                    <div key={a.id} style={{ marginBottom: 8 }}>
                                        <button onClick={() => pickAssignment(a)}>
                                            {a.relationship}: Evaluate {a.target.name}
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                        {completed.length > 0 && (
                            <>
                                <h3 style={{ color: "#666" }}>Completed</h3>
                                {completed.map((a: Any) => (
                                    <div key={a.id} style={{ marginBottom: 4, color: "#999" }}>
                                        ✓ {a.relationship}: {a.target.name} (Response #{a.response.id})
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        );
    }

    // ── Instrument + questionnaire ──
    const version = instrument?.versions?.[0];
    const isWRA = strategy === "WRA_ABSOLUTE_GAP";
    const is360 = strategy === "NORMATIVE_360";
    const allItems: Any[] = version?.items ?? [];
    const totalItems = allItems.length;
    const currentItem = allItems[currentIndex];

    const opts = currentItem ? getScaleOptions(currentItem.scaleType) : [];

    const allAnswered = allItems.every((it: Any) => {
        if (isWRA) {
            const a = wraAnswers[it.id];
            return a?.source !== undefined && a?.target !== undefined;
        } else {
            return answers360[it.id] !== undefined;
        }
    });

    const isLastItem = currentIndex === totalItems - 1;

    return (
        <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 700 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>{project.name}</h2>
                <span style={{ color: "#666" }}>{strategy ? `(${strategy})` : ""}</span>
                <button onClick={backToAssignments}>← Assignments</button>
            </div>
            {currentAssignment && (
                <div style={{ borderLeft: "3px solid #5b8cb8", paddingLeft: 12, marginBottom: 16, fontSize: 13, lineHeight: "1.7" }}>
                    <div><strong>{CS.respondent}:</strong> {userName || email}</div>
                    <div>
                        <strong>{CS.feedbackFor}:</strong>{" "}
                        {currentAssignment.relationship === "SELF"
                            ? CS.selfTarget
                            : currentAssignment.target.name}
                    </div>
                    <div><strong>{CS.relationship}:</strong> {CS.rel[currentAssignment.relationship] || currentAssignment.relationship}</div>
                </div>
            )}

            {!version ? (
                <p>Loading instrument…</p>
            ) : result ? (
                <div>
                    <h3>Item Scores</h3>
                    <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
                        <thead>
                        {isWRA ? (
                            <tr>
                                <th>Item</th>
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
                            ),
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
            ) : (
                <div>
                    <div style={{ marginBottom: 12, color: "#666" }}>
                        Item {currentIndex + 1} of {totalItems}
                    </div>

                    {currentItem && (
                        <div
                            style={{
                                border: "1px solid #ccc",
                                padding: 20,
                                borderRadius: 8,
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ fontSize: 18, marginBottom: 16 }}>
                                <strong>#{currentItem.position}</strong> {currentItem.text}
                                {currentItem.behaviorPolarity && (
                                    <span style={{ color: "#888", marginLeft: 8 }}>({currentItem.behaviorPolarity})</span>
                                )}
                            </div>

                            {isWRA ? (
                                <div>
                                    {renderScaleLegend(currentItem.labelSet, currentItem.scaleType)}
                                    <div style={{ marginBottom: 12 }}>
                                        <strong>Jak to je (SOURCE):</strong>
                                        <div style={{ marginTop: 4 }}>
                                            {opts.map((v) => (
                                                    <label key={v} style={{ marginRight: 12 }}>
                                                        <input
                                                            type="radio"
                                                            name={`source-${currentItem.id}`}
                                                            checked={wraAnswers[currentItem.id]?.source === v}
                                                            onChange={() =>
                                                                setWraAnswers((a) => ({
                                                                    ...a,
                                                                    [currentItem.id]: { ...a[currentItem.id], source: v },
                                                                }))
                                                            }
                                                        />
                                                        {formatOptionLabel(currentItem.labelSet, currentItem.scaleType, v)}
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                    <div>
                                        <strong>Jak bych si přál/a (TARGET):</strong>
                                        <div style={{ marginTop: 4 }}>
                                            {opts.map((v) => (
                                                    <label key={v} style={{ marginRight: 12 }}>
                                                        <input
                                                            type="radio"
                                                            name={`target-${currentItem.id}`}
                                                            checked={wraAnswers[currentItem.id]?.target === v}
                                                            onChange={() =>
                                                                setWraAnswers((a) => ({
                                                                    ...a,
                                                                    [currentItem.id]: { ...a[currentItem.id], target: v },
                                                                }))
                                                            }
                                                        />
                                                        {formatOptionLabel(currentItem.labelSet, currentItem.scaleType, v)}
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {renderScaleLegend(currentItem.labelSet, currentItem.scaleType)}
                                    {opts.map((v) => (
                                        <label key={v} style={{ marginRight: 12 }}>
                                            <input
                                                type="radio"
                                                name={`item-${currentItem.id}`}
                                                checked={answers360[currentItem.id] === v}
                                                onChange={() =>
                                                    setAnswers360((a) => ({ ...a, [currentItem.id]: v }))
                                                }
                                            />
                                            {formatOptionLabel(currentItem.labelSet, currentItem.scaleType, v)}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}

                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            onClick={() => setCurrentIndex((i) => i - 1)}
                            disabled={currentIndex === 0}
                        >
                            ← Prev
                        </button>

                        {isLastItem ? (
                            <button
                                onClick={submit}
                                disabled={!allAnswered}
                                style={{ fontSize: 16, padding: "8px 24px" }}
                            >
                                Submit Response
                            </button>
                        ) : (
                            <button onClick={() => setCurrentIndex((i) => i + 1)}>
                                Next →
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
