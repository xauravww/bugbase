import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema.js";

const DB_PATH = process.env.DATABASE_PATH || "./bugbase.db";
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite, { schema });

const ADMIN_ID = 10; // admin@bugbase.com

// Create CTPA project
const existing = db.select().from(schema.projects).where(eq(schema.projects.key, "CTPA")).all();
let projectId: number;
if (existing.length > 0) {
  projectId = existing[0].id;
  console.log(`Project CTPA already exists (id=${projectId}), clearing old lists...`);
  db.delete(schema.lists).where(eq(schema.lists.projectId, projectId)).run();
} else {
  const [proj] = db.insert(schema.projects).values({
    name: "CTPA Testing",
    key: "CTPA",
    description: "Cricket Teams & Players Association Canada — route testing tracker",
    createdBy: ADMIN_ID,
  }).returning().all();
  projectId = proj.id;
  db.insert(schema.projectMembers).values({
    projectId,
    userId: ADMIN_ID,
    role: "admin",
  }).run();
  console.log(`Created project CTPA (id=${projectId})`);
}

type ListDef = {
  name: string;
  color: string;
  tasks: TaskDef[];
};

type TaskDef = {
  title: string;
  description?: string;
  status?: "active" | "completed";
  priority?: "none" | "low" | "medium" | "high";
  subtasks?: { title: string; status?: "active" | "completed" }[];
};

