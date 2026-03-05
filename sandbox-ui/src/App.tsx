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
    // Assignment context header
    respondent: "Odpovídá",
    feedbackFor: "Dává zpětnou vazbu pro",
    relationship: "Vztah",
    selfTarget: "sebe",
    rel: {
        SELF: "Sebehodnocení",
        MANAGER: "Vedoucí → Podřízený",
        PEER: "Kolega → Kolega",
        SUBORDINATE: "Podřízený → Vedoucí",
    } as Record<string, string>,
    // WRA scale prompts
    sourcePrompt: "Jak často se to děje dnes?",
    targetPrompt: "Jak často bych si to přál.",
    // Navigation & controls
    prev: "← Zpět",
    next: "Další →",
    submitBtn: "Odeslat",
    back: "Zpět",
    // Status & messages
    completed: "Vyplněno",
    alreadyCompleted: "Tento dotazník byl již vyplněn.",
    thankYou: "Děkujeme za vyplnění dotazníku.",
    missingAnswers: "Ještě nemáte zodpovězené všechny otázky.",
    logout: "Odhlásit se",
    noAssignments: "Žádné přiřazené dotazníky.",
    pendingHeading: "Dotazníky k vyplnění",
    evaluate: (rel: string, name: string) => `${rel}: ${name}`,
    itemOf: (n: number, total: number) => `Otázka ${n} z ${total}`,
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

    const [allAssignments, setAllAssignments] = useState<Any[]>([]);
    const [currentAssignment, setCurrentAssignment] = useState<Any>(null);
    const [currentProject, setCurrentProject] = useState<Any>(null);
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
        const aRes = await api("/me/assignments", res.data.token);
        if (aRes.success) setAllAssignments(aRes.data);
    }

    // ── Pick assignment → load instrument via /assignments/:id/instrument ──
    async function pickAssignment(a: Any) {
        setCurrentAssignment(a);
        setCurrentProject(a.project);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");

        const res = await api(`/assignments/${a.id}/instrument`, token);
        if (!res.success) return;

        // Response: { id, versionNumber, scoringStrategy, instrument, items[], project }
        setInstrument({ ...res.data.instrument, versions: [res.data] });
        setStrategy(res.data.scoringStrategy || "");
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
        const projectId = currentAssignment?.project?.id ?? currentProject?.id;
        const res = await api(`/projects/${projectId}/responses`, token, body);
        if (!res.success) return setError(res.error.message);
        setResult(res.data);
    }

    async function backToAssignments() {
        setCurrentAssignment(null);
        setCurrentProject(null);
        setInstrument(null);
        setResult(null);
        setWraAnswers({});
        setAnswers360({});
        setCurrentIndex(0);
        setStrategy("");
        // Re-fetch to reflect newly completed assignments
        const aRes = await api("/me/assignments", token);
        if (aRes.success) setAllAssignments(aRes.data);
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

    // ── Assignment selector (grouped by project) ──
    if (!currentAssignment) {
        // Group assignments by project
        const byProject = new Map<number, { project: Any; assignments: Any[] }>();
        for (const a of allAssignments) {
            const pid = a.project.id;
            if (!byProject.has(pid)) byProject.set(pid, { project: a.project, assignments: [] });
            byProject.get(pid)!.assignments.push(a);
        }

        return (
            <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 700 }}>
                <h2>Moje dotazníky</h2>

                {allAssignments.length === 0 ? (
                    <p>{CS.noAssignments}</p>
                ) : (
                    [...byProject.values()].map(({ project: proj, assignments: projAssignments }) => {
                        const pending = projAssignments.filter((a: Any) => !a.response);
                        const completed = projAssignments.filter((a: Any) => a.response);
                        return (
                            <div key={proj.id} style={{ marginBottom: 24 }}>
                                <h3 style={{ margin: "0 0 8px" }}>{proj.name}</h3>
                                {proj.introText && (
                                    <div style={{ padding: 14, background: "#f7f9fb", borderLeft: "3px solid #5b8cb8", borderRadius: 4, marginBottom: 12, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                        {proj.introText}
                                    </div>
                                )}
                                {pending.length > 0 && (
                                    <>
                                        <h4 style={{ margin: "0 0 6px" }}>{CS.pendingHeading}</h4>
                                        {pending.map((a: Any) => (
                                            <div key={a.id} style={{ marginBottom: 10 }}>
                                                <button
                                                    onClick={() => pickAssignment(a)}
                                                    style={{
                                                        display: "block",
                                                        width: "100%",
                                                        padding: "14px 18px",
                                                        fontSize: 15,
                                                        textAlign: "left",
                                                        cursor: "pointer",
                                                        border: "1px solid #ccc",
                                                        borderRadius: 6,
                                                        background: "#fff",
                                                    }}
                                                >
                                                    {CS.evaluate(
                                                        CS.rel[a.relationship] || a.relationship,
                                                        a.relationship === "SELF" ? CS.selfTarget : a.target.name,
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {completed.length > 0 && (
                                    <>
                                        <h4 style={{ color: "#666", margin: "8px 0 4px" }}>{CS.completed}</h4>
                                        {completed.map((a: Any) => (
                                            <div key={a.id} style={{
                                                marginBottom: 6,
                                                padding: "10px 18px",
                                                fontSize: 14,
                                                color: "#888",
                                                background: "#f5f5f5",
                                                borderRadius: 6,
                                                border: "1px solid #e0e0e0",
                                            }}>
                                                ✓ {CS.rel[a.relationship] || a.relationship}: {a.relationship === "SELF" ? CS.selfTarget : a.target.name} — {CS.completed}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        );
                    })
                )}

                <button
                    onClick={() => { setToken(""); setAllAssignments([]); }}
                    style={{ marginTop: 24, padding: "10px 20px", fontSize: 14 }}
                >
                    {CS.logout}
                </button>
            </div>
        );
    }

    // ── Instrument + questionnaire ──
    const project = currentProject ?? currentAssignment?.project;
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
                <h2 style={{ margin: 0 }}>{project?.name}</h2>
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

            {currentAssignment?.response ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 16, color: "#666" }}>{CS.alreadyCompleted}</p>
                    <button onClick={backToAssignments}>{CS.back}</button>
                </div>
            ) : !version ? (
                <p>Loading instrument…</p>
            ) : result ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: 18 }}>{CS.thankYou}</p>
                    <button onClick={backToAssignments} style={{ marginTop: 16, padding: "8px 24px" }}>{CS.back}</button>
                </div>
            ) : (
                <div>
                    <div style={{ marginBottom: 12, color: "#666" }}>
                        {CS.itemOf(currentIndex + 1, totalItems)}
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
                                        <strong>{CS.sourcePrompt}</strong>
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
                                        <strong>{CS.targetPrompt}</strong>
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
                            {CS.prev}
                        </button>

                        {isLastItem ? (
                            <>
                                <button
                                    onClick={submit}
                                    disabled={!allAnswered}
                                    style={{ fontSize: 16, padding: "8px 24px" }}
                                >
                                    {CS.submitBtn}
                                </button>
                                {!allAnswered && (
                                    <span style={{ color: "#b00", fontSize: 13 }}>{CS.missingAnswers}</span>
                                )}
                            </>
                        ) : (
                            <button onClick={() => setCurrentIndex((i) => i + 1)}>
                                {CS.next}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
