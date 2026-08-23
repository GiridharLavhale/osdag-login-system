/**
 * Creates the 3 demo users directly in Appwrite Auth, and one row per file
 * in the `files` table — each row's READ permission is scoped to exactly
 * its owner (Permission.read(Role.user(ownerId))). That per-row permission
 * is what makes Appwrite itself refuse to hand back another user's file,
 * with no manual "does this belong to you?" check needed on our side.
 *
 * Run with: npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Users, TablesDB, Permission, Role } = require("node-appwrite");

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const users = new Users(client);
const tablesDB = new TablesDB(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const FILES_TABLE_ID = process.env.APPWRITE_FILES_TABLE_ID;

async function main() {
  const seedPath = path.join(__dirname, "..", "public", "seed-data.json");
  const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  for (const u of seedData.users) {
    console.log(`Creating user ${u.email}...`);
    const created = await users.create({
      userId: u.id,
      email: u.email,
      password: u.password,
      name: u.profile.fullName,
    });

    // Extra profile fields that don't have a dedicated Appwrite Auth field
    // live in the user's preferences (a per-user JSON blob Appwrite manages
    // natively — no extra table needed for this).
    await users.updatePrefs({
      userId: created.$id,
      prefs: {
        displayName: u.profile.displayName,
        bio: u.profile.bio,
        role: u.profile.role,
      },
    });

    for (const f of u.files) {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: FILES_TABLE_ID,
        rowId: f.id,
        data: {
          ownerId: u.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          uploadedAt: f.uploadedAt,
        },
        permissions: [Permission.read(Role.user(u.id))],
      });
    }
    console.log(`  - ${u.email}: ${u.files.length} files, each readable only by usr ${u.id}`);
  }

  console.log("\nDone. These 3 accounts are ready to log in with on the test client:");
  for (const u of seedData.users) {
    console.log(`  ${u.email} / ${u.password}`);
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err.message || err);
  process.exit(1);
});
