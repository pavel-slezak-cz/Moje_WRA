import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { ScaleType, MeasurementType } from "../src/generated/prisma/enums";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
    // ── Users ──

    const users = [
        { email: "alice@example.com", password: "password123", name: "Alice" },
        { email: "bob@example.com", password: "password123", name: "Bob" },
    ];

    for (const u of users) {
        const hashed = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: { email: u.email, passwordHash: hashed, name: u.name },
        });
    }
    console.log("Users seeded.");

    // ── Legacy questionnaires (backward compat) ──

    for (const q of [
        { title: "Product Feedback", description: "Tell us about our product", questions: [{ id: 1, question: "Rate our product", type: "rating" }] },
        { title: "Website Feedback", description: "Help us improve", questions: [{ id: 1, question: "Easy to navigate?", type: "rating" }] },
    ]) {
        await prisma.questionnaire.upsert({ where: { title: q.title }, update: {}, create: q });
    }
    console.log("Legacy questionnaires seeded.");

    // ── Constructs ──

    const constructData = [
        { name: "Work Engagement", description: "Level of engagement and involvement in work" },
        { name: "Job Satisfaction", description: "Overall satisfaction with one's job" },
        { name: "Work-Life Balance", description: "Perceived balance between work and personal life" },
    ];

    const constructs: Record<string, { id: number }> = {};
    for (const c of constructData) {
        const record = await prisma.construct.upsert({
            where: { name: c.name },
            update: {},
            create: c,
        });
        constructs[c.name] = record;
    }
    console.log("Constructs seeded.");

    // ── Instrument: WRA ──

    const instrument = await prisma.instrument.upsert({
        where: { name: "WRA" },
        update: {},
        create: { name: "WRA", description: "Work Readiness Assessment" },
    });

    // Check if version already exists
    let version = await prisma.instrumentVersion.findUnique({
        where: { instrumentId_versionNumber: { instrumentId: instrument.id, versionNumber: "1.0" } },
    });

    if (!version) {
        version = await prisma.instrumentVersion.create({
            data: { instrumentId: instrument.id, versionNumber: "1.0", isActive: true },
        });

        // ── Items (SOURCE/TARGET pairs + standalone SOURCE items) ──
        const items = [
            // Work Engagement – paired (WE1)
            { constructName: "Work Engagement", text: "I feel energized when I work.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.SOURCE, gapGroupId: "WE1", position: 1 },
            { constructName: "Work Engagement", text: "I want to feel more energized at work.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.TARGET, gapGroupId: "WE1", position: 2 },
            // Work Engagement – standalone SOURCE (reverse scored, no pair)
            { constructName: "Work Engagement", text: "I find it difficult to focus on my tasks.", scaleType: ScaleType.LIKERT_5, reverseScored: true, measurementType: MeasurementType.SOURCE, gapGroupId: null, position: 3 },
            // Job Satisfaction – paired (JS1)
            { constructName: "Job Satisfaction", text: "I am satisfied with my current role.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.SOURCE, gapGroupId: "JS1", position: 4 },
            { constructName: "Job Satisfaction", text: "I want to be more satisfied with my role.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.TARGET, gapGroupId: "JS1", position: 5 },
            // Job Satisfaction – standalone SOURCE (reverse scored, no pair)
            { constructName: "Job Satisfaction", text: "I often think about leaving my job.", scaleType: ScaleType.LIKERT_5, reverseScored: true, measurementType: MeasurementType.SOURCE, gapGroupId: null, position: 6 },
            // Work-Life Balance – paired (WLB1)
            { constructName: "Work-Life Balance", text: "I have enough time for personal activities outside work.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.SOURCE, gapGroupId: "WLB1", position: 7 },
            { constructName: "Work-Life Balance", text: "I want more time for personal activities.", scaleType: ScaleType.LIKERT_5, reverseScored: false, measurementType: MeasurementType.TARGET, gapGroupId: "WLB1", position: 8 },
            // Work-Life Balance – standalone SOURCE (reverse scored, no pair)
            { constructName: "Work-Life Balance", text: "Work demands frequently interfere with my personal life.", scaleType: ScaleType.LIKERT_5, reverseScored: true, measurementType: MeasurementType.SOURCE, gapGroupId: null, position: 9 },
        ];

        await prisma.item.createMany({
            data: items.map((i) => ({
                instrumentVersionId: version!.id,
                constructId: constructs[i.constructName].id,
                text: i.text,
                scaleType: i.scaleType,
                reverseScored: i.reverseScored,
                measurementType: i.measurementType,
                gapGroupId: i.gapGroupId,
                position: i.position,
            })),
        });
    }

    console.log("WRA instrument v1.0 seeded.");

    // ── Sample project ──

    const alice = await prisma.user.findUnique({ where: { email: "alice@example.com" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob@example.com" } });

    if (alice && bob && version) {
        const existingProject = await prisma.project.findUnique({ where: { name: "WRA Pilot Q1 2026" } });
        if (!existingProject) {
            const project = await prisma.project.create({
                data: {
                    name: "WRA Pilot Q1 2026",
                    description: "Pilot deployment of WRA for Q1 2026",
                    ownerUserId: alice.id,
                    instrumentVersionId: version.id,
                },
            });

            await prisma.projectParticipant.createMany({
                data: [
                    { projectId: project.id, userId: alice.id, role: "OWNER" },
                    { projectId: project.id, userId: bob.id, role: "PARTICIPANT" },
                ],
            });

            console.log("Sample project seeded.");
        } else {
            console.log("Sample project already exists.");
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