const lists: ListDef[] = [
  {
    name: "Public Routes",
    color: "#3b82f6",
    tasks: [
      { title: "Home — /", description: "Landing page, voting widget", priority: "high" },
      { title: "News — /news, /news/[slug]", description: "News list + detail pages", priority: "medium" },
      {
        title: "Players — /players, /players/[slug]",
        description: "Player list + profile pages",
        priority: "medium",
        subtasks: [
          { title: "Player list page loads" },
          { title: "Player detail/slug page loads" },
          { title: "Player search/filter works" },
        ],
      },
      {
        title: "Player auth — /players/login, /register, /verify-email",
        description: "Player registration + login flow",
        priority: "high",
        subtasks: [
          { title: "Login form + validation" },
          { title: "Registration form + validation" },
          { title: "Email verification flow" },
        ],
      },
      {
        title: "Leagues (portal-only) — no public page",
        description: "Content at /matches. BUG-001 resolved.",
        status: "completed",
        priority: "low",
      },
      {
        title: "Matches + Leagues — /matches, /matches/teams, /matches/teams/[id]",
        description: "Public leagues hub + team pages",
        status: "completed",
        priority: "medium",
      },
      { title: "Live scores — /live-scores", description: "Real-time scoring page", priority: "high" },
      {
        title: "Membership — /membership, /membership/verify/[qrToken]",
        description: "Membership info + QR verification",
        priority: "medium",
        subtasks: [
          { title: "Membership page loads" },
          { title: "QR token verification works" },
        ],
      },
      {
        title: "Donate — /donate, /donate/success",
        description: "Donation flow + success page",
        priority: "medium",
        subtasks: [
          { title: "Donate page loads" },
          { title: "Success page after donation" },
        ],
      },
      {
        title: "Careers — /careers, /careers/[slug]",
        description: "Job listings + detail pages",
        priority: "medium",
      },
      {
        title: "Vendors (public) — /vendors, /vendors/[slug]",
        description: "Vendor directory + detail pages",
        priority: "medium",
      },
      {
        title: "International — /international + sub-routes",
        description: "International cricket pages",
        priority: "low",
      },
      {
        title: "Training (public) — /training, /training/sessions/[slug]",
        description: "Training sessions listing + detail",
        priority: "medium",
      },
      {
        title: "Health insurance — /health-insurance, /health-insurance/[slug]",
        description: "Insurance plans + detail pages",
        priority: "low",
      },
      { title: "Sponsorship — /sponsorship", description: "Sponsorship info page", priority: "low" },
      { title: "Scout — /scout", description: "Player scouting page", priority: "low" },
      { title: "Investors — /investors", description: "Investor info page", priority: "low" },
      {
        title: "About + people — /about, /founders/[id], /directors/[id], etc.",
        description: "About page + all person detail routes. 9 pass / 0 fail.",
        status: "completed",
        priority: "medium",
      },
      { title: "Sustainability — /sustainability", description: "Sustainability page", priority: "low" },
      { title: "Legal — /legal/*", description: "Privacy, terms, etc.", priority: "low" },
      { title: "Onboarding — /onboarding", description: "Onboarding flow", priority: "medium" },
      { title: "Voting (public widget) — / widget", description: "Voting widget on home page", priority: "low" },
    ],
  },
  {
    name: "Portals",
    color: "#f59e0b",
    tasks: [
      {
        title: "Player portal — /players/dashboard",
        description: "Player authenticated dashboard",
        priority: "high",
        subtasks: [
          { title: "Dashboard loads after login" },
          { title: "Profile management" },
          { title: "Availability settings" },
          { title: "Booking review" },
        ],
      },
      {
        title: "Team portal — /matches/teams/dashboard",
        description: "Team management dashboard",
        priority: "medium",
        subtasks: [
          { title: "Dashboard loads" },
          { title: "Team roster management" },
        ],
      },
      {
        title: "League portal — /leagues/dashboard",
        description: "League management. 6 pass / 0 fail.",
        priority: "high",
        status: "completed",
        subtasks: [
          { title: "Dashboard loads", status: "completed" },
          { title: "League settings", status: "completed" },
          { title: "Job postings", status: "completed" },
        ],
      },
      {
        title: "Vendor portal — /vendors/dashboard",
        description: "Vendor dashboard. BUG-002: 200 unauth.",
        priority: "high",
        subtasks: [
          { title: "Dashboard loads" },
          { title: "Listings management" },
          { title: "Enquiries view" },
          { title: "Orders management" },
          { title: "KYC/profile" },
          { title: "Auth guard — BUG-002: returns 200 unauth" },
        ],
      },
      {
        title: "Board portal — /board/dashboard",
        description: "Board member dashboard",
        priority: "low",
      },
      {
        title: "Training portal — /training/dashboard",
        description: "Trainer dashboard — session CRUD, video links",
        priority: "medium",
        subtasks: [
          { title: "Dashboard loads" },
          { title: "Create/edit/delete sessions" },
          { title: "Video URL management" },
          { title: "View registrations" },
        ],
      },
      {
        title: "Member account — /membership/account",
        description: "Member dashboard — status, card, renewals",
        priority: "medium",
        subtasks: [
          { title: "Login flow" },
          { title: "Member card display" },
          { title: "Renewal flow" },
        ],
      },
      {
        title: "Donor account — /donate/account",
        description: "Donor dashboard — history, receipts, recurring",
        priority: "medium",
        subtasks: [
          { title: "Login flow" },
          { title: "Donation history" },
          { title: "Receipts download" },
        ],
      },
    ],
  },
  {
    name: "Admin Console",
    color: "#ef4444",
    tasks: [
      {
        title: "Admin auth + dashboard — /admin/login, /admin",
        description: "Admin login flow + main dashboard",
        priority: "high",
        subtasks: [
          { title: "Login form + validation" },
          { title: "Dashboard overview loads" },
          { title: "Impersonation flow (owner/super_admin)" },
        ],
      },
      {
        title: "Admin Players — /admin/players",
        description: "Player management CRUD",
        priority: "medium",
      },
      {
        title: "Admin Teams — /admin/teams",
        description: "Team management CRUD",
        priority: "medium",
      },
      {
        title: "Admin Leagues + users — /admin/leagues, /admin/leagues/users",
        description: "League management. 14 pass / 0 fail. BUG-010,011 fixed.",
        status: "completed",
        priority: "medium",
        subtasks: [
          { title: "League CRUD", status: "completed" },
          { title: "League users management", status: "completed" },
        ],
      },
      {
        title: "Admin Fixtures — /admin/fixtures",
        description: "Fixture management. BUG-003 in tests.",
        priority: "high",
      },
      {
        title: "Admin News — /admin/news",
        description: "News article CRUD",
        priority: "medium",
      },
      {
        title: "Admin Members — /admin/members",
        description: "Member management",
        priority: "medium",
      },
      {
        title: "Admin Membership apps — /admin/membership",
        description: "Membership application review/approval",
        priority: "medium",
      },
      {
        title: "Admin Donations — /admin/donations",
        description: "Donation management",
        priority: "medium",
      },
      {
        title: "Admin Sponsors — /admin/sponsors",
        description: "Sponsor management",
        priority: "medium",
      },
      {
        title: "Admin Sponsorship enquiries — /admin/sponsorship",
        description: "Sponsorship enquiry management",
        priority: "low",
      },
      {
        title: "Admin Careers + job seekers — /admin/careers, job-seekers",
        description: "Career management. 13 pass / 0 fail. BUG-009 fixed.",
        status: "completed",
        priority: "medium",
        subtasks: [
          { title: "Career/job CRUD", status: "completed" },
          { title: "Job seeker applications", status: "completed" },
        ],
      },
      {
        title: "Admin Vendors + orders + payments — /admin/vendors, orders, payments",
        description: "Vendor management, orders, payment tracking, store, settings",
        priority: "high",
        subtasks: [
          { title: "Vendor list + CRUD" },
          { title: "Vendor orders management" },
          { title: "Vendor payments tracking" },
          { title: "Vendor store (/admin/vendors/[id]/store)" },
          { title: "Vendor settings" },
        ],
      },
      {
        title: "Admin International + roster — /admin/international, roster-needs",
        description: "International team management + roster needs",
        priority: "medium",
      },
      {
        title: "Admin Training + discussions — /admin/training, discussions",
        description: "Training session + trainer management, discussions",
        priority: "medium",
        subtasks: [
          { title: "Sessions tab CRUD" },
          { title: "Trainers tab" },
          { title: "Discussions tab" },
        ],
      },
      {
        title: "Admin Health insurance + payments — /admin/health-insurance, health-payments",
        description: "Insurance plan management + payment tracking",
        priority: "medium",
      },
      {
        title: "Admin Voting — /admin/voting",
        description: "Voting/poll management",
        priority: "low",
      },
      {
        title: "Admin Board quotes — /admin/board-quotes",
        description: "Board member quote management",
        priority: "low",
      },
      {
        title: "Admin About content — /admin/about/*",
        description: "Founders, directors, mentors, board-members, team-members, volunteers, contact-submissions, settings",
        priority: "medium",
        subtasks: [
          { title: "Founders CRUD" },
          { title: "Directors CRUD" },
          { title: "Mentors CRUD + trainer login grant" },
          { title: "Board members CRUD" },
          { title: "Team members CRUD" },
          { title: "Volunteers CRUD" },
          { title: "Contact submissions" },
          { title: "About settings" },
        ],
      },
      {
        title: "Admin Admins — /admin/admins",
        description: "Admin user management, roles, permission flags",
        priority: "high",
      },
      {
        title: "Admin Security — /admin/security",
        description: "Security settings, audit",
        priority: "medium",
      },
      {
        title: "Admin Logs — /admin/logs",
        description: "Audit/activity logs",
        priority: "low",
      },
      {
        title: "Admin Email templates — /admin/email-templates",
        description: "Email template management",
        priority: "low",
      },
    ],
  },
];

