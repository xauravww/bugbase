import Database from "better-sqlite3";
import { resolve } from "path";

const db = new Database(process.env.DATABASE_PATH || resolve("./bugbase.db"));
db.pragma("foreign_keys = ON");

// Get existing users and projects
const users = db.prepare("SELECT id, role FROM users").all();
const projects = db.prepare("SELECT id FROM projects").all();

if (!users.length || !projects.length) {
  console.error("Need at least 1 user and 1 project. Run the app first.");
  process.exit(1);
}

const adminId = users.find(u => u.role === "Admin")?.id ?? users[0].id;
const pids = projects.map(p => p.id);
const userIds = users.map(u => u.id);
const now = Date.now();
const day = 86400000;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ts(offsetDays) { return Math.floor((now + offsetDays * day) / 1000); }

// ── Milestones ──────────────────────────────────────────────────────────────
const milestoneInsert = db.prepare(`INSERT INTO milestones (project_id,name,target_date,status,progress,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
const milestoneStatuses = ["Upcoming","In Progress","Done","Missed"];
const milestoneNames = ["Alpha Release","Beta Launch","v1.0 GA","Performance Hardening","Security Audit","UX Overhaul","API v2","Mobile MVP","Infra Migration","Compliance Certification"];
for (const pid of pids) {
  for (let i = 0; i < 6; i++) {
    milestoneInsert.run(pid, milestoneNames[i % milestoneNames.length] + ` (P${pid})`, ts(-30 + i * 20), pick(milestoneStatuses), Math.floor(Math.random() * 100), adminId, ts(-60 + i), ts(-10 + i));
  }
}

// ── Sprints ──────────────────────────────────────────────────────────────────
const sprintInsert = db.prepare(`INSERT INTO sprints (project_id,name,start_date,end_date,goal,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const sprintStatuses = ["Planned","Active","Completed"];
for (const pid of pids) {
  for (let i = 0; i < 5; i++) {
    sprintInsert.run(pid, `Sprint ${i + 1}`, ts(-14 * (4 - i)), ts(-14 * (3 - i)), `Deliver sprint ${i + 1} goals`, pick(sprintStatuses), adminId, ts(-70 + i * 14), ts(-56 + i * 14));
  }
}

// ── Releases ─────────────────────────────────────────────────────────────────
const releaseInsert = db.prepare(`INSERT INTO releases (project_id,version,release_date,status,release_notes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
const releaseStatuses = ["Planned","In Progress","Released","Rolled Back"];
for (const pid of pids) {
  for (let i = 0; i < 4; i++) {
    releaseInsert.run(pid, `v${i + 1}.0.0`, ts(-20 + i * 15), pick(releaseStatuses), `Release notes for v${i + 1}.0.0`, adminId, ts(-80 + i * 15), ts(-70 + i * 15));
  }
}

// ── Dev Tasks ─────────────────────────────────────────────────────────────────
const devTaskInsert = db.prepare(`INSERT INTO dev_tasks (project_id,title,description,status,priority,assignee_id,due_date,estimated_time,created_by,created_at,updated_at,start_date,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const devTaskStatuses = ["Todo","In Progress","Review","Testing","Done"];
const devTaskPriorities = ["Low","Medium","High","Critical"];
const devTaskTitles = ["Implement auth middleware","Fix pagination bug","Add dark mode","Refactor DB queries","Write unit tests","Setup CI/CD pipeline","Optimize image loading","Add rate limiting","Migrate to TypeScript","Fix memory leak","Add search indexing","Implement caching layer","Update API docs","Add error boundaries","Fix CORS issues","Implement webhooks","Add audit logging","Optimize bundle size","Fix mobile layout","Add export feature"];
const tags = ["frontend","backend","infra","ux","perf","security","testing","docs"];
for (const pid of pids) {
  for (let i = 0; i < 12; i++) {
    devTaskInsert.run(pid, devTaskTitles[i % devTaskTitles.length], `Description for task ${i + 1}`, pick(devTaskStatuses), pick(devTaskPriorities), pick(userIds), ts(5 + i * 2), Math.floor(Math.random() * 16) + 1, adminId, ts(-30 + i), ts(-5 + i), ts(-10 + i), pick(tags) + "," + pick(tags));
  }
}

// ── Requirements ──────────────────────────────────────────────────────────────
const reqInsert = db.prepare(`INSERT INTO requirements (project_id,title,description,type,priority,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const reqTypes = ["Feature","Bug","Enhancement","Research"];
const reqStatuses = ["Draft","Approved","In Progress","Done","Rejected"];
const reqTitles = ["User authentication system","Dashboard analytics","Export to CSV","Email notifications","Role-based access control","API rate limiting","Search functionality","File upload support","Audit trail","Multi-language support"];
for (const pid of pids) {
  for (let i = 0; i < 6; i++) {
    reqInsert.run(pid, reqTitles[i % reqTitles.length], `Detailed requirement description ${i + 1}`, pick(reqTypes), pick(devTaskPriorities), pick(reqStatuses), adminId, ts(-40 + i), ts(-20 + i));
  }
}

// ── Features ──────────────────────────────────────────────────────────────────
const featureInsert = db.prepare(`INSERT INTO features (project_id,name,description,status,priority,epic,story_points,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const featureStatuses = ["Proposed","In Progress","Done","Cancelled"];
const epics = ["Auth","Dashboard","Reporting","Integrations","Mobile","Performance"];
const featureNames = ["OAuth login","Real-time charts","PDF export","Slack integration","Push notifications","Lazy loading","Bulk actions","Advanced filters","Custom themes","API explorer"];
for (const pid of pids) {
  for (let i = 0; i < 8; i++) {
    featureInsert.run(pid, featureNames[i % featureNames.length], `Feature description ${i + 1}`, pick(featureStatuses), pick(devTaskPriorities), pick(epics), pick([1,2,3,5,8,13]), adminId, ts(-35 + i), ts(-15 + i));
  }
}

// ── Bugs ──────────────────────────────────────────────────────────────────────
const bugInsert = db.prepare(`INSERT INTO bugs (project_id,title,description,severity,status,environment,steps_to_reproduce,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const bugStatuses = ["Open","In Progress","Resolved","Closed","Won't Fix"];
const bugEnvs = ["Dev","Staging","Production"];
const bugTitles = ["Login fails on Safari","Dashboard crashes on load","Export generates empty file","Notifications not sent","Search returns wrong results","File upload timeout","Charts not rendering","Session expires too early","Broken pagination","Memory leak on long sessions","CORS error on API","Date formatting wrong","Missing error messages","Slow query on reports","UI broken on mobile"];
for (const pid of pids) {
  for (let i = 0; i < 8; i++) {
    bugInsert.run(pid, bugTitles[i % bugTitles.length], `Steps and context for bug ${i + 1}`, pick(["Low","Medium","High","Critical"]), pick(bugStatuses), pick(bugEnvs), `1. Go to page\n2. Click button\n3. See error`, adminId, ts(-25 + i), ts(-10 + i));
  }
}

// ── User Stories ──────────────────────────────────────────────────────────────
const storyInsert = db.prepare(`INSERT INTO user_stories (project_id,title,status,priority,role,goal,benefit,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const storyStatuses = ["Draft","Ready","In Progress","Done","Rejected"];
const roles = ["developer","admin","end user","manager","QA engineer"];
const goals = ["log in securely","view analytics","export reports","manage team","track bugs","create tasks","review PRs","set permissions","receive alerts","search records"];
for (const pid of pids) {
  for (let i = 0; i < 6; i++) {
    storyInsert.run(pid, `As a ${pick(roles)} I want to ${goals[i % goals.length]}`, pick(storyStatuses), pick(devTaskPriorities), pick(roles), goals[i % goals.length], `Improve productivity and efficiency`, adminId, ts(-30 + i), ts(-10 + i));
  }
}

// ── Personas ──────────────────────────────────────────────────────────────────
const personaInsert = db.prepare(`INSERT INTO personas (project_id,name,role,status,goals,pain_points,behaviors,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const personaStatuses = ["Draft","Active","Archived"];
const personaData = [
  ["Alex Chen","Senior Developer","Wants fast tooling, hates context switching","Too many meetings, slow CI","Uses keyboard shortcuts, reads docs thoroughly"],
  ["Maria Santos","Product Manager","Wants clear metrics and roadmap visibility","Lack of data, unclear priorities","Checks dashboards daily, writes detailed specs"],
  ["Jordan Lee","QA Engineer","Wants reproducible bugs and clear test cases","Flaky tests, missing repro steps","Writes detailed bug reports, automates tests"],
  ["Sam Taylor","DevOps Engineer","Wants stable infra and fast deploys","Manual processes, alert fatigue","Monitors dashboards, automates everything"],
];
for (const pid of pids) {
  for (let i = 0; i < 3; i++) {
    const p = personaData[i % personaData.length];
    personaInsert.run(pid, p[0], p[1], pick(personaStatuses), p[2], p[3], p[4], adminId, ts(-20 + i), ts(-5 + i));
  }
}

// ── Tech Stack ────────────────────────────────────────────────────────────────
const techInsert = db.prepare(`INSERT INTO tech_stack (project_id,name,category,status,version,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const techData = [
  ["Next.js","Frontend","Adopted","14.0","React framework with SSR"],
  ["TypeScript","Frontend","Adopted","5.3","Typed JavaScript"],
  ["Tailwind CSS","Frontend","Adopted","3.4","Utility-first CSS"],
  ["SQLite","Database","Adopted","3.45","Embedded relational DB"],
  ["Drizzle ORM","Backend","Adopted","0.30","TypeScript ORM"],
  ["Node.js","Backend","Adopted","20.0","JS runtime"],
  ["Vitest","Testing","Adopted","1.2","Unit testing framework"],
  ["Docker","DevOps","Evaluating","24.0","Container platform"],
  ["Redis","Database","Evaluating","7.2","In-memory cache"],
  ["React Query","Frontend","Adopted","5.0","Server state management"],
];
for (const pid of pids) {
  for (const t of techData) {
    techInsert.run(pid, t[0], t[1], t[2], t[3], t[4], adminId, ts(-50), ts(-10));
  }
}

// ── Mockups ───────────────────────────────────────────────────────────────────
const mockupInsert = db.prepare(`INSERT INTO mockups (project_id,title,screen,status,url,description,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const mockupStatuses = ["Draft","In Review","Approved","Needs Revision"];
const screens = ["Login","Dashboard","Issues List","Issue Detail","Settings","Profile","Reports","Team","Projects","Timeline"];
for (const pid of pids) {
  for (let i = 0; i < 5; i++) {
    mockupInsert.run(pid, `${screens[i]} Screen`, screens[i], pick(mockupStatuses), `https://figma.com/mock-${pid}-${i}`, `Mockup for ${screens[i]} screen`, adminId, ts(-15 + i), ts(-5 + i));
  }
}

// ── Workflows ─────────────────────────────────────────────────────────────────
const workflowInsert = db.prepare(`INSERT INTO workflows (project_id,title,status,trigger,description,steps,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const workflowStatuses = ["Draft","Active","Deprecated"];
const workflowData = [
  ["Bug Triage","Issue created","Assign severity, notify team, create dev task"],
  ["Release Process","Release planned","Code freeze, QA sign-off, deploy, announce"],
  ["Sprint Planning","Sprint start","Backlog grooming, estimation, assignment"],
  ["Incident Response","Alert triggered","Acknowledge, investigate, fix, postmortem"],
  ["Code Review","PR opened","Assign reviewers, check CI, merge or request changes"],
];
for (const pid of pids) {
  for (let i = 0; i < 4; i++) {
    const w = workflowData[i % workflowData.length];
    workflowInsert.run(pid, w[0], pick(workflowStatuses), w[1], `Standard ${w[0]} workflow`, w[2], adminId, ts(-20 + i), ts(-5 + i));
  }
}

// ── Business Rules ────────────────────────────────────────────────────────────
const brInsert = db.prepare(`INSERT INTO business_rules (project_id,title,category,status,description,condition,action,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const brStatuses = ["Draft","Active","Deprecated"];
const brData = [
  ["Critical bugs block release","Constraint","Any open Critical bug blocks release","status=Critical AND open","Block release pipeline"],
  ["Auto-assign QA on Done","Process","Tasks moved to Done auto-assign QA","status changed to Done","Assign QA reviewer"],
  ["Stale issue notification","Process","Issues inactive 14 days get notified","last_updated > 14 days","Send notification to assignee"],
  ["Priority escalation","Calculation","High bugs unresolved 3 days become Critical","severity=High AND age>3d","Escalate to Critical"],
  ["Sprint capacity check","Validation","Sprint story points cannot exceed 40","total_points > 40","Reject assignment"],
];
for (const pid of pids) {
  for (let i = 0; i < 4; i++) {
    const r = brData[i % brData.length];
    brInsert.run(pid, r[0], r[1], pick(brStatuses), r[2], r[3], r[4], adminId, ts(-15 + i), ts(-5 + i));
  }
}

// ── Risks ─────────────────────────────────────────────────────────────────────
const riskInsert = db.prepare(`INSERT INTO risks (project_id,title,description,impact,probability,mitigation_plan,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const riskStatuses = ["Open","Mitigating","Closed","Accepted"];
const riskData = [
  ["Key developer leaves","Single point of failure in auth module","High","Medium","Document all systems, cross-train team"],
  ["Third-party API deprecation","Payment provider changing API","High","Low","Abstract payment layer, monitor announcements"],
  ["Data breach","Sensitive user data exposure","High","Low","Encrypt at rest, regular audits, pen testing"],
  ["Scope creep","Feature requests expanding beyond MVP","Medium","High","Strict change control process"],
  ["Performance degradation","DB queries slow under load","Medium","Medium","Load testing, query optimization, caching"],
  ["Compliance failure","GDPR requirements not met","High","Medium","Legal review, data audit, consent flows"],
];
for (const pid of pids) {
  for (let i = 0; i < 5; i++) {
    const r = riskData[i % riskData.length];
    riskInsert.run(pid, r[0], r[1], r[2], r[3], r[4], pick(riskStatuses), adminId, ts(-20 + i), ts(-5 + i));
  }
}

// ── Ideas ─────────────────────────────────────────────────────────────────────
const ideaInsert = db.prepare(`INSERT INTO ideas (project_id,title,description,impact,effort,priority,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const ideaStatuses = ["New","Under Review","Approved","Rejected","Converted"];
const ideaData = [
  ["AI-powered bug triage","Use ML to auto-classify and prioritize bugs",5,3],
  ["Voice commands","Control the app with voice",3,5],
  ["Browser extension","Quick bug reporting from any page",4,2],
  ["Slack bot","Get updates and create issues from Slack",4,2],
  ["Time tracking","Built-in time tracking on tasks",3,3],
  ["Dependency graph","Visual task dependency map",4,3],
  ["Custom dashboards","Drag-and-drop dashboard builder",5,4],
  ["API playground","Interactive API explorer in-app",3,2],
];
for (const pid of pids) {
  for (let i = 0; i < 6; i++) {
    const d = ideaData[i % ideaData.length];
    ideaInsert.run(pid, d[0], d[1], d[2], d[3], pick(devTaskPriorities), pick(ideaStatuses), adminId, ts(-15 + i), ts(-5 + i));
  }
}

// ── API Docs ──────────────────────────────────────────────────────────────────
const apiDocInsert = db.prepare(`INSERT INTO api_docs (project_id,endpoint,http_method,authentication,request_body,response_body,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const apiDocStatuses = ["Draft","Stable","Deprecated"];
const apiEndpoints = [
  ["/api/auth/login","POST","None"],
  ["/api/projects","GET","Bearer"],
  ["/api/projects/:id","GET","Bearer"],
  ["/api/issues","GET","Bearer"],
  ["/api/issues","POST","Bearer"],
  ["/api/issues/:id","PUT","Bearer"],
  ["/api/users","GET","Bearer"],
  ["/api/pm/dev-tasks","GET","Bearer"],
];
for (const pid of pids) {
  for (let i = 0; i < 6; i++) {
    const e = apiEndpoints[i % apiEndpoints.length];
    apiDocInsert.run(pid, e[0], e[1], e[2], `{"example":"request"}`, `{"example":"response"}`, pick(apiDocStatuses), adminId, ts(-20 + i), ts(-5 + i));
  }
}

// ── Arch Docs ─────────────────────────────────────────────────────────────────
const archDocInsert = db.prepare(`INSERT INTO arch_docs (project_id,title,category,content,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
const archCategories = ["Architecture","Design","Decision","Runbook","Diagram"];
const archTitles = ["System Overview","Database Schema","Auth Flow","Deployment Guide","ADR: SQLite over Postgres","Incident Runbook","Component Diagram","API Design Principles"];
for (const pid of pids) {
  for (let i = 0; i < 5; i++) {
    archDocInsert.run(pid, archTitles[i % archTitles.length], pick(archCategories), `# ${archTitles[i % archTitles.length]}\n\nDetailed documentation content here.`, adminId, ts(-25 + i), ts(-5 + i));
  }
}

// ── User Journeys ─────────────────────────────────────────────────────────────
const journeyInsert = db.prepare(`INSERT INTO user_journeys (project_id,title,stage,status,persona,description,touchpoints,pain_points,opportunities,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const journeyStatuses = ["Draft","In Review","Approved"];
const journeyStages = ["Awareness","Consideration","Decision","Onboarding","Retention"];
const journeyTitles = ["First-time signup","Bug reporting flow","Sprint planning session","Release deployment","Team onboarding"];
for (const pid of pids) {
  for (let i = 0; i < 4; i++) {
    journeyInsert.run(pid, journeyTitles[i % journeyTitles.length], journeyStages[i % journeyStages.length], pick(journeyStatuses), "Developer", `Journey map for ${journeyTitles[i % journeyTitles.length]}`, "Email, App, Docs", "Confusing UI, slow load", "Simplify flow, add tooltips", adminId, ts(-15 + i), ts(-5 + i));
  }
}

// ── Meeting Notes ─────────────────────────────────────────────────────────────
const meetingInsert = db.prepare(`INSERT INTO meeting_notes (project_id,title,meeting_date,participants,summary,decisions,action_items,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const meetingTitles = ["Sprint Planning","Retrospective","Design Review","Stakeholder Update","Bug Bash","Architecture Review"];
for (const pid of pids) {
  for (let i = 0; i < 4; i++) {
    meetingInsert.run(pid, meetingTitles[i % meetingTitles.length], ts(-7 * (i + 1)), "Alice, Bob, Carol", `Discussed ${meetingTitles[i % meetingTitles.length]} agenda items`, "Agreed on priorities", "Follow up on action items", adminId, ts(-7 * (i + 1)), ts(-7 * (i + 1)));
  }
}

// ── Issues (top up) ───────────────────────────────────────────────────────────
const issueInsert = db.prepare(`INSERT INTO issues (project_id,title,type,description,status,priority,reporter_id,start_date,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const issueStatuses = ["Open","In Progress","In Review","Verified","Closed"];
const issueTitles = ["Login page broken on Firefox","Add dark mode toggle","Dashboard loads slowly","Export button missing","Search not working","Mobile layout broken","Notification emails delayed","API returns 500 on edge case","Missing validation on form","Typo in error message","Performance regression in v2","Accessibility issues on modal","Wrong date format in reports","File upload fails silently","Session not persisting"];
for (const pid of pids) {
  for (let i = 0; i < 8; i++) {
    issueInsert.run(pid, issueTitles[i % issueTitles.length], pick(["Bug","Feature"]), `Detailed description for issue ${i + 1}`, pick(issueStatuses), pick(devTaskPriorities), pick(userIds), ts(-10 + i), ts(10 + i), ts(-20 + i), ts(-5 + i));
  }
}

db.close();
console.log("✓ Seed complete");
