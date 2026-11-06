/** Creates the first manager account on a new installation. Usage: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... */
import { z } from "zod";
import { disconnectPrisma, prisma } from "../db/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const input = z
    .object({ ADMIN_EMAIL: z.string().email(), ADMIN_NAME: z.string().trim().min(2), ADMIN_PASSWORD: z.string().min(10, "Use at least 10 characters") })
    .parse(process.env);
  const email = input.ADMIN_EMAIL.toLowerCase();
  if (await prisma().user.findUnique({ where: { email } })) throw new Error(`${email} already exists`);
  await prisma().user.create({ data: { email, name: input.ADMIN_NAME, role: "ADMIN", passwordHash: await hashPassword(input.ADMIN_PASSWORD) } });
  console.log(`Manager account created for ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