let listOrder = 0;
let totalTasks = 0;
let totalSubtasks = 0;

for (const listDef of lists) {
  const [list] = db.insert(schema.lists).values({
    projectId,
    name: listDef.name,
    color: listDef.color,
    sortOrder: listOrder++,
    createdBy: ADMIN_ID,
  }).returning().all();

  console.log(`  List: ${list.name} (id=${list.id})`);

  let taskOrder = 0;
  for (const taskDef of listDef.tasks) {
    const isCompleted = taskDef.status === "completed";
    const [task] = db.insert(schema.tasks).values({
      listId: list.id,
      title: taskDef.title,
      description: taskDef.description || null,
      status: taskDef.status || "active",
      priority: taskDef.priority || "none",
      completedAt: isCompleted ? new Date() : null,
      completedBy: isCompleted ? ADMIN_ID : null,
      sortOrder: taskOrder++,
      createdBy: ADMIN_ID,
    }).returning().all();
    totalTasks++;

    if (isCompleted) {
      db.insert(schema.taskActivity).values({
        projectId,
        taskId: task.id,
        userId: ADMIN_ID,
        action: "completed",
        newValue: "completed",
      }).run();
    } else {
      db.insert(schema.taskActivity).values({
        projectId,
        taskId: task.id,
        userId: ADMIN_ID,
        action: "created",
        newValue: taskDef.title,
      }).run();
    }

    if (taskDef.subtasks) {
      let subOrder = 0;
      for (const subDef of taskDef.subtasks) {
        const isSubCompleted = subDef.status === "completed";
        db.insert(schema.subtasks).values({
          taskId: task.id,
          title: subDef.title,
          status: subDef.status || "active",
          completedAt: isSubCompleted ? new Date() : null,
          completedBy: isSubCompleted ? ADMIN_ID : null,
          sortOrder: subOrder++,
        }).run();
        totalSubtasks++;
      }
    }
  }
}

console.log(`\nDone! Created ${totalTasks} tasks + ${totalSubtasks} subtasks across ${lists.length} lists in project CTPA (id=${projectId}).`);
sqlite.close();
