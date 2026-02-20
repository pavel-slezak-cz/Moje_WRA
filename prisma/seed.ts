import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
    // --- Create sample users ---
    const users = [
        { email: "alice@example.com", password: "password123", name: "Alice" },
        { email: "bob@example.com", password: "password123", name: "Bob" },
    ];

    for (const u of users) {
        const hashed = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
                email: u.email,
                passwordHash: hashed,
                name: u.name,
            },
        });
    }

    console.log("Sample users created.");

    // --- Create sample questionnaires ---
    const questionnaires = [
        {
            title: "Product Feedback",
            description: "Tell us what you think about our product",
            questions: [
                { id: 1, question: "How do you rate our product?", type: "rating" },
                { id: 2, question: "Any suggestions for improvement?", type: "text" },
            ],
        },
        {
            title: "Website Feedback",
            description: "Help us improve our website",
            questions: [
                { id: 1, question: "Is the website easy to navigate?", type: "rating" },
                { id: 2, question: "What did you like most?", type: "text" },
            ],
        },
    ];

    for (const q of questionnaires) {
        await prisma.questionnaire.upsert({
            where: { title: q.title },
            update: {},
            create: {
                title: q.title,
                description: q.description,
                questions: q.questions,
            },
        });
    }

    console.log("Sample questionnaires created.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
