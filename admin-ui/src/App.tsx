import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:3001";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const api = async (path: string, token?: string, opts?: { method?: string; body?: unknown }) => {
    const res = await fetch(`${API}${path}`, {
        method: opts?.method ?? (opts?.body ? "POST" : "GET"),
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    return res.json();
};

type Screen =
    | "login"
    | "dashboard"
    | "instruments"
    | "instrument-detail"
    | "version-detail"
    | "projects"
    | "project-detail"
    | "inspector"
    | "inspector-overview"
    | "inspector-responses"
    | "inspector-response-detail";

// ── Styles ──
const S = {
    page: { padding: 24, fontFamily: "monospace", maxWidth: 960 } as const,
    nav: { display: "flex", gap: 12, marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 12 } as const,
    btn: { cursor: "pointer" } as const,
    tbl: { borderCollapse: "collapse" as const, width: "100%" },
    err: { color: "red", marginTop: 8 } as const,
    form: { display: "flex", flexDirection: "column" as const, gap: 8, maxWidth: 400, marginBottom: 16 },
};

export default function App() {
    const [token, setToken] = useState("");
    const [email, setEmail] = useState("pavel@test.cz");
    const [password, setPassword] = useState("heslo");
    const [error, setError] = useState("");
    const [screen, setScreen] = useState<Screen>("login");
    const [inspectorEnabled, setInspectorEnabled] = useState(false);

    // Data
    const [instruments, setInstruments] = useState<Any[]>([]);
    const [currentInstrument, setCurrentInstrument] = useState<Any>(null);
    const [currentVersion, setCurrentVersion] = useState<Any>(null);
    const [projects, setProjects] = useState<Any[]>([]);
    const [currentProject, setCurrentProject] = useState<Any>(null);
    const [inspectorOverview, setInspectorOverview] = useState<Any>(null);
    const [inspectorResponses, setInspectorResponses] = useState<Any[]>([]);
    const [inspectorResponse, setInspectorResponse] = useState<Any>(null);

    // ── Auth ──
    async function login() {
        setError("");
        const res = await api("/auth/login", undefined, { body: { email, password } });
        if (!res.success) return setError(res.error.message);
        setToken(res.data.token);
        const cfg = await api("/admin/config", res.data.token);
        if (cfg.success) setInspectorEnabled(cfg.data.inspectorEnabled);
        setScreen("dashboard");
    }

    function logout() {
        setToken("");
        setScreen("login");
        setInspectorEnabled(false);
    }

    // ── Instruments ──
    const loadInstruments = useCallback(async () => {
        const res = await api("/admin/instruments", token);
        if (res.success) setInstruments(res.data);
    }, [token]);

    async function openInstrument(id: number) {
        // Find from list (versions already included)
        const inst = instruments.find((i: Any) => i.id === id);
        if (inst) { setCurrentInstrument(inst); setScreen("instrument-detail"); }
    }

    async function openVersion(versionId: number) {
        const res = await api(`/admin/versions/${versionId}`, token);
        if (!res.success) return;
        setCurrentVersion(res.data);
        setScreen("version-detail");
    }

    // ── Projects ──
    const loadProjects = useCallback(async () => {
        const res = await api("/admin/projects", token);
        if (res.success) setProjects(res.data);
    }, [token]);

    async function openProject(id: number) {
        const res = await api(`/admin/projects/${id}`, token);
        if (res.success) { setCurrentProject(res.data); setScreen("project-detail"); }
    }

    // ── Inspector ──
    async function inspectorOpenProject(id: number) {
        const res = await api(`/admin/inspector/projects/${id}/overview`, token);
        if (res.success) { setInspectorOverview(res.data); setScreen("inspector-overview"); }
    }

    async function inspectorLoadResponses(projectId: number) {
        const res = await api(`/admin/inspector/projects/${projectId}/responses`, token);
        if (res.success) { setInspectorResponses(res.data); setScreen("inspector-responses"); }
    }

    async function inspectorOpenResponse(responseId: number) {
        const res = await api(`/admin/inspector/responses/${responseId}`, token);
        if (res.success) { setInspectorResponse(res.data); setScreen("inspector-response-detail"); }
    }

    // ── Effects ──
    useEffect(() => {
        if (screen === "instruments" && token) loadInstruments();
        if (screen === "projects" && token) loadProjects();
        if (screen === "inspector" && token) loadProjects();
    }, [screen, token, loadInstruments, loadProjects]);

    // ── Login ──
    if (screen === "login") {
        return (
            <div style={S.page}>
                <h2>WRA Admin — Login</h2>
                <div style={S.form}>
                    <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={login}>Login</button>
                </div>
                {error && <div style={S.err}>{error}</div>}
            </div>
        );
    }

    // ── Nav ──
    const Nav = () => (
        <div style={S.nav}>
            <button onClick={() => setScreen("dashboard")} style={S.btn}><b>Dashboard</b></button>
            <button onClick={() => setScreen("instruments")} style={S.btn}>Instruments</button>
            <button onClick={() => setScreen("projects")} style={S.btn}>Projects</button>
            {inspectorEnabled && <button onClick={() => setScreen("inspector")} style={S.btn}>🔍 DB Inspector</button>}
            <button onClick={logout} style={{ ...S.btn, marginLeft: "auto" }}>Logout</button>
        </div>
    );

    // ── Dashboard ──
    if (screen === "dashboard") {
        return (
            <div style={S.page}><Nav />
                <h2>Dashboard</h2>
                <p>Welcome to WRA Admin. Use the navigation above.</p>
            </div>
        );
    }

    // ── Instruments List ──
    if (screen === "instruments") {
        return (
            <div style={S.page}><Nav />
                <h2>Instruments</h2>
                <CreateInstrumentForm token={token} onCreated={loadInstruments} />
                <table style={S.tbl} border={1} cellPadding={6}>
                    <thead><tr><th>ID</th><th>Name</th><th>Description</th><th>Versions</th><th></th></tr></thead>
                    <tbody>
                    {instruments.map((inst: Any) => (
                        <tr key={inst.id}>
                            <td>{inst.id}</td>
                            <td>{inst.name}</td>
                            <td>{inst.description ?? "—"}</td>
                            <td>{inst.versions?.length ?? 0}</td>
                            <td><button onClick={() => openInstrument(inst.id)}>Open</button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // ── Instrument Detail ──
    if (screen === "instrument-detail" && currentInstrument) {
        const inst = currentInstrument;
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("instruments")}>← Instruments</button>
                <h2>{inst.name}</h2>
                <p>{inst.description ?? ""}</p>
                <h3>Versions</h3>
                <CreateVersionForm token={token} instrumentId={inst.id} onCreated={async () => { await loadInstruments(); openInstrument(inst.id); }} />
                <table style={S.tbl} border={1} cellPadding={6}>
                    <thead><tr><th>ID</th><th>Version</th><th>Strategy</th><th>Active</th><th></th></tr></thead>
                    <tbody>
                    {inst.versions?.map((v: Any) => (
                        <tr key={v.id}>
                            <td>{v.id}</td>
                            <td>{v.versionNumber}</td>
                            <td>{v.scoringStrategy}</td>
                            <td>{v.isActive ? "✓" : "—"}</td>
                            <td>
                                <button onClick={() => openVersion(v.id)}>Items</button>{" "}
                                <CloneVersionButton token={token} versionId={v.id} onCloned={async () => { await loadInstruments(); openInstrument(inst.id); }} />{" "}
                                <ToggleActiveButton token={token} versionId={v.id} isActive={v.isActive} onToggled={async () => { await loadInstruments(); openInstrument(inst.id); }} />
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // ── Version Detail (Items) ──
    if (screen === "version-detail" && currentVersion) {
        const ver = currentVersion;
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("instrument-detail")}>← Version list</button>
                <h2>Version {ver.versionNumber} — Items</h2>
                <CreateItemForm token={token} versionId={ver.id} onCreated={() => openVersion(ver.id)} />
                <table style={S.tbl} border={1} cellPadding={6}>
                    <thead><tr><th>Pos</th><th>ID</th><th>Text</th><th>Construct</th><th>Scale</th><th>Reverse</th><th>Polarity</th><th></th></tr></thead>
                    <tbody>
                    {ver.items?.map((item: Any) => (
                        <tr key={item.id}>
                            <td>{item.position}</td>
                            <td>{item.id}</td>
                            <td>{item.text}</td>
                            <td>{item.construct?.name}</td>
                            <td>{item.scaleType}</td>
                            <td>{item.reverseScored ? "R" : ""}</td>
                            <td>{item.behaviorPolarity ?? ""}</td>
                            <td><EditItemButton token={token} item={item} onUpdated={() => openVersion(ver.id)} /></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // ── Projects List ──
    if (screen === "projects") {
        return (
            <div style={S.page}><Nav />
                <h2>My Projects</h2>
                <CreateProjectForm token={token} onCreated={loadProjects} />
                <table style={S.tbl} border={1} cellPadding={6}>
                    <thead><tr><th>ID</th><th>Name</th><th>Instrument</th><th>Participants</th><th>Responses</th><th></th></tr></thead>
                    <tbody>
                    {projects.map((p: Any) => (
                        <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{p.name}</td>
                            <td>{p.instrumentVersion?.instrument?.name} v{p.instrumentVersion?.versionNumber}</td>
                            <td>{p._count?.participants}</td>
                            <td>{p._count?.responses}</td>
                            <td><button onClick={() => openProject(p.id)}>Open</button></td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // ── Project Detail ──
    if (screen === "project-detail" && currentProject) {
        const p = currentProject;
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("projects")}>← Projects</button>
                <h2>{p.name}</h2>
                <p>{p.instrumentVersion?.instrument?.name} v{p.instrumentVersion?.versionNumber} ({p.instrumentVersion?.scoringStrategy})</p>
                <h3>Participants</h3>
                <AddParticipantForm token={token} projectId={p.id} onAdded={() => openProject(p.id)} />
                <table style={S.tbl} border={1} cellPadding={6}>
                    <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                    <tbody>
                    {p.participants?.map((pt: Any) => (
                        <tr key={pt.id}>
                            <td>{pt.user.id}</td>
                            <td>{pt.user.name}</td>
                            <td>{pt.user.email}</td>
                            <td>{pt.role}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <p style={{ color: "#666", marginTop: 8 }}>Responses: {p._count?.responses}</p>
            </div>
        );
    }

    // ── Inspector: project picker ──
    if (screen === "inspector") {
        return (
            <div style={S.page}><Nav />
                <h2>🔍 DB Inspector</h2>
                <p>Select a project you own:</p>
                {projects.map((p: Any) => (
                    <div key={p.id} style={{ marginBottom: 8 }}>
                        <button onClick={() => inspectorOpenProject(p.id)}>
                            {p.name} — {p.instrumentVersion?.instrument?.name}
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    // ── Inspector: overview ──
    if (screen === "inspector-overview" && inspectorOverview) {
        const { project: p, counts } = inspectorOverview;
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("inspector")}>← Inspector</button>
                <h2>Project: {p.name}</h2>
                <p>{p.instrumentVersion?.instrument?.name} v{p.instrumentVersion?.versionNumber} ({p.instrumentVersion?.scoringStrategy})</p>
                <h3>Participants</h3>
                <ul>
                    {p.participants?.map((pt: Any) => (
                        <li key={pt.id}>{pt.user.name} ({pt.user.email}) — {pt.role}</li>
                    ))}
                </ul>
                <h3>Counts</h3>
                <table border={1} cellPadding={6} style={S.tbl}>
                    <tbody>
                    <tr><td>Responses</td><td>{counts.responses}</td></tr>
                    <tr><td>Response Items</td><td>{counts.responseItems}</td></tr>
                    <tr><td>Item Scores</td><td>{counts.itemScores}</td></tr>
                    <tr><td>Construct Scores</td><td>{counts.constructScores}</td></tr>
                    </tbody>
                </table>
                <button onClick={() => inspectorLoadResponses(p.id)} style={{ marginTop: 16 }}>
                    View Responses →
                </button>
            </div>
        );
    }

    // ── Inspector: responses list ──
    if (screen === "inspector-responses") {
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("inspector-overview")}>← Overview</button>
                <h2>Responses</h2>
                {inspectorResponses.length === 0 ? <p>No responses yet.</p> : (
                    <table border={1} cellPadding={6} style={S.tbl}>
                        <thead><tr><th>ID</th><th>Respondent</th><th>Created</th><th></th></tr></thead>
                        <tbody>
                        {inspectorResponses.map((r: Any) => (
                            <tr key={r.responseId}>
                                <td>{r.responseId}</td>
                                <td>{r.respondent.name} ({r.respondent.email})</td>
                                <td>{new Date(r.createdAt).toLocaleString()}</td>
                                <td><button onClick={() => inspectorOpenResponse(r.responseId)}>Detail</button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    // ── Inspector: response detail ──
    if (screen === "inspector-response-detail" && inspectorResponse) {
        const r = inspectorResponse;
        return (
            <div style={S.page}><Nav />
                <button onClick={() => setScreen("inspector-responses")}>← Responses</button>
                <h2>Response #{r.responseId}</h2>
                <p>Respondent: {r.respondent.name} ({r.respondent.email}) | {new Date(r.createdAt).toLocaleString()}</p>

                <h3>Response Items</h3>
                <table border={1} cellPadding={4} style={S.tbl}>
                    <thead><tr><th>Pos</th><th>Item</th><th>Text</th><th>Channel</th><th>Value</th><th>Construct</th></tr></thead>
                    <tbody>
                    {r.responseItems?.map((ri: Any, i: number) => (
                        <tr key={i}>
                            <td>{ri.position}</td>
                            <td>{ri.itemId}</td>
                            <td>{ri.text}</td>
                            <td>{ri.channel}</td>
                            <td>{ri.value}</td>
                            <td>{ri.construct}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                <h3>Item Scores</h3>
                <table border={1} cellPadding={4} style={S.tbl}>
                    <thead><tr><th>Item</th><th>Text</th><th>Source</th><th>Target</th><th>Gap</th><th>|Gap|</th></tr></thead>
                    <tbody>
                    {r.itemScores?.map((is: Any, i: number) => (
                        <tr key={i}>
                            <td>{is.itemId}</td>
                            <td>{is.text}</td>
                            <td>{is.sourceValue ?? "—"}</td>
                            <td>{is.targetValue ?? "—"}</td>
                            <td>{is.gapValue ?? "—"}</td>
                            <td>{is.absoluteGapValue ?? "—"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                <h3>Construct Scores</h3>
                <table border={1} cellPadding={4} style={S.tbl}>
                    <thead><tr><th>Construct</th><th>Source Mean</th><th>Target Mean</th><th>Gap Mean</th><th>Mean |Gap|</th></tr></thead>
                    <tbody>
                    {r.constructScores?.map((cs: Any, i: number) => (
                        <tr key={i}>
                            <td>{cs.construct}</td>
                            <td>{cs.sourceMean?.toFixed(4) ?? "—"}</td>
                            <td>{cs.targetMean?.toFixed(4) ?? "—"}</td>
                            <td>{cs.gapMean?.toFixed(4) ?? "—"}</td>
                            <td>{cs.meanAbsoluteGap?.toFixed(4) ?? "—"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                <h3>Global Score</h3>
                {r.globalScore ? (
                    <table border={1} cellPadding={4} style={S.tbl}>
                        <tbody>
                        <tr><td>Global Source Mean</td><td>{r.globalScore.globalSourceMean?.toFixed(4)}</td></tr>
                        <tr><td>Global Target Mean</td><td>{r.globalScore.globalTargetMean?.toFixed(4) ?? "—"}</td></tr>
                        <tr><td>Global Gap Mean</td><td>{r.globalScore.globalGapMean?.toFixed(4) ?? "—"}</td></tr>
                        <tr><td>Global Mean |Gap|</td><td>{r.globalScore.globalMeanAbsoluteGap?.toFixed(4) ?? "—"}</td></tr>
                        <tr><td>Model Version</td><td>{r.globalScore.scoringModelVersion}</td></tr>
                        </tbody>
                    </table>
                ) : <p>No global score.</p>}
            </div>
        );
    }

    return <div style={S.page}><Nav /><p>Unknown screen</p></div>;
}

// ── Inline sub-components ──

function CreateInstrumentForm({ token, onCreated }: { token: string; onCreated: () => void }) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [err, setErr] = useState("");
    async function submit() {
        setErr("");
        const res = await api("/admin/instruments", token, { body: { name, description: desc || undefined } });
        if (!res.success) return setErr(res.error.message);
        setName(""); setDesc(""); onCreated();
    }
    return (
        <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
            <b>Create Instrument</b>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <button onClick={submit}>Create</button>
            </div>
            {err && <div style={S.err}>{err}</div>}
        </div>
    );
}

function CreateVersionForm({ token, instrumentId, onCreated }: { token: string; instrumentId: number; onCreated: () => void }) {
    const [ver, setVer] = useState("");
    const [strategy, setStrategy] = useState("WRA_ABSOLUTE_GAP");
    const [err, setErr] = useState("");
    async function submit() {
        setErr("");
        const res = await api(`/admin/instruments/${instrumentId}/versions`, token, { body: { versionNumber: ver, scoringStrategy: strategy } });
        if (!res.success) return setErr(res.error.message);
        setVer(""); onCreated();
    }
    return (
        <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
            <b>Create Version</b>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Version (e.g. 2.0)" value={ver} onChange={(e) => setVer(e.target.value)} />
                <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                    <option value="WRA_ABSOLUTE_GAP">WRA_ABSOLUTE_GAP</option>
                    <option value="NORMATIVE_360">NORMATIVE_360</option>
                </select>
                <button onClick={submit}>Create</button>
            </div>
            {err && <div style={S.err}>{err}</div>}
        </div>
    );
}

function CloneVersionButton({ token, versionId, onCloned }: { token: string; versionId: number; onCloned: () => void }) {
    async function clone() {
        const ver = prompt("New version number:");
        if (!ver) return;
        const res = await api(`/admin/versions/${versionId}/clone`, token, { body: { versionNumber: ver } });
        if (res.success) onCloned();
        else alert(res.error.message);
    }
    return <button onClick={clone}>Clone</button>;
}

function CreateItemForm({ token, versionId, onCreated }: { token: string; versionId: number; onCreated: () => void }) {
    const [text, setText] = useState("");
    const [constructId, setConstructId] = useState("");
    const [scale, setScale] = useState("LIKERT_5");
    const [labelSet, setLabelSet] = useState("");
    const [constructs, setConstructs] = useState<Any[]>([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        api("/admin/constructs", token).then((res) => {
            if (res.success) setConstructs(res.data);
        });
    }, [token]);

    async function submit() {
        setErr("");
        const cid = parseInt(constructId, 10);
        if (isNaN(cid)) return setErr("Select a construct");
        const body: Any = { constructId: cid, text, scaleType: scale };
        if (labelSet) body.labelSet = labelSet;
        const res = await api(`/admin/versions/${versionId}/items`, token, { body });
        if (!res.success) return setErr(res.error.message);
        setText(""); onCreated();
    }
    return (
        <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
            <b>Add Item</b>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <input placeholder="Text" value={text} onChange={(e) => setText(e.target.value)} style={{ minWidth: 200 }} />
                <select value={constructId} onChange={(e) => setConstructId(e.target.value)}>
                    <option value="">— Construct —</option>
                    {constructs.map((c: Any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select value={scale} onChange={(e) => setScale(e.target.value)}>
                    <option value="YES_NO">Yes / No (0–1)</option>
                    <option value="SCALE_3">Scale 1–3</option>
                    <option value="LIKERT_5">Likert 1–5</option>
                    <option value="SCALE_6">Scale 1–6</option>
                    <option value="LIKERT_7">Likert 1–7</option>
                    <option value="SCALE_10">Scale 1–10</option>
                    <option value="TEXT">Text (no scoring)</option>
                </select>
                <select value={labelSet} onChange={(e) => setLabelSet(e.target.value)}>
                    <option value="">— Label Set (optional) —</option>
                    <option value="AGREEMENT">Agreement</option>
                    <option value="FREQUENCY">Frequency</option>
                    <option value="QUALITY">Quality</option>
                    <option value="IMPORTANCE">Importance</option>
                </select>
                <button onClick={submit}>Add</button>
            </div>
            {err && <div style={S.err}>{err}</div>}
        </div>
    );
}

function ToggleActiveButton({ token, versionId, isActive, onToggled }: { token: string; versionId: number; isActive: boolean; onToggled: () => void }) {
    async function toggle() {
        if (isActive && !confirm("Deactivating will hide this version from clients. Continue?")) return;
        const res = await api(`/admin/versions/${versionId}`, token, { method: "PATCH", body: { isActive: !isActive } });
        if (res.success) onToggled();
        else alert(res.error.message);
    }
    return (
        <button onClick={toggle} style={{ color: isActive ? "#a00" : "#080" }}>
            {isActive ? "Deactivate" : "Activate"}
        </button>
    );
}

function EditItemButton({ token, item, onUpdated }: { token: string; item: Any; onUpdated: () => void }) {
    async function edit() {
        const newText = prompt("Item text:", item.text);
        if (newText === null) return;
        const res = await api(`/admin/items/${item.id}`, token, { method: "PATCH", body: { text: newText } });
        if (res.success) onUpdated();
        else alert(res.error.message);
    }
    return <button onClick={edit}>Edit</button>;
}

function CreateProjectForm({ token, onCreated }: { token: string; onCreated: () => void }) {
    const [name, setName] = useState("");
    const [ivId, setIvId] = useState("");
    const [instruments, setInstruments] = useState<Any[]>([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        api("/admin/instruments", token).then((res) => {
            if (res.success) setInstruments(res.data);
        });
    }, [token]);

    async function submit() {
        setErr("");
        const id = parseInt(ivId, 10);
        if (isNaN(id)) return setErr("Select an instrument version");
        const res = await api("/admin/projects", token, { body: { name, instrumentVersionId: id } });
        if (!res.success) return setErr(res.error.message);
        setName(""); setIvId(""); onCreated();
    }
    return (
        <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
            <b>Create Project</b>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
                <select value={ivId} onChange={(e) => setIvId(e.target.value)}>
                    <option value="">— Instrument Version —</option>
                    {instruments.map((inst: Any) =>
                        (inst.versions ?? []).map((v: Any) => (
                            <option key={v.id} value={v.id}>
                                {inst.name} — v{v.versionNumber}{v.isActive ? "" : " (inactive)"}
                            </option>
                        ))
                    )}
                </select>
                <button onClick={submit}>Create</button>
            </div>
            {err && <div style={S.err}>{err}</div>}
        </div>
    );
}

function AddParticipantForm({ token, projectId, onAdded }: { token: string; projectId: number; onAdded: () => void }) {
    const [email, setEmail] = useState("");
    const [err, setErr] = useState("");
    async function submit() {
        setErr("");
        const res = await api(`/admin/projects/${projectId}/participants`, token, { body: { email } });
        if (!res.success) return setErr(res.error.message);
        setEmail(""); onAdded();
    }
    return (
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <input placeholder="Email to add" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={submit}>Add Participant</button>
            {err && <span style={S.err}>{err}</span>}
        </div>
    );
}
