import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { ScaleType, MeasurementType, ScoringStrategy, BehaviorPolarity } from "../src/generated/prisma/enums";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
    // ── Users ──

    const users = [
        { email: "alice@example.com", password: "password123", name: "Alice" },
        { email: "bob@example.com", password: "password123", name: "Bob" },
        { email: "pavel@test.cz", password: "heslo", name: "Pavel" },
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

    // ── Construct: Tasking ──

    const taskingConstruct = await prisma.construct.upsert({
        where: { name: "Tasking" },
        update: {},
        create: { name: "Tasking", description: "Task-related behaviors" },
    });
    console.log("Tasking construct seeded.");

    // ── Instrument: WRA Mini Tasking ──

    const wraMini = await prisma.instrument.upsert({
        where: { name: "WRA Mini Tasking" },
        update: {},
        create: { name: "WRA Mini Tasking", description: "Minimal WRA for task behaviors" },
    });

    let wraMiniVer = await prisma.instrumentVersion.findUnique({
        where: { instrumentId_versionNumber: { instrumentId: wraMini.id, versionNumber: "1.0" } },
    });

    if (!wraMiniVer) {
        wraMiniVer = await prisma.instrumentVersion.create({
            data: { instrumentId: wraMini.id, versionNumber: "1.0", scoringStrategy: ScoringStrategy.WRA_ABSOLUTE_GAP, isActive: true },
        });

        await prisma.item.createMany({
            data: [
                { instrumentVersionId: wraMiniVer.id, constructId: taskingConstruct.id, text: "Pomáhá mi s mými úkoly", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, gapGroupId: "HELP", position: 1 },
                { instrumentVersionId: wraMiniVer.id, constructId: taskingConstruct.id, text: "Přeji si, aby mi více pomáhal s úkoly", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.TARGET, gapGroupId: "HELP", position: 2 },
                { instrumentVersionId: wraMiniVer.id, constructId: taskingConstruct.id, text: "Ignoruje mě", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, gapGroupId: "IGNORE", position: 3 },
                { instrumentVersionId: wraMiniVer.id, constructId: taskingConstruct.id, text: "Přeji si, aby mě méně ignoroval", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.TARGET, gapGroupId: "IGNORE", position: 4 },
            ],
        });
    }
    console.log("WRA Mini Tasking v1.0 seeded.");

    // ── Instrument: 360 Mini Tasking ──

    const mini360 = await prisma.instrument.upsert({
        where: { name: "360 Mini Tasking" },
        update: {},
        create: { name: "360 Mini Tasking", description: "Minimal 360 for task behaviors" },
    });

    let mini360Ver = await prisma.instrumentVersion.findUnique({
        where: { instrumentId_versionNumber: { instrumentId: mini360.id, versionNumber: "1.0" } },
    });

    if (!mini360Ver) {
        mini360Ver = await prisma.instrumentVersion.create({
            data: { instrumentId: mini360.id, versionNumber: "1.0", scoringStrategy: ScoringStrategy.NORMATIVE_360, isActive: true },
        });

        await prisma.item.createMany({
            data: [
                { instrumentVersionId: mini360Ver.id, constructId: taskingConstruct.id, text: "Pomáhá s úkoly", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, behaviorPolarity: BehaviorPolarity.POSITIVE, position: 1 },
                { instrumentVersionId: mini360Ver.id, constructId: taskingConstruct.id, text: "Reaguje na požadavky", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, behaviorPolarity: BehaviorPolarity.POSITIVE, position: 2 },
                { instrumentVersionId: mini360Ver.id, constructId: taskingConstruct.id, text: "Ignoruje podřízené", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, behaviorPolarity: BehaviorPolarity.NEGATIVE, position: 3 },
                { instrumentVersionId: mini360Ver.id, constructId: taskingConstruct.id, text: "Vyhýbá se odpovědnosti", scaleType: ScaleType.YES_NO, reverseScored: false, measurementType: MeasurementType.SOURCE, behaviorPolarity: BehaviorPolarity.NEGATIVE, position: 4 },
            ],
        });
    }
    console.log("360 Mini Tasking v1.0 seeded.");

    // ── Sample projects ──

    const alice = await prisma.user.findUnique({ where: { email: "alice@example.com" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob@example.com" } });
    const pavel = await prisma.user.findUnique({ where: { email: "pavel@test.cz" } });

    // Original WRA pilot project
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

            console.log("WRA Pilot project seeded.");
        }
    }

    // WRA Mini Tasking project
    if (pavel && wraMiniVer) {
        const existing = await prisma.project.findUnique({ where: { name: "WRA Mini Test" } });
        if (!existing) {
            const project = await prisma.project.create({
                data: {
                    name: "WRA Mini Test",
                    description: "Test project for WRA Mini Tasking",
                    ownerUserId: pavel.id,
                    instrumentVersionId: wraMiniVer.id,
                },
            });
            await prisma.projectParticipant.create({
                data: { projectId: project.id, userId: pavel.id, role: "OWNER" },
            });
            console.log("WRA Mini Test project seeded.");
        }
    }

    // 360 Mini Tasking project
    if (pavel && mini360Ver) {
        const existing = await prisma.project.findUnique({ where: { name: "360 Mini Test" } });
        if (!existing) {
            const project = await prisma.project.create({
                data: {
                    name: "360 Mini Test",
                    description: "Test project for 360 Mini Tasking",
                    ownerUserId: pavel.id,
                    instrumentVersionId: mini360Ver.id,
                },
            });
            await prisma.projectParticipant.create({
                data: { projectId: project.id, userId: pavel.id, role: "OWNER" },
            });
            console.log("360 Mini Test project seeded.");
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
