/**
 * Promote a user to SUPERUSER role.
 * Usage: npx tsx scripts/promote-superuser.ts
 * Requires SUPERUSER_EMAIL in .env (or pass DATABASE_URL to target a specific DB).
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.env.SUPERUSER_EMAIL;
if (!email) {
    console.error("SUPERUSER_EMAIL environment variable is required.");
    process.exit(1);
}

async function main() {
    const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
    const prisma = new PrismaClient({ adapter });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            console.error(`User not found: ${email}`);
            process.exit(1);
        }
        if (user.role === "SUPERUSER") {
            console.log(`User ${email} is already SUPERUSER.`);
            return;
        }
        await prisma.user.update({
            where: { email },
            data: { role: "SUPERUSER" },
        });
        console.log(`Promoted ${email} to SUPERUSER.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
