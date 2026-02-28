import { db } from "@/lib/db";
import { users, projects, projectMembers, issues } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { USER_ROLES } from "@/constants/roles";

const SEED_USERS = [
  {
    name: "Admin User",
    email: "admin@bugbase.com",
    password: "admin123",
    role: USER_ROLES.ADMIN,
  },
  {
    name: "John Developer",
    email: "john@bugbase.com",
    password: "developer123",
    role: USER_ROLES.DEVELOPER,
  },
  {
    name: "Sarah QA",
    email: "sarah@bugbase.com",
    password: "qa123",
    role: USER_ROLES.QA,
  },
  {
    name: "Mike Viewer",
    email: "mike@bugbase.com",
    password: "viewer123",
    role: USER_ROLES.VIEWER,
  },
  {
    name: "Emily Tester",
    email: "emily@bugbase.com",
    password: "tester123",
    role: USER_ROLES.QA,
  },
  {
    name: "Alex Coder",
    email: "alex@bugbase.com",
    password: "coder123",
    role: USER_ROLES.DEVELOPER,
  },
];

const SEED_PROJECTS = [
  {
    name: "Bug Tracker",
    key: "BUG",
    description: "Main bug tracking system",
    createdBy: 1,
  },
  {
    name: "Mobile App",
    key: "MOB",
    description: "Mobile application development",
    createdBy: 1,
  },
  {
    name: "Website Redesign",
    key: "WEB",
    description: "Company website overhaul",
    createdBy: 1,
  },
];

const SEED_ISSUES = [
  {
    projectId: 1,
    title: "Login page not responding",
    type: "Bug" as const,
    description: "Users report login page times out",
    status: "Open" as const,
    priority: "High" as const,
    reporterId: 2,
  },
  {
    projectId: 1,
    title: "Add dark mode support",
    type: "Feature" as const,
    description: "Users want dark mode option",
    status: "In Progress" as const,
    priority: "Medium" as const,
    reporterId: 3,
  },
  {
    projectId: 1,
    title: "Fix memory leak in dashboard",
    type: "Bug" as const,
    description: "Dashboard causes memory leak",
    status: "Open" as const,
    priority: "Critical" as const,
    reporterId: 2,
  },
  {
    projectId: 2,
    title: "Setup CI/CD pipeline",
    type: "Feature" as const,
    description: "Automate deployment process",
    status: "In Progress" as const,
    priority: "High" as const,
    reporterId: 1,
  },
  {
    projectId: 3,
    title: "Update color scheme",
    type: "Feature" as const,
    description: "Refresh brand colors",
    status: "Open" as const,
    priority: "Low" as const,
    reporterId: 3,
  },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data (in order due to foreign keys)
  await db.delete(issues).run();
  await db.delete(projectMembers).run();
  await db.delete(projects).run();
  await db.delete(users).run();

  console.log("✓ Cleared existing data");

  // Insert users
  const userIdMap: Record<string, number> = {};
  for (const user of SEED_USERS) {
    const passwordHash = await hashPassword(user.password);
    const [created] = await db.insert(users).values({
      name: user.name,
      email: user.email,
      passwordHash,
      role: user.role,
    }).returning();
    userIdMap[user.email] = created.id;
    console.log(`✓ Created user: ${user.email} (${user.role})`);
  }

  // Insert projects
  const projectIdMap: Record<string, number> = {};
  for (const project of SEED_PROJECTS) {
    const [created] = await db.insert(projects).values({
      ...project,
      createdBy: userIdMap[Object.keys(userIdMap)[0]], // Use first user's ID
    }).returning();
    projectIdMap[project.key] = created.id;
    console.log(`✓ Created project: ${project.name}`);
  }

  // Add project memberships
  await db.insert(projectMembers).values([
    { projectId: projectIdMap["BUG"], userId: userIdMap["admin@bugbase.com"], role: "admin" },
    { projectId: projectIdMap["BUG"], userId: userIdMap["john@bugbase.com"], role: "member" },
    { projectId: projectIdMap["BUG"], userId: userIdMap["sarah@bugbase.com"], role: "qa" },
    { projectId: projectIdMap["BUG"], userId: userIdMap["mike@bugbase.com"], role: "member" },
    { projectId: projectIdMap["MOB"], userId: userIdMap["admin@bugbase.com"], role: "admin" },
    { projectId: projectIdMap["MOB"], userId: userIdMap["alex@bugbase.com"], role: "member" },
    { projectId: projectIdMap["MOB"], userId: userIdMap["emily@bugbase.com"], role: "qa" },
    { projectId: projectIdMap["WEB"], userId: userIdMap["admin@bugbase.com"], role: "admin" },
    { projectId: projectIdMap["WEB"], userId: userIdMap["john@bugbase.com"], role: "member" },
    { projectId: projectIdMap["WEB"], userId: userIdMap["sarah@bugbase.com"], role: "qa" },
  ]);
  console.log("✓ Added project memberships");

  // Insert sample issues
  for (const issue of SEED_ISSUES) {
    await db.insert(issues).values({
      ...issue,
      projectId: projectIdMap["BUG"],
      reporterId: userIdMap["john@bugbase.com"],
    });
  }
  console.log(`✓ Created ${SEED_ISSUES.length} sample issues`);

  console.log("\n✅ Seeding complete!\n");
  console.log("Users:");
  for (const user of SEED_USERS) {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
  }
}

seed()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
