import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/db";
import { hashPassword } from "../src/utils/hash";

// ── Test user tokens ──
let suToken = "";     // SUPERUSER
let staffToken = "";  // STAFF
let respToken = "";   // RESPONDENT

let suUserId = 0;
let staffUserId = 0;
let respUserId = 0;
let testProjectId = 0;
let testAssignmentId = 0;
let testInstrumentVersionId = 0;

const TS = Date.now();
const SU_EMAIL = `su-${TS}@test.cz`;
const STAFF_EMAIL = `staff-${TS}@test.cz`;
const RESP_EMAIL = `resp-${TS}@test.cz`;
const PASSWORD = "testpass123";

async function loginUser(email: string): Promise<string> {
    const res = await request(app)
        .post("/auth/login")
        .send({ email, password: PASSWORD });
    return res.body.data.token;
}

beforeAll(async () => {
    const hash = await hashPassword(PASSWORD);

    // Create test users with appropriate roles
    const su = await prisma.user.create({
        data: { email: SU_EMAIL, name: "Test SU", passwordHash: hash, role: "SUPERUSER" },
    });
    const staff = await prisma.user.create({
        data: { email: STAFF_EMAIL, name: "Test Staff", passwordHash: hash, role: "STAFF" },
    });
    const resp = await prisma.user.create({
        data: { email: RESP_EMAIL, name: "Test Resp", passwordHash: hash, role: "RESPONDENT" },
    });

    suUserId = su.id;
    staffUserId = staff.id;
    respUserId = resp.id;

    suToken = await loginUser(SU_EMAIL);
    staffToken = await loginUser(STAFF_EMAIL);
    respToken = await loginUser(RESP_EMAIL);

    // Create test instrument + version (needed for project)
    const instrument = await prisma.instrument.create({
        data: { name: `RBAC-Test-Inst-${TS}` },
    });
    const version = await prisma.instrumentVersion.create({
        data: {
            instrumentId: instrument.id,
            versionNumber: "1.0",
            scoringStrategy: "WRA_ABSOLUTE_GAP",
            isActive: true,
        },
    });
    testInstrumentVersionId = version.id;

    // Create test project (as SUPERUSER via API)
    const projRes = await request(app)
        .post("/admin/projects")
        .set("Authorization", `Bearer ${suToken}`)
        .send({ name: `RBAC-Test-Proj-${TS}`, instrumentVersionId: version.id });
    testProjectId = projRes.body.data.id;

    // Grant STAFF access to the project
    await prisma.projectStaffAccess.create({
        data: { userId: staffUserId, projectId: testProjectId },
    });

    // Add respondent as participant + create assignment
    await prisma.projectParticipant.create({
        data: { projectId: testProjectId, userId: respUserId, role: "PARTICIPANT" },
    });
    const assignment = await prisma.evaluationAssignment.create({
        data: {
            projectId: testProjectId,
            respondentUserId: respUserId,
            targetUserId: respUserId,
            relationship: "SELF",
        },
    });
    testAssignmentId = assignment.id;
});

afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.evaluationAssignment.deleteMany({ where: { projectId: testProjectId } });
    await prisma.projectParticipant.deleteMany({ where: { projectId: testProjectId } });
    await prisma.projectStaffAccess.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });
    await prisma.instrumentVersion.deleteMany({ where: { id: testInstrumentVersionId } });
    // Clean up instrument (find by name)
    await prisma.instrument.deleteMany({ where: { name: `RBAC-Test-Inst-${TS}` } });
    await prisma.user.deleteMany({ where: { id: { in: [suUserId, staffUserId, respUserId] } } });
    await prisma.$disconnect();
});

// ── 1. RESPONDENT cannot access /admin/* ──

describe("RESPONDENT blocked from /admin/*", () => {
    it("GET /admin/config → 403", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ADMIN_ACCESS_DENIED");
    });

    it("GET /admin/projects → 403", async () => {
        const res = await request(app)
            .get("/admin/projects")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(403);
    });

    it("GET /admin/instruments → 403", async () => {
        const res = await request(app)
            .get("/admin/instruments")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(403);
    });

    it("GET /admin/users → 403", async () => {
        const res = await request(app)
            .get("/admin/users")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(403);
    });

    it("POST /admin/projects → 403", async () => {
        const res = await request(app)
            .post("/admin/projects")
            .set("Authorization", `Bearer ${respToken}`)
            .send({ name: "nope", instrumentVersionId: 1 });
        expect(res.status).toBe(403);
    });
});

// ── 2. STAFF scoped access ──

