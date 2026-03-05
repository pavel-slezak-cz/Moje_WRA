/**
 * RBAC Hardening Tests
 * Covers: projectId bypass, assignment ownership (non-owner participant),
 * role change immediacy, error hygiene, data minimization, default-deny.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/db";
import { hashPassword } from "../src/utils/hash";

// ── Test fixtures ──

let suToken = "";
let staffToken = "";
let resp1Token = "";   // evaluator
let resp2Token = "";   // participant but NOT evaluator

let suUserId = 0;
let staffUserId = 0;
let resp1UserId = 0;
let resp2UserId = 0;
let testProjectId = 0;
let testAssignmentId = 0;   // resp1's assignment
let testInstrumentVersionId = 0;

// A second project that STAFF is NOT assigned to
let unassignedProjectId = 0;

const TS = Date.now();
const SU_EMAIL = `h-su-${TS}@test.cz`;
const STAFF_EMAIL = `h-staff-${TS}@test.cz`;
const RESP1_EMAIL = `h-resp1-${TS}@test.cz`;
const RESP2_EMAIL = `h-resp2-${TS}@test.cz`;
const PASSWORD = "hardenpass1";

async function loginUser(email: string): Promise<string> {
    const res = await request(app)
        .post("/auth/login")
        .send({ email, password: PASSWORD });
    return res.body.data.token;
}

beforeAll(async () => {
    const hash = await hashPassword(PASSWORD);

    const su = await prisma.user.create({ data: { email: SU_EMAIL, name: "H-SU", passwordHash: hash, role: "SUPERUSER" } });
    const staff = await prisma.user.create({ data: { email: STAFF_EMAIL, name: "H-Staff", passwordHash: hash, role: "STAFF" } });
    const resp1 = await prisma.user.create({ data: { email: RESP1_EMAIL, name: "H-Resp1", passwordHash: hash, role: "RESPONDENT" } });
    const resp2 = await prisma.user.create({ data: { email: RESP2_EMAIL, name: "H-Resp2", passwordHash: hash, role: "RESPONDENT" } });

    suUserId = su.id;
    staffUserId = staff.id;
    resp1UserId = resp1.id;
    resp2UserId = resp2.id;

    suToken = await loginUser(SU_EMAIL);
    staffToken = await loginUser(STAFF_EMAIL);
    resp1Token = await loginUser(RESP1_EMAIL);
    resp2Token = await loginUser(RESP2_EMAIL);

    // Create instrument + version
    const instrument = await prisma.instrument.create({ data: { name: `H-Inst-${TS}` } });
    const version = await prisma.instrumentVersion.create({
        data: { instrumentId: instrument.id, versionNumber: "1.0", scoringStrategy: "WRA_ABSOLUTE_GAP", isActive: true },
    });
    testInstrumentVersionId = version.id;

    // Create project (via API as SUPERUSER)
    const projRes = await request(app)
        .post("/admin/projects")
        .set("Authorization", `Bearer ${suToken}`)
        .send({ name: `H-Proj-${TS}`, instrumentVersionId: version.id });
    testProjectId = projRes.body.data.id;

    // Grant STAFF access to this project
    await prisma.projectStaffAccess.create({ data: { userId: staffUserId, projectId: testProjectId } });

    // Both respondents are participants
    await prisma.projectParticipant.create({ data: { projectId: testProjectId, userId: resp1UserId, role: "PARTICIPANT" } });
    await prisma.projectParticipant.create({ data: { projectId: testProjectId, userId: resp2UserId, role: "PARTICIPANT" } });

    // Only resp1 is the evaluator of the assignment
    const assignment = await prisma.evaluationAssignment.create({
        data: { projectId: testProjectId, respondentUserId: resp1UserId, targetUserId: resp1UserId, relationship: "SELF" },
    });
    testAssignmentId = assignment.id;

    // Create unassigned project (STAFF does NOT have access)
    const unassigned = await prisma.project.create({
        data: { name: `H-Unassigned-${TS}`, ownerUserId: suUserId, instrumentVersionId: version.id },
    });
    unassignedProjectId = unassigned.id;
});

afterAll(async () => {
    await prisma.evaluationAssignment.deleteMany({ where: { projectId: testProjectId } });
    await prisma.projectParticipant.deleteMany({ where: { projectId: { in: [testProjectId, unassignedProjectId] } } });
    await prisma.projectStaffAccess.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { id: { in: [testProjectId, unassignedProjectId] } } });
    await prisma.instrumentVersion.deleteMany({ where: { id: testInstrumentVersionId } });
    await prisma.instrument.deleteMany({ where: { name: `H-Inst-${TS}` } });
    await prisma.user.deleteMany({ where: { id: { in: [suUserId, staffUserId, resp1UserId, resp2UserId] } } });
    await prisma.$disconnect();
});

// ═══════════════════════════════════════════════
// 1. Project admin access: no "missing projectId" bypass
// ═══════════════════════════════════════════════

describe("1. projectId bypass protection", () => {
    it("Non-numeric projectId → 400 INVALID_ID", async () => {
        const res = await request(app)
            .get("/admin/projects/abc")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_ID");
    });

    it("Negative projectId → 403 (no staff access for negative IDs)", async () => {
        const res = await request(app)
            .get("/admin/projects/-1")
            .set("Authorization", `Bearer ${staffToken}`);
        // parseInt("-1") = -1, valid number but no staff access
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PROJECT_ADMIN_ACCESS_DENIED");
    });

    it("Zero projectId → 403 (no staff access)", async () => {
        const res = await request(app)
            .get("/admin/projects/0")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
    });

    it("SUPERUSER bypasses projectAdminAccess even with nonexistent ID", async () => {
        const res = await request(app)
            .get("/admin/projects/999999")
            .set("Authorization", `Bearer ${suToken}`);
        // Passes middleware, controller returns 404
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
    });
});

// ═══════════════════════════════════════════════
// 2. Assignment ownership: prevent indirect access via project membership
// ═══════════════════════════════════════════════

describe("2. Assignment ownership — strict evaluator check", () => {
    it("Participant (resp2) in same project CANNOT access resp1's assignment", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${resp2Token}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ASSIGNMENT_ACCESS_DENIED");
    });

    it("Evaluator (resp1) CAN access own assignment", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(200);
    });

    it("STAFF without evaluator role CANNOT access assignment", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ASSIGNMENT_ACCESS_DENIED");
    });

    it("Nonexistent assignment → 404", async () => {
        const res = await request(app)
            .get("/assignments/999999/instrument")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("/me/assignments returns ONLY evaluator's assignments", async () => {
        const res = await request(app)
            .get("/me/assignments")
            .set("Authorization", `Bearer ${resp2Token}`);
        expect(res.status).toBe(200);
        // resp2 has no assignments — should be empty
        const ids = res.body.data.map((a: { id: number }) => a.id);
        expect(ids).not.toContain(testAssignmentId);
    });
});

// ═══════════════════════════════════════════════
// 3. Role changes take effect immediately
// ═══════════════════════════════════════════════

describe("3. Role changes take effect immediately (DB lookup)", () => {
    it("Demote STAFF → RESPONDENT: admin access revoked immediately", async () => {
        // staffToken was issued when user was STAFF
        // Verify access works before demotion
        const before = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(before.status).toBe(200);

        // Demote in DB
        await prisma.user.update({ where: { id: staffUserId }, data: { role: "RESPONDENT" } });

        // Same token, now blocked
        const after = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(after.status).toBe(403);
        expect(after.body.error.code).toBe("ADMIN_ACCESS_DENIED");

        // Restore role for remaining tests
        await prisma.user.update({ where: { id: staffUserId }, data: { role: "STAFF" } });
    });

    it("Promote RESPONDENT → STAFF: admin access granted immediately", async () => {
        // resp2 is RESPONDENT
        const before = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${resp2Token}`);
        expect(before.status).toBe(403);

        // Promote in DB
        await prisma.user.update({ where: { id: resp2UserId }, data: { role: "STAFF" } });

        const after = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${resp2Token}`);
        expect(after.status).toBe(200);
        expect(after.body.data.role).toBe("STAFF");

        // Restore
        await prisma.user.update({ where: { id: resp2UserId }, data: { role: "RESPONDENT" } });
    });

    it("Deleted user → 401 TOKEN_INVALID", async () => {
        // Create a temporary user, login, delete, test
        const hash = await hashPassword(PASSWORD);
        const tmp = await prisma.user.create({
            data: { email: `h-tmp-${TS}@test.cz`, name: "TMP", passwordHash: hash, role: "RESPONDENT" },
        });
        const tmpToken = await loginUser(`h-tmp-${TS}@test.cz`);

        // Delete user from DB
        await prisma.user.delete({ where: { id: tmp.id } });

        const res = await request(app)
            .get("/me/assignments")
            .set("Authorization", `Bearer ${tmpToken}`);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("TOKEN_INVALID");
    });
});

// ═══════════════════════════════════════════════
// 5. Error hygiene: no stack traces, consistent format
// ═══════════════════════════════════════════════

describe("5. Error hygiene", () => {
    it("403 response contains only { success, error: { message, code } }", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toBeDefined();
        expect(res.body.error.code).toBeDefined();
        // Must NOT contain stack traces or internal info
        expect(res.body.error.stack).toBeUndefined();
        expect(res.body.error.details).toBeUndefined();
    });

    it("404 response for nonexistent project is clean", async () => {
        const res = await request(app)
            .get("/admin/projects/999999")
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error.stack).toBeUndefined();
        expect(typeof res.body.error.message).toBe("string");
    });

    it("401 response for invalid token is clean", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", "Bearer invalid.jwt.token");
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("TOKEN_INVALID");
        expect(res.body.error.stack).toBeUndefined();
    });

    it("400 for bad validation does not leak internals", async () => {
        const res = await request(app)
            .post("/admin/projects")
            .set("Authorization", `Bearer ${suToken}`)
            .send({});  // missing required fields
        expect(res.status).toBe(400);
        expect(res.body.error.stack).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════
// 7. Data minimization
// ═══════════════════════════════════════════════

describe("7. Data minimization", () => {
    it("/admin/config returns only { role, inspectorEnabled }", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
        const keys = Object.keys(res.body.data);
        expect(keys).toContain("role");
        expect(keys).toContain("inspectorEnabled");
        // Must not leak email, userId, passwordHash, etc.
        expect(res.body.data.email).toBeUndefined();
        expect(res.body.data.userId).toBeUndefined();
        expect(res.body.data.passwordHash).toBeUndefined();
    });

    it("/me/assignments does not leak target.email", async () => {
        const res = await request(app)
            .get("/me/assignments")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(200);
        for (const a of res.body.data) {
            expect(a.target.email).toBeUndefined();
            expect(a.target.name).toBeDefined();
            expect(a.target.id).toBeDefined();
        }
    });

    it("/me/assignments does not include participants, scoring keys, or internal notes", async () => {
        const res = await request(app)
            .get("/me/assignments")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(200);
        for (const a of res.body.data) {
            // No participants list
            expect(a.project.participants).toBeUndefined();
            // No scoring keys
            expect(a.project.instrumentVersion.items).toBeUndefined();
            // No owner info
            expect(a.project.ownerUserId).toBeUndefined();
        }
    });
});

// ═══════════════════════════════════════════════
// 8. Default-deny / abuse run
// ═══════════════════════════════════════════════

describe("8. Default-deny abuse run", () => {
    // RESPONDENT abuse checks
    it("RESPONDENT → GET /instruments → 403", async () => {
        const res = await request(app)
            .get("/instruments")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(403);
    });

    it("RESPONDENT → GET /questionnaires → 403", async () => {
        const res = await request(app)
            .get("/questionnaires")
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(403);
    });

    it("RESPONDENT → PATCH /admin/projects/:id → 403", async () => {
        const res = await request(app)
            .patch(`/admin/projects/${testProjectId}`)
            .set("Authorization", `Bearer ${resp1Token}`)
            .send({ name: "hacked" });
        expect(res.status).toBe(403);
    });

    it("RESPONDENT → DELETE /admin/assignments/:id → 403", async () => {
        const res = await request(app)
            .delete(`/admin/assignments/${testAssignmentId}`)
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(403);
    });

    it("RESPONDENT → GET /admin/projects/:id/instrument → 403", async () => {
        const res = await request(app)
            .get(`/admin/projects/${testProjectId}/instrument`)
            .set("Authorization", `Bearer ${resp1Token}`);
        expect(res.status).toBe(403);
    });

    // STAFF abuse: unassigned project
    it("STAFF → PATCH /admin/projects/:unassigned → 403", async () => {
        const res = await request(app)
            .patch(`/admin/projects/${unassignedProjectId}`)
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ name: "sneaky" });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PROJECT_ADMIN_ACCESS_DENIED");
    });

    it("STAFF → POST /admin/projects/:unassigned/participants → 403", async () => {
        const res = await request(app)
            .post(`/admin/projects/${unassignedProjectId}/participants`)
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ email: "x@y.z" });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("PROJECT_ADMIN_ACCESS_DENIED");
    });

    it("STAFF → GET /admin/projects/:unassigned/assignments → 403", async () => {
        const res = await request(app)
            .get(`/admin/projects/${unassignedProjectId}/assignments`)
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
    });

    it("STAFF → PATCH /admin/users/:id/role → 403 (SUPERUSER only)", async () => {
        const res = await request(app)
            .patch(`/admin/users/${resp1UserId}/role`)
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ role: "STAFF" });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SUPERUSER_ONLY");
    });

    // No auth at all
    it("No token → /me/assignments → 401", async () => {
        const res = await request(app).get("/me/assignments");
        expect(res.status).toBe(401);
    });

    it("No token → /assignments/:id/instrument → 401", async () => {
        const res = await request(app).get(`/assignments/${testAssignmentId}/instrument`);
        expect(res.status).toBe(401);
    });

    it("No token → /projects/:id/responses → 401", async () => {
        const res = await request(app).get(`/projects/${testProjectId}/responses`);
        expect(res.status).toBe(401);
    });

    // Health check is intentionally public
    it("GET /health → 200 (intentionally public)", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
    });
});