describe("STAFF scoped to assigned projects", () => {
    it("GET /admin/config → 200", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe("STAFF");
    });

    it("GET /admin/projects → 200 (only assigned)", async () => {
        const res = await request(app)
            .get("/admin/projects")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
        // Should include our test project
        const ids = res.body.data.map((p: { id: number }) => p.id);
        expect(ids).toContain(testProjectId);
    });

    it("GET /admin/projects/:id → 200 (assigned)", async () => {
        const res = await request(app)
            .get(`/admin/projects/${testProjectId}`)
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
    });

    it("STAFF cannot create projects (SUPERUSER only)", async () => {
        const res = await request(app)
            .post("/admin/projects")
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ name: "nope", instrumentVersionId: testInstrumentVersionId });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SUPERUSER_ONLY");
    });

    it("STAFF cannot delete projects (SUPERUSER only)", async () => {
        const res = await request(app)
            .delete(`/admin/projects/${testProjectId}`)
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SUPERUSER_ONLY");
    });

    it("STAFF cannot create instruments (SUPERUSER only)", async () => {
        const res = await request(app)
            .post("/admin/instruments")
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ name: "nope" });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SUPERUSER_ONLY");
    });

    it("STAFF can read instruments (catalog)", async () => {
        const res = await request(app)
            .get("/admin/instruments")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
    });

    it("STAFF cannot access user management", async () => {
        const res = await request(app)
            .get("/admin/users")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("SUPERUSER_ONLY");
    });

    it("STAFF cannot access unassigned project", async () => {
        // Create a project that STAFF is NOT assigned to
        const proj = await prisma.project.create({
            data: {
                name: `RBAC-Unassigned-${TS}`,
                ownerUserId: suUserId,
                instrumentVersionId: testInstrumentVersionId,
            },
        });
        try {
            const res = await request(app)
                .get(`/admin/projects/${proj.id}`)
                .set("Authorization", `Bearer ${staffToken}`);
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe("PROJECT_ADMIN_ACCESS_DENIED");
        } finally {
            await prisma.project.delete({ where: { id: proj.id } });
        }
    });
});

// ── 3. SUPERUSER full access ──

describe("SUPERUSER full access", () => {
    it("GET /admin/config → 200 with SUPERUSER role", async () => {
        const res = await request(app)
            .get("/admin/config")
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe("SUPERUSER");
    });

    it("GET /admin/projects → 200 (all projects)", async () => {
        const res = await request(app)
            .get("/admin/projects")
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
    });

    it("GET /admin/users → 200", async () => {
        const res = await request(app)
            .get("/admin/users")
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("PATCH /admin/users/:id/role → 200", async () => {
        const res = await request(app)
            .patch(`/admin/users/${respUserId}/role`)
            .set("Authorization", `Bearer ${suToken}`)
            .send({ role: "RESPONDENT" });
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe("RESPONDENT");
    });

    it("GET /admin/projects/:id/instrument → 200", async () => {
        const res = await request(app)
            .get(`/admin/projects/${testProjectId}/instrument`)
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
    });

    it("GET /admin/projects/:id/staff → 200", async () => {
        const res = await request(app)
            .get(`/admin/projects/${testProjectId}/staff`)
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

// ── 4. Assignment owner check ──

describe("Assignment owner check", () => {
    it("RESPONDENT can access own assignment instrument", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(200);
    });

    it("STAFF cannot access someone else's assignment instrument", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ASSIGNMENT_ACCESS_DENIED");
    });

    it("SUPERUSER bypasses assignment owner check", async () => {
        const res = await request(app)
            .get(`/assignments/${testAssignmentId}/instrument`)
            .set("Authorization", `Bearer ${suToken}`);
        expect(res.status).toBe(200);
    });

    it("RESPONDENT can list own assignments via /me/assignments", async () => {
        const res = await request(app)
            .get("/me/assignments")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        const ids = res.body.data.map((a: { id: number }) => a.id);
        expect(ids).toContain(testAssignmentId);
    });
});

// ── 5. Global endpoint protection ──

describe("Global endpoint protection", () => {
    it("GET /instruments requires admin (RESPONDENT blocked)", async () => {
        const res = await request(app)
            .get("/instruments")
            .set("Authorization", `Bearer ${respToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ADMIN_ACCESS_DENIED");
    });

    it("GET /instruments works for STAFF", async () => {
        const res = await request(app)
            .get("/instruments")
            .set("Authorization", `Bearer ${staffToken}`);
        expect(res.status).toBe(200);
    });

    it("Unauthenticated request → 401", async () => {
        const res = await request(app).get("/admin/config");
        expect(res.status).toBe(401);
    });
});
