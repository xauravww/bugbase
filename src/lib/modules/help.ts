/**
 * Plain-language help + starter templates for every PM module.
 *
 * Two things live here:
 *  - MODULE_HELP  — page-level "what is this page for" copy, shown by the ℹ
 *    button next to a module's title. Answers: what goes here, why, and what a
 *    filled-in record actually looks like.
 *  - MODULE_TEMPLATES — starter field values offered on the create form so a
 *    new user does not face an empty page. Templates are scoped to their own
 *    module: bug templates only under bugs, meeting templates only under
 *    meeting notes.
 *  - FIELD_HELP — per-module overrides for the generic field help in
 *    ui/FieldHelp.ts, used where a field means something specific to a module
 *    (e.g. "Steps to Reproduce" on a bug, "Condition" on a business rule).
 *
 * Keep the language simple. These strings are read by people who do not know
 * the jargon — that is the entire point of them.
 */

import type { FieldHelpContent } from "@/components/ui/FieldHelp";

export interface ModuleHelp {
  /** One line: what this page holds. */
  whatItIs: string;
  /** Why keeping it matters to the team. */
  whyItMatters: string;
  /** Short bullets: what belongs here. */
  writeThis: string[];
  /** Short bullets: what does NOT belong here (goes elsewhere). */
  notThis: string[];
  /** A realistic filled-in record, shown as label → value lines. */
  example: Array<{ label: string; value: string }>;
  tip?: string;
}

export interface ModuleTemplate {
  name: string;
  description: string;
  /** Field key → starting value. Keys must match the module's field keys. */
  fields: Record<string, string | number>;
}

/* ────────────────────────────── module help ────────────────────────────── */

export const MODULE_HELP: Record<string, ModuleHelp> = {
  requirements: {
    whatItIs: "A requirement is one thing the product must do, written down so everyone agrees on it before any code is written.",
    whyItMatters: "It is the agreement. When people argue later about whether something was in scope, this page is the answer.",
    writeThis: [
      "What the product must do, in one sentence",
      "How you will know it is finished (acceptance criteria)",
      "Who asked for it and how important it is",
    ],
    notThis: [
      "How to build it — that goes in Tech Docs",
      "The work needed to build it — that goes in Tasks",
      "A defect in something already built — that goes in Bugs",
    ],
    example: [
      { label: "Title", value: "Users can reset their password by email" },
      { label: "Type", value: "Feature" },
      { label: "Priority", value: "High" },
      { label: "Description", value: "People who forget their password currently have to contact support. They should be able to request a reset link themselves and set a new password." },
      { label: "Acceptance Criteria", value: "Given a registered email, when the user requests a reset, then a link valid for 30 minutes is emailed. Given an expired link, when it is opened, then the user is asked to request a new one." },
    ],
    tip: "If you cannot write acceptance criteria for it, the requirement is still too vague to build.",
  },

  features: {
    whatItIs: "A feature is a piece of the product you are actually going to build and ship, usually covering one or more requirements.",
    whyItMatters: "This is the level managers and customers talk in. It is how you say what is shipping in this release.",
    writeThis: [
      "The name people will use for it out loud",
      "The user value in one or two lines",
      "A rough size estimate (story points) and which epic it belongs to",
    ],
    notThis: [
      "The formal must-do statement — that is a Requirement",
      "The step-by-step build work — that is Tasks",
    ],
    example: [
      { label: "Name", value: "Self-serve password reset" },
      { label: "Status", value: "In Progress" },
      { label: "Priority", value: "High" },
      { label: "Story Points", value: "5" },
      { label: "Epic", value: "Account management" },
      { label: "Description", value: "Lets users get back into their account without contacting support. Removes roughly 40 support tickets a month." },
    ],
    tip: "Name features the way a customer would say them, not the way the code is organised.",
  },

  "dev-tasks": {
    whatItIs: "A task is one concrete piece of work that one person can pick up and finish.",
    whyItMatters: "Tasks are what people work from day to day, and what the timeline and progress views are built on.",
    writeThis: [
      "A title starting with a verb: 'Add', 'Fix', 'Write'",
      "Who owns it and when it is due",
      "The feature or requirement it belongs to",
    ],
    notThis: [
      "A whole feature — split it into tasks",
      "A vague wish with no owner and no end",
    ],
    example: [
      { label: "Title", value: "Add reset-token table and expiry job" },
      { label: "Status", value: "In Progress" },
      { label: "Priority", value: "High" },
      { label: "Due Date", value: "2026-08-04" },
      { label: "Estimated (h)", value: "6" },
      { label: "Description", value: "Store reset tokens with a 30 minute expiry and clear expired rows nightly." },
    ],
    tip: "If a task cannot be finished in a few days, it is really several tasks.",
  },

  bugs: {
    whatItIs: "A bug is something already built that behaves wrongly.",
    whyItMatters: "A bug report that another person can reproduce gets fixed. One that cannot be reproduced gets closed and forgotten.",
    writeThis: [
      "Exact steps someone else can follow to see the problem",
      "What you expected and what actually happened",
      "Where it happened: Dev, Staging or Production",
    ],
    notThis: [
      "A missing capability that was never built — that is a Requirement or Feature",
      "A vague 'it is broken' with no steps",
    ],
    example: [
      { label: "Title", value: "Reset link returns 500 when email has uppercase letters" },
      { label: "Severity", value: "High" },
      { label: "Environment", value: "Production" },
      { label: "Steps to Reproduce", value: "1. Go to /forgot-password\n2. Enter Alex@Example.com\n3. Press Send link" },
      { label: "Expected Result", value: "A reset email is sent and a confirmation shows." },
      { label: "Actual Result", value: "The page shows 'Something went wrong' and no email arrives." },
    ],
    tip: "Write steps as if for someone who has never used the product. Number them.",
  },

  releases: {
    whatItIs: "A release is a version of the product that went out, with the date and what changed in it.",
    whyItMatters: "When something breaks, the first question is always 'what shipped recently'. This page answers it.",
    writeThis: [
      "The version number, like v1.4.0",
      "The date it went out or is planned for",
      "Release notes: what changed, in language a customer can read",
    ],
    notThis: [
      "Individual work items — link Features and Bugs instead",
      "Deployment instructions — those belong in Tech Docs as a runbook",
    ],
    example: [
      { label: "Version", value: "v1.4.0" },
      { label: "Status", value: "Released" },
      { label: "Release Date", value: "2026-07-24" },
      { label: "Release Notes", value: "Added self-serve password reset.\nFixed reset links failing for uppercase emails.\nSped up the projects list." },
    ],
    tip: "Write release notes for the person using the product, not the person who wrote the code.",
  },

  "api-docs": {
    whatItIs: "One record per API endpoint: its path, method, auth, and what it sends and returns.",
    whyItMatters: "It stops people guessing or reading source code to call your API — including your future self.",
    writeThis: [
      "The path and the HTTP method",
      "What authentication it needs",
      "A real example request body and response body",
    ],
    notThis: [
      "Architecture explanations — those belong in Tech Docs",
      "Bugs in the endpoint — those belong in Bugs",
    ],
    example: [
      { label: "Endpoint", value: "/api/auth/reset-password" },
      { label: "Method", value: "POST" },
      { label: "Auth", value: "None" },
      { label: "Status", value: "Stable" },
      { label: "Request Body", value: '{ "token": "abc123", "password": "NewPass123!" }' },
      { label: "Response Body", value: '{ "success": true }' },
    ],
    tip: "Paste a real request and response you actually ran. Invented examples drift from reality.",
  },

  "arch-docs": {
    whatItIs: "Longer written documents: how the system is put together, why a decision was made, or how to carry out an operational procedure.",
    whyItMatters: "It saves the same explanation being given over and over, and it records why choices were made after the people who made them move on.",
    writeThis: [
      "How a part of the system works and how the pieces connect",
      "Decisions: what was chosen, what else was considered, and why",
      "Runbooks: the steps to follow when something specific happens",
    ],
    notThis: [
      "What the product must do — that is a Requirement",
      "Endpoint reference detail — that is API Docs",
    ],
    example: [
      { label: "Title", value: "Why we chose short-lived reset tokens" },
      { label: "Category", value: "Decision" },
      { label: "Content", value: "We considered long-lived links and one-time codes. We chose 30 minute single-use tokens because email inboxes are often shared and a stale link is a real account-takeover route. Cost: users who wait too long must request a second link." },
    ],
    tip: "For a decision, always record the options you rejected. That is the part people need later.",
  },

  "meeting-notes": {
    whatItIs: "What was discussed in a meeting, what was decided, and who is doing what next.",
    whyItMatters: "Decisions made out loud get forgotten or remembered differently. Written down, they hold.",
    writeThis: [
      "Date and who was there",
      "A short summary of what was discussed",
      "Decisions made, and action items with an owner each",
    ],
    notThis: [
      "A word-for-word transcript — summarise instead",
      "Ongoing work — turn action items into Tasks",
    ],
    example: [
      { label: "Title", value: "Password reset scope review" },
      { label: "Date", value: "2026-07-21" },
      { label: "Participants", value: "Alex, Priya, Sam" },
      { label: "Summary", value: "Reviewed the reset flow and argued about link lifetime and rate limiting." },
      { label: "Decisions", value: "Link expires in 30 minutes. Limit to 3 requests per hour per email." },
      { label: "Action Items", value: "- [ ] Priya: add the rate limit by Jul 25\n- [ ] Sam: update the email copy" },
    ],
    tip: "Every action item needs a name and a date on it, or it will not happen.",
  },

  risks: {
    whatItIs: "Something that has not gone wrong yet but could, and what you plan to do about it.",
    whyItMatters: "Writing a risk down early is far cheaper than dealing with it as a surprise later.",
    writeThis: [
      "What could go wrong and what the damage would be",
      "How likely it is and how bad it would be",
      "The mitigation plan: what reduces it, and who owns that",
    ],
    notThis: [
      "Something that has already gone wrong — that is a Bug or an Issue",
      "A general worry with no possible action",
    ],
    example: [
      { label: "Title", value: "Reset emails may be marked as spam" },
      { label: "Impact", value: "High" },
      { label: "Probability", value: "Medium" },
      { label: "Status", value: "Mitigating" },
      { label: "Description", value: "Our sending domain is new. If reset emails land in spam, locked-out users cannot get back in and will contact support." },
      { label: "Mitigation Plan", value: "Set up SPF, DKIM and DMARC before launch, and warm the domain for two weeks. Owner: Sam." },
    ],
    tip: "A risk with no mitigation plan is just a worry. Always write the next action.",
  },

  ideas: {
    whatItIs: "A rough suggestion that has not been committed to yet — a place to park thoughts without cluttering real work.",
    whyItMatters: "Good ideas turn up at bad times. Parking them here means they are not lost and not mistaken for planned work.",
    writeThis: [
      "The suggestion in a line or two",
      "Rough impact and effort scores from 1 to 5",
      "Why you think it is worth doing",
    ],
    notThis: [
      "Anything already agreed and scheduled — promote it to a Feature or Requirement",
      "A defect — that is a Bug",
    ],
    example: [
      { label: "Title", value: "Let users log in with a one-time email code" },
      { label: "Impact (1-5)", value: "4" },
      { label: "Effort (1-5)", value: "2" },
      { label: "Status", value: "Under Review" },
      { label: "Description", value: "Most reset requests come from people who simply forgot their password. A one-time code could remove the need for passwords for casual users." },
    ],
    tip: "Score impact and effort right away. High impact plus low effort is what you look at first.",
  },

  milestones: {
    whatItIs: "A dated checkpoint that matters to people outside the team — a launch, a demo, an audit.",
    whyItMatters: "It gives the work a deadline everyone can see and plan back from.",
    writeThis: [
      "The name of the checkpoint",
      "The target date",
      "Roughly how far along it is, as a percentage",
    ],
    notThis: [
      "A time-boxed work period — that is a Sprint",
      "Individual work items — those are Tasks",
    ],
    example: [
      { label: "Name", value: "Password reset live for all users" },
      { label: "Target Date", value: "2026-08-15" },
      { label: "Status", value: "In Progress" },
      { label: "Progress (%)", value: "60" },
    ],
    tip: "A milestone is an outcome with a date, not a period of time. If it has a start and an end, you want a Sprint.",
  },

  sprints: {
    whatItIs: "A fixed period of time, usually one or two weeks, with a goal the team commits to.",
    whyItMatters: "It puts a boundary around the work so progress can be measured instead of guessed.",
    writeThis: [
      "A name or number, like Sprint 14",
      "Start and end dates",
      "The one goal for the sprint, in a sentence",
    ],
    notThis: [
      "A dated outcome for outsiders — that is a Milestone",
      "The list of work — link Tasks to this sprint instead",
    ],
    example: [
      { label: "Sprint Name", value: "Sprint 14 — Reset flow" },
      { label: "Status", value: "Active" },
      { label: "Start Date", value: "2026-07-28" },
      { label: "End Date", value: "2026-08-08" },
      { label: "Goal", value: "Ship password reset end to end on staging, with rate limiting in place." },
    ],
    tip: "One goal per sprint. If you write three, you have no goal.",
  },

  "user-stories": {
    whatItIs: "A requirement written from the user's point of view: as a type of user, I want something, so that I get some benefit.",
    whyItMatters: "It keeps the reason in the sentence, so the team builds the outcome rather than just the mechanism.",
    writeThis: [
      "The kind of user — be specific, not just 'user'",
      "What they want to do",
      "The benefit they get, and the acceptance criteria",
    ],
    notThis: [
      "A technical task in story clothing — 'as a developer I want to refactor' is a Task",
      "Several stories crammed into one",
    ],
    example: [
      { label: "Title", value: "Locked-out user resets their own password" },
      { label: "As a…", value: "person who forgot my password" },
      { label: "I want to…", value: "get a reset link by email" },
      { label: "So that…", value: "I can get back in without waiting for support" },
      { label: "Acceptance Criteria", value: "Given my email is registered, when I request a reset, then I receive a link within one minute. Given the link is over 30 minutes old, when I open it, then I am asked for a new one." },
    ],
    tip: "If the 'so that' is hard to write, you may not know why you are building it yet.",
  },

  personas: {
    whatItIs: "A short profile of one kind of person who uses the product, based on what you actually know about real users.",
    whyItMatters: "It stops arguments about 'the user' as if everyone were the same person. You can point at a persona instead.",
    writeThis: [
      "A name and role, so people can refer to them",
      "What they are trying to achieve",
      "What frustrates them today, and how they behave",
    ],
    notThis: [
      "Invented demographic detail that changes no decision",
      "One persona covering everybody",
    ],
    example: [
      { label: "Name", value: "Priya the part-time admin" },
      { label: "Role / Job Title", value: "Office administrator, 2 days a week" },
      { label: "Goals", value: "Get in, update a handful of records, get out. Never wants to read documentation." },
      { label: "Pain Points", value: "Forgets her password between sessions because she logs in only twice a week." },
      { label: "Behaviors", value: "Uses a shared desktop machine. Never saves passwords in the browser." },
    ],
    tip: "Only write what changes a decision. Priya forgetting her password is why reset matters; her favourite colour is not.",
  },

  "user-journeys": {
    whatItIs: "The path a person takes through a goal, step by step, including where it goes wrong.",
    whyItMatters: "Individual screens can each look fine while the path between them is broken. A journey shows the gaps.",
    writeThis: [
      "Which persona, and which stage they are in",
      "The touchpoints they pass through, in order",
      "Where it hurts today, and the opportunities to fix it",
    ],
    notThis: [
      "A single screen's design — that is a Mockup",
      "An internal system flow — that is a Workflow",
    ],
    example: [
      { label: "Title", value: "Getting back in after forgetting a password" },
      { label: "Stage", value: "Retention" },
      { label: "Persona", value: "Priya the part-time admin" },
      { label: "Touchpoints", value: "Login screen → Forgot password → Email inbox → Reset form → Dashboard" },
      { label: "Pain Points", value: "No clear message that the email was sent. The email arrives from an unfamiliar address." },
      { label: "Opportunities", value: "Confirm on screen which address was used, and send from a recognisable sender name." },
    ],
    tip: "Walk the journey yourself before writing it. You will find steps you did not know existed.",
  },

  "tech-stack": {
    whatItIs: "One record per technology in use — language, framework, database, service — and why it is here.",
    whyItMatters: "New joiners can see what is in play, and you can see what is old and needs replacing.",
    writeThis: [
      "The name, category and version in use",
      "What it does for you",
      "The rationale: why this and not the alternative",
    ],
    notThis: [
      "Every package in your lockfile — only things worth a decision",
      "How to set it up — that is a Tech Docs runbook",
    ],
    example: [
      { label: "Name", value: "Resend" },
      { label: "Category", value: "Backend" },
      { label: "Status", value: "Adopted" },
      { label: "Version", value: "API v1" },
      { label: "Description", value: "Sends transactional email, including password reset links." },
      { label: "Rationale", value: "Chosen over self-hosted SMTP because deliverability and DKIM setup are handled for us. Cheaper than SES at our volume." },
    ],
    tip: "Marking things Deprecated is as valuable as adding new ones. It tells people what not to build on.",
  },

  mockups: {
    whatItIs: "A link to a design for a specific screen, with its review state.",
    whyItMatters: "Designs live in another tool. This keeps the link, the screen name, and whether it is approved next to the work.",
    writeThis: [
      "Which screen or page it is",
      "The design URL, in Figma or wherever it lives",
      "Its review status, and what changed if it was revised",
    ],
    notThis: [
      "The image pasted in with no link — link the source so it stays current",
      "A whole flow — that is a User Journey",
    ],
    example: [
      { label: "Title", value: "Forgot password — email entry" },
      { label: "Screen / Page", value: "/forgot-password" },
      { label: "Status", value: "Approved" },
      { label: "Design URL", value: "https://figma.com/file/abc/reset-flow?node-id=12-34" },
      { label: "Description", value: "Single email field with inline validation. Success state confirms which address received the link." },
    ],
    tip: "Link to the specific frame, not the whole file. Nobody wants to hunt for it.",
  },

  workflows: {
    whatItIs: "A repeatable process: something happens, then these steps run in order.",
    whyItMatters: "It makes the process the same every time regardless of who is doing it, and shows where it can be automated.",
    writeThis: [
      "The trigger — what starts it",
      "The steps in order, numbered",
      "Who or what does each step",
    ],
    notThis: [
      "What a customer experiences — that is a User Journey",
      "A one-off piece of work — that is a Task",
    ],
    example: [
      { label: "Title", value: "Password reset request handling" },
      { label: "Status", value: "Active" },
      { label: "Trigger", value: "User submits the forgot-password form" },
      { label: "Steps", value: "1. Check the email exists, and answer the same way either way\n2. Create a single-use token valid 30 minutes\n3. Send the reset email\n4. Record the attempt against the hourly limit\n5. Delete the token once used" },
    ],
    tip: "Number the steps and name the actor in each. 'It gets sent' hides who sends it.",
  },

  "business-rules": {
    whatItIs: "A rule the system must always enforce, written as a condition and the action that follows.",
    whyItMatters: "These rules get buried in code and then quietly contradict each other. Written down, they can be checked and tested.",
    writeThis: [
      "The condition — when this rule applies",
      "The action — what the system must then do",
      "Which category it is: validation, authorization, calculation, process or constraint",
    ],
    notThis: [
      "A capability the product should have — that is a Requirement",
      "Implementation detail like which function enforces it",
    ],
    example: [
      { label: "Title", value: "Reset requests limited to 3 per hour per email" },
      { label: "Category", value: "Constraint" },
      { label: "Status", value: "Active" },
      { label: "Condition", value: "A fourth password reset is requested for the same email within 60 minutes." },
      { label: "Action", value: "Reject the request, return the same generic confirmation as a success, and log the attempt for review." },
    ],
    tip: "Write it as 'when X, then Y'. If you cannot, it is probably a requirement rather than a rule.",
  },
};

/* ─────────────────────────────── templates ─────────────────────────────── */

export const MODULE_TEMPLATES: Record<string, ModuleTemplate[]> = {
  requirements: [
    {
      name: "Functional requirement",
      description: "Something the product must do for the user.",
      fields: {
        type: "Feature",
        priority: "Medium",
        description: "What the product must do:\n\nWho needs it and why:\n\nOut of scope:",
        acceptanceCriteria: "Given \nWhen \nThen \n\nGiven \nWhen \nThen ",
      },
    },
    {
      name: "Change to existing behaviour",
      description: "Something built already needs to work differently.",
      fields: {
        type: "Enhancement",
        priority: "Medium",
        description: "How it works today:\n\nHow it should work instead:\n\nWhy the change is needed:",
        acceptanceCriteria: "Given the old behaviour\nWhen \nThen the new behaviour applies\n\nNothing else changes:",
      },
    },
    {
      name: "Needs investigation first",
      description: "Not enough is known yet to commit to a solution.",
      fields: {
        type: "Research",
        status: "Draft",
        priority: "Low",
        description: "Question to answer:\n\nWhy it matters:\n\nHow we will decide:",
        acceptanceCriteria: "We can answer the question with evidence, and we have written the recommendation down.",
      },
    },
  ],

  features: [
    {
      name: "User-facing feature",
      description: "Something users will notice and use.",
      fields: {
        priority: "High",
        description: "What the user can do that they could not before:\n\nThe value to them:\n\nThe main flow:\n1. \n2. \n3. ",
      },
    },
    {
      name: "Internal improvement",
      description: "Cleanup or platform work with no visible change.",
      fields: {
        priority: "Medium",
        description: "The problem today:\n\nWhat it costs us:\n\nWhat changes:\n\nHow we know it worked:",
      },
    },
  ],

  "dev-tasks": [
    {
      name: "Build task",
      description: "Write or change code.",
      fields: {
        status: "Todo",
        priority: "Medium",
        estimatedTime: 4,
        description: "What to build:\n\nWhere in the code:\n\nDone when:",
      },
    },
    {
      name: "Investigation (spike)",
      description: "Time-boxed digging to answer a question.",
      fields: {
        status: "Todo",
        priority: "Medium",
        estimatedTime: 4,
        description: "Question to answer:\n\nTime box:\n\nWhat we will write down at the end:",
      },
    },
    {
      name: "Review / QA task",
      description: "Check work someone else did.",
      fields: {
        status: "Todo",
        priority: "Medium",
        estimatedTime: 2,
        description: "What to check:\n\nHow to check it:\n\nWhat blocks approval:",
      },
    },
  ],

  bugs: [
    {
      name: "Functional bug",
      description: "Something behaves wrongly.",
      fields: {
        severity: "Medium",
        environment: "Dev",
        description: "What is wrong, in one line:\n\nHow often it happens:",
        stepsToReproduce: "1. \n2. \n3. ",
        expectedResult: "",
        actualResult: "",
      },
    },
    {
      name: "Crash or error",
      description: "The app fails outright or throws an error.",
      fields: {
        severity: "Critical",
        environment: "Production",
        description: "What the user was doing when it failed:\n\nError message or code:\n\nHow many users are affected:",
        stepsToReproduce: "1. \n2. \n3. ",
        expectedResult: "The action completes without an error.",
        actualResult: "The app shows an error and the action does not complete.",
      },
    },
    {
      name: "Visual / layout bug",
      description: "It works, but it looks wrong.",
      fields: {
        severity: "Low",
        environment: "Dev",
        description: "What looks wrong:\n\nBrowser / device / screen size:",
        stepsToReproduce: "1. \n2. ",
        expectedResult: "",
        actualResult: "",
      },
    },
  ],

  releases: [
    {
      name: "Planned release",
      description: "A version scheduled but not out yet.",
      fields: {
        status: "Planned",
        version: "v",
        releaseNotes: "What is going out:\n\nAnything users must do:\n\nHow to roll back:",
      },
    },
    {
      name: "Hotfix",
      description: "An urgent fix going out on its own.",
      fields: {
        status: "In Progress",
        version: "v",
        releaseNotes: "What was broken:\n\nWhat the fix does:\n\nWho was affected:",
      },
    },
  ],

  "api-docs": [
    {
      name: "Read endpoint (GET)",
      description: "Returns data, changes nothing.",
      fields: {
        httpMethod: "GET",
        authentication: "Bearer",
        status: "Draft",
        requestBody: "No body. Query parameters:\n?page=1&limit=20",
        responseBody: '{\n  "data": [],\n  "pagination": { "page": 1, "limit": 20, "total": 0 }\n}',
      },
    },
    {
      name: "Write endpoint (POST)",
      description: "Creates something.",
      fields: {
        httpMethod: "POST",
        authentication: "Bearer",
        status: "Draft",
        requestBody: '{\n  "field": "value"\n}',
        responseBody: '{\n  "id": 1,\n  "field": "value"\n}',
      },
    },
  ],

  "arch-docs": [
    {
      name: "Decision record",
      description: "What was chosen, and why, and what was rejected.",
      fields: {
        category: "Decision",
        content: "## Context\nWhat forced a decision here.\n\n## Options considered\n1. \n2. \n\n## Decision\nWhat we chose.\n\n## Why\n\n## What this costs us\nThe downside we accepted.",
      },
    },
    {
      name: "How it works",
      description: "Explain a part of the system.",
      fields: {
        category: "Architecture",
        content: "## What this covers\n\n## The pieces\n\n## How a request flows through it\n1. \n2. \n\n## Things that surprise people",
      },
    },
    {
      name: "Runbook",
      description: "Steps to follow when a specific thing happens.",
      fields: {
        category: "Runbook",
        content: "## When to use this\n\n## Before you start\nAccess and tools you need.\n\n## Steps\n1. \n2. \n\n## How to confirm it worked\n\n## If it goes wrong\nWho to contact.",
      },
    },
  ],

  "meeting-notes": [
    {
      name: "Daily standup",
      description: "Short daily sync.",
      fields: {
        summary: "Yesterday:\n\nToday:\n\nBlocked by:",
        decisions: "",
        actionItems: "- [ ] ",
      },
    },
    {
      name: "Sprint planning",
      description: "Agreeing what goes into the sprint.",
      fields: {
        summary: "Capacity available:\n\nWhat we discussed:",
        decisions: "Sprint goal:\n\nCommitted work:\n\nExplicitly left out:",
        actionItems: "- [ ] ",
      },
    },
    {
      name: "Retrospective",
      description: "Looking back at the last period.",
      fields: {
        summary: "What went well:\n\nWhat did not:",
        decisions: "What we will change next sprint:",
        actionItems: "- [ ] ",
      },
    },
    {
      name: "Client / stakeholder call",
      description: "A conversation with someone outside the team.",
      fields: {
        summary: "What they asked for:\n\nWhat we told them:\n\nConcerns they raised:",
        decisions: "Agreed:\n\nStill open:",
        actionItems: "- [ ] ",
      },
    },
  ],

  risks: [
    {
      name: "Technical risk",
      description: "The system might fail in some way.",
      fields: {
        impact: "High",
        probability: "Medium",
        status: "Open",
        description: "What could fail:\n\nWhat happens if it does:\n\nHow we would notice:",
        mitigationPlan: "What reduces the chance:\n\nWhat we do if it happens anyway:\n\nOwner:",
      },
    },
    {
      name: "Schedule risk",
      description: "The date might slip.",
      fields: {
        impact: "Medium",
        probability: "High",
        status: "Open",
        description: "What could delay us:\n\nHow much slip we expect:\n\nWhat it blocks:",
        mitigationPlan: "What we cut or move first:\n\nWhen we decide:\n\nOwner:",
      },
    },
    {
      name: "Dependency risk",
      description: "Something outside our control might not arrive.",
      fields: {
        impact: "High",
        probability: "Medium",
        status: "Open",
        description: "What we depend on:\n\nWho controls it:\n\nWhat we cannot do without it:",
        mitigationPlan: "Fallback if it does not arrive:\n\nWhen we stop waiting:\n\nOwner:",
      },
    },
  ],

  ideas: [
    {
      name: "Product idea",
      description: "Something new for users.",
      fields: {
        impact: 3,
        effort: 3,
        status: "New",
        description: "The idea in one line:\n\nWho it helps:\n\nWhy now:",
      },
    },
    {
      name: "Improvement idea",
      description: "Make something existing better.",
      fields: {
        impact: 2,
        effort: 2,
        status: "New",
        description: "What is annoying today:\n\nWhat would be better:\n\nRough guess at the win:",
      },
    },
  ],

  milestones: [
    {
      name: "Launch milestone",
      description: "Something goes live for users.",
      fields: {
        status: "Upcoming",
        progress: 0,
      },
    },
    {
      name: "Demo or review",
      description: "Showing work to people outside the team.",
      fields: {
        status: "Upcoming",
        progress: 0,
      },
    },
  ],

  sprints: [
    {
      name: "Two-week sprint",
      description: "Standard iteration.",
      fields: {
        status: "Planned",
        goal: "Sprint goal in one sentence:\n\nWhat is in scope:\n\nWhat is explicitly out:",
      },
    },
    {
      name: "Hardening sprint",
      description: "Bugs and stability, no new features.",
      fields: {
        status: "Planned",
        goal: "Get the open bug count under X and fix the top stability problems. No new features.",
      },
    },
  ],

  "user-stories": [
    {
      name: "Main flow story",
      description: "The normal path a user takes.",
      fields: {
        priority: "High",
        role: "",
        goal: "",
        benefit: "",
        acceptanceCriteria: "Given \nWhen \nThen \n\nGiven \nWhen \nThen ",
      },
    },
    {
      name: "Error / edge case story",
      description: "What happens when things go wrong.",
      fields: {
        priority: "Medium",
        role: "",
        goal: "",
        benefit: "",
        acceptanceCriteria: "Given something invalid or missing\nWhen the user tries anyway\nThen they see a clear message explaining what to do next",
      },
    },
  ],

  personas: [
    {
      name: "Primary user",
      description: "The person the product is mainly for.",
      fields: {
        status: "Draft",
        goals: "What they are trying to get done:\n\nHow they measure success:",
        painPoints: "What frustrates them today:\n\nWhat they work around:",
        behaviors: "How often they use it:\n\nDevice and setting:\n\nHow much they will read before giving up:",
      },
    },
    {
      name: "Admin / power user",
      description: "Uses it heavily and configures it for others.",
      fields: {
        status: "Draft",
        goals: "What they manage:\n\nWhat they need visibility into:",
        painPoints: "Where the tool slows them down:\n\nWhat they do in bulk:",
        behaviors: "Keyboard or mouse:\n\nHow much they tolerate complexity for power:",
      },
    },
  ],

  "user-journeys": [
    {
      name: "First-time use",
      description: "From hearing about it to first success.",
      fields: {
        stage: "Onboarding",
        touchpoints: "1. \n2. \n3. ",
        description: "The goal they arrive with:\n\nWhat success looks like for them:",
        painPoints: "Where they hesitate:\n\nWhere they drop off:",
        opportunities: "What would remove the friction:",
      },
    },
    {
      name: "Recovery journey",
      description: "Getting back on track after something goes wrong.",
      fields: {
        stage: "Retention",
        touchpoints: "1. \n2. \n3. ",
        description: "What went wrong for them:\n\nWhat they need to get back to normal:",
        painPoints: "Where they get stuck:\n\nWhere they give up and contact support:",
        opportunities: "How they could fix it themselves:",
      },
    },
  ],

  "tech-stack": [
    {
      name: "New technology being evaluated",
      description: "Considering it, not committed yet.",
      fields: {
        status: "Evaluating",
        description: "What it would do for us:",
        rationale: "Alternatives considered:\n\nWhat we like:\n\nWhat worries us:\n\nHow we will decide:",
      },
    },
    {
      name: "Adopted technology",
      description: "Already in use in production.",
      fields: {
        status: "Adopted",
        description: "What it does in our system:\n\nWhere it is used:",
        rationale: "Why this over the alternative:\n\nWhat it would cost to replace:",
      },
    },
    {
      name: "Deprecated technology",
      description: "On the way out — do not build new work on it.",
      fields: {
        status: "Deprecated",
        description: "What still depends on it:",
        rationale: "Why we are moving off:\n\nWhat replaces it:\n\nTarget date to remove:",
      },
    },
  ],

  mockups: [
    {
      name: "New screen design",
      description: "A screen that does not exist yet.",
      fields: {
        status: "Draft",
        url: "https://",
        description: "What the screen is for:\n\nMain elements:\n\nWhat the user does here:\n\nEmpty, loading and error states:",
      },
    },
    {
      name: "Redesign of existing screen",
      description: "Changing a screen that already ships.",
      fields: {
        status: "In Review",
        url: "https://",
        description: "What is changing and why:\n\nWhat stays the same:\n\nAnything users will have to relearn:",
      },
    },
  ],

  workflows: [
    {
      name: "Automated process",
      description: "Runs by itself when something triggers it.",
      fields: {
        status: "Draft",
        trigger: "",
        description: "What this process achieves:\n\nHow often it runs:",
        steps: "1. \n2. \n3. \n\nIf a step fails:\n\nHow we know it ran:",
      },
    },
    {
      name: "Manual process",
      description: "A person carries out the steps.",
      fields: {
        status: "Draft",
        trigger: "",
        description: "When someone does this:\n\nWho is responsible:",
        steps: "1. \n2. \n3. \n\nWho to ask if unsure:",
      },
    },
    {
      name: "Approval process",
      description: "Something needs sign-off to move on.",
      fields: {
        status: "Draft",
        trigger: "",
        description: "What needs approving:\n\nWho approves it:",
        steps: "1. Request is submitted\n2. Reviewer checks:\n3. Approved or sent back with reasons\n4. \n\nWhat happens if nobody responds:",
      },
    },
  ],

  "business-rules": [
    {
      name: "Validation rule",
      description: "Data must look a certain way to be accepted.",
      fields: {
        category: "Validation",
        status: "Draft",
        description: "What this rule protects against:",
        condition: "When ",
        action: "Then reject it and show: ",
      },
    },
    {
      name: "Permission rule",
      description: "Who is allowed to do what.",
      fields: {
        category: "Authorization",
        status: "Draft",
        description: "What this rule protects:",
        condition: "When a user with role ... tries to ",
        action: "Then allow / deny, and: ",
      },
    },
    {
      name: "Calculation rule",
      description: "How a value is worked out.",
      fields: {
        category: "Calculation",
        status: "Draft",
        description: "What is being calculated and where it shows up:",
        condition: "When ",
        action: "Then the value is calculated as: \n\nRounding:\n\nWhat happens with missing inputs:",
      },
    },
    {
      name: "Limit / constraint",
      description: "A cap or boundary the system enforces.",
      fields: {
        category: "Constraint",
        status: "Draft",
        description: "Why the limit exists:",
        condition: "When the limit of ... is reached",
        action: "Then: \n\nWhat the user sees:",
      },
    },
  ],
};

/* ───────────────────────── field-level overrides ───────────────────────── */

/**
 * Keyed `"<moduleSlug>.<fieldKey>"`. Only fields whose meaning is specific to
 * their module need an entry — everything else falls back to the generic help
 * built by `buildFieldHelp` from the field's label and type.
 */
export const FIELD_HELP: Record<string, Partial<FieldHelpContent>> = {
  "requirements.acceptanceCriteria": {
    whatItIs: "The checks that decide whether this requirement is finished. If they all pass, it is done.",
    whyItMatters: "Without these, 'done' is an opinion and the same work gets argued over twice.",
    example: "Given a registered email, when the user requests a reset, then a link valid for 30 minutes is emailed.",
    template: "Given [starting situation]\nWhen [the user does something]\nThen [what must happen]",
    tip: "Write these before building, not after. They are the definition of done, not a report on it.",
  },
  "requirements.type": {
    whatItIs: "What kind of requirement this is: new capability, a defect to correct, an improvement, or something to investigate first.",
    whyItMatters: "It sets expectations about how much design work is needed before anyone builds.",
    example: "Feature",
    template: "Feature for something new, Enhancement for changing existing behaviour, Bug for correcting it, Research when you do not know enough yet.",
  },
  "requirements.parentId": {
    whatItIs: "Link to a bigger requirement that this one is part of.",
    whyItMatters: "It lets you break a large requirement into pieces without losing the connection between them.",
    example: "Account management",
    template: "Leave blank unless this really is a slice of a larger requirement.",
  },

  "features.storyPoints": {
    whatItIs: "A rough size for the feature — effort and uncertainty together, not hours.",
    whyItMatters: "It lets the team compare sizes and forecast without pretending to know exact hours.",
    example: "5",
    template: "Use 1, 2, 3, 5, 8 or 13. Bigger than 13 means split the feature.",
    tip: "Compare against a feature you already shipped. 'About twice that one' is a better estimate than a number from nowhere.",
  },
  "features.epic": {
    whatItIs: "The larger theme this feature belongs to, like 'Account management' or 'Reporting'.",
    whyItMatters: "It groups related features so a roadmap can be read at a glance.",
    example: "Account management",
    template: "Reuse an epic name you already use elsewhere rather than inventing a new one.",
  },

  "dev-tasks.estimatedTime": {
    whatItIs: "How many hours you think this will take before you start.",
    whyItMatters: "Comparing it to the actual time is how estimates get better over time.",
    example: "6",
    template: "Hours as a plain number. If your answer is over 16, the task is too big.",
  },
  "dev-tasks.actualTime": {
    whatItIs: "How many hours it really took, filled in once it is done.",
    whyItMatters: "This is the only feedback that makes future estimates less wrong.",
    example: "9",
    template: "Fill this in when you close the task, while you still remember.",
  },

  "bugs.stepsToReproduce": {
    whatItIs: "Numbered steps another person can follow on their own machine to see the problem happen.",
    whyItMatters: "A bug nobody else can reproduce does not get fixed. This field decides that.",
    example: "1. Go to /forgot-password\n2. Enter Alex@Example.com\n3. Press Send link",
    template: "1. Start from [page or state]\n2. Do [action]\n3. Do [action]\n\nHappens every time / sometimes:",
    tip: "Start from a fresh login or a known state. 'Then it breaks' with no starting point is not reproducible.",
  },
  "bugs.expectedResult": {
    whatItIs: "What should have happened after those steps.",
    whyItMatters: "Sometimes the behaviour is correct and the expectation is wrong. This is where that surfaces.",
    example: "A reset email is sent and a confirmation message appears.",
    template: "State the correct behaviour in one sentence.",
  },
  "bugs.actualResult": {
    whatItIs: "What actually happened, including any error text.",
    whyItMatters: "The exact error message is often what identifies the cause immediately.",
    example: "The page shows 'Something went wrong' and no email arrives.",
    template: "What you saw, plus the exact error text or code if there was one.",
  },
  "bugs.environment": {
    whatItIs: "Where you saw it: a developer machine, staging, or the live product.",
    whyItMatters: "A bug in production affects real people and jumps the queue.",
    example: "Production",
    template: "Dev for local, Staging for pre-release testing, Production for the live product.",
  },

  "releases.releaseNotes": {
    whatItIs: "What changed in this version, written for the people who use the product.",
    whyItMatters: "It is what users and support read to understand what is different today.",
    example: "Added self-serve password reset.\nFixed reset links failing for uppercase emails.",
    template: "One line per change. Say what changed for the user, not which files moved.",
    tip: "Avoid internal names. 'Fixed the token TTL bug' means nothing outside the team.",
  },
  "releases.version": {
    whatItIs: "The version number for this release.",
    whyItMatters: "It is how everyone refers to a specific build in bug reports and rollbacks.",
    example: "v1.4.0",
    template: "vMAJOR.MINOR.PATCH — raise patch for fixes, minor for features, major for breaking changes.",
  },

  "api-docs.requestBody": {
    whatItIs: "An example of what a caller sends to this endpoint.",
    whyItMatters: "A real example is faster to copy than a field table is to read.",
    example: '{ "token": "abc123", "password": "NewPass123!" }',
    template: "Paste real JSON you actually sent. For GET, list the query parameters instead.",
  },
  "api-docs.responseBody": {
    whatItIs: "An example of what this endpoint sends back on success.",
    whyItMatters: "Callers need the shape before they can write code against it.",
    example: '{ "success": true }',
    template: "Paste a real successful response. Note the error shape too if it differs.",
  },
  "api-docs.authentication": {
    whatItIs: "What a caller must present to be allowed to use this endpoint.",
    whyItMatters: "Getting this wrong is the most common reason an integration fails with a 401.",
    example: "Bearer",
    template: "None for public, Bearer for a JWT in the Authorization header, API Key for a static key, OAuth for a delegated flow.",
  },

  "arch-docs.content": {
    whatItIs: "The document itself — how something works, why a choice was made, or what steps to follow.",
    whyItMatters: "It replaces the same verbal explanation given repeatedly, and outlives the people who gave it.",
    example: "## Context\nEmail inboxes are often shared.\n\n## Decision\n30 minute single-use reset tokens.\n\n## Why\nA stale link in a shared inbox is a real account-takeover route.",
    template: "Use headings. For a decision: Context, Options considered, Decision, Why, What it costs us.",
    tip: "For a decision, the rejected options are the most valuable part. Write them down.",
  },
  "arch-docs.category": {
    whatItIs: "What kind of document this is, so people can find the right one.",
    whyItMatters: "A runbook and a decision record are read at completely different moments.",
    example: "Decision",
    template: "Architecture for how it fits together, Design for how it looks or behaves, Decision for a choice and its reasons, Runbook for steps to follow, Diagram for a picture.",
  },

  "meeting-notes.summary": {
    whatItIs: "A short account of what was discussed — not a transcript.",
    whyItMatters: "Someone who missed the meeting should be able to catch up in under a minute.",
    example: "Reviewed the reset flow and argued about link lifetime and rate limiting.",
    template: "Three to five sentences. What came up, and what was still unresolved at the end.",
  },
  "meeting-notes.decisions": {
    whatItIs: "What was actually settled in the meeting.",
    whyItMatters: "This is the part people come back to when memories differ. Keep it separate from discussion.",
    example: "Link expires in 30 minutes. Limit to 3 requests per hour per email.",
    template: "One decision per line, stated as a fact. Note anything deliberately left open.",
  },
  "meeting-notes.actionItems": {
    whatItIs: "The specific things people agreed to do next, each with a name.",
    whyItMatters: "An action item without an owner and a date does not happen.",
    example: "- [ ] Priya: add the rate limit by Jul 25\n- [ ] Sam: update the email copy",
    template: "- [ ] Name: what they will do, by when",
    tip: "Read the action items out loud before ending the meeting. Ownership gets negotiated fast that way.",
  },
  "meeting-notes.participants": {
    whatItIs: "Who was in the meeting.",
    whyItMatters: "It tells a later reader whose agreement a decision carries — and who was not consulted.",
    example: "Alex, Priya, Sam",
    template: "Names separated by commas. Note anyone who was invited but absent.",
  },

  "risks.mitigationPlan": {
    whatItIs: "What you are doing to make this less likely or less damaging, and who owns that.",
    whyItMatters: "A risk with no plan is just a worry written down. The plan is the useful part.",
    example: "Set up SPF, DKIM and DMARC before launch, and warm the domain for two weeks. Owner: Sam.",
    template: "To reduce the chance:\n\nIf it happens anyway:\n\nOwner:\n\nReview by:",
    tip: "Name a person, not a team. 'The team will monitor' means nobody will.",
  },
  "risks.probability": {
    whatItIs: "How likely this is to actually happen.",
    whyItMatters: "Combined with impact, it decides which risks get attention now.",
    example: "Medium",
    template: "Low if it would surprise you, Medium if it is plausible, High if you would not be surprised at all.",
  },
  "risks.impact": {
    whatItIs: "How much damage it would cause if it did happen.",
    whyItMatters: "A rare risk with severe impact still deserves a plan.",
    example: "High",
    template: "Low for an inconvenience, Medium for real disruption, High for lost data, money or trust.",
  },

  "ideas.impact": {
    whatItIs: "How much good this would do, from 1 for barely noticeable to 5 for a big win.",
    whyItMatters: "Scored against effort, it shows which ideas are worth acting on first.",
    example: "4",
    template: "1 to 5. Be honest — if everything scores 5 the score is useless.",
  },
  "ideas.effort": {
    whatItIs: "How much work this would take, from 1 for a quick change to 5 for a major project.",
    whyItMatters: "High impact and low effort is where you should look first, and this field finds it.",
    example: "2",
    template: "1 to 5. 1 is a day or less, 5 is multiple sprints.",
  },

  "milestones.progress": {
    whatItIs: "Roughly how far along this milestone is, as a percentage.",
    whyItMatters: "It is the number people outside the team look at, so keeping it honest keeps trust.",
    example: "60",
    template: "A number from 0 to 100. Base it on finished work, not on effort spent.",
    tip: "Nothing sits at 90% for weeks. If it does, the milestone was defined too loosely.",
  },
  "milestones.targetDate": {
    whatItIs: "The date this checkpoint is meant to be reached.",
    whyItMatters: "It is the date other people plan around, so moving it needs to be visible.",
    example: "2026-08-15",
    template: "Pick the date you would be comfortable telling a customer.",
  },

  "sprints.goal": {
    whatItIs: "The one outcome this sprint is aiming for, in a sentence.",
    whyItMatters: "It is what the team uses to decide trade-offs mid-sprint when something unexpected turns up.",
    example: "Ship password reset end to end on staging, with rate limiting in place.",
    template: "By the end of this sprint we will have [outcome], so that [why it matters].",
    tip: "One goal. If you write three, mid-sprint trade-offs have no tiebreaker.",
  },

  "user-stories.role": {
    whatItIs: "The kind of person who wants this — be specific about which kind.",
    whyItMatters: "'User' hides the differences that actually change the design.",
    example: "person who forgot my password",
    template: "A specific kind of user, like 'part-time admin' or 'first-time visitor'. Not just 'user'.",
  },
  "user-stories.goal": {
    whatItIs: "What that person is trying to do.",
    whyItMatters: "Stated as their goal rather than as a feature, it leaves room for a better solution.",
    example: "get a reset link by email",
    template: "Describe the outcome they want, not the button they press.",
  },
  "user-stories.benefit": {
    whatItIs: "Why they want it — what they get out of it.",
    whyItMatters: "This is what tells you whether the thing you built actually solved anything.",
    example: "I can get back in without waiting for support",
    template: "so that [the benefit they actually experience]",
    tip: "If this is hard to write, you may not yet know why you are building it.",
  },
  "user-stories.acceptanceCriteria": {
    whatItIs: "The checks that prove this story is delivered.",
    whyItMatters: "It is how the team and the reviewer agree on done without a conversation.",
    example: "Given my email is registered, when I request a reset, then I receive a link within one minute.",
    template: "Given [situation]\nWhen [action]\nThen [result]",
  },

  "personas.goals": {
    whatItIs: "What this person is trying to achieve when they use the product.",
    whyItMatters: "Design decisions get made against these goals rather than against guesses.",
    example: "Get in, update a handful of records, get out. Never wants to read documentation.",
    template: "What they want to accomplish:\n\nHow they judge whether it went well:",
  },
  "personas.painPoints": {
    whatItIs: "What frustrates this person today, in the product or around it.",
    whyItMatters: "These are the openings where an improvement will actually be noticed.",
    example: "Forgets her password between sessions because she logs in only twice a week.",
    template: "One frustration per line, based on something you have actually observed.",
  },
  "personas.behaviors": {
    whatItIs: "How this person actually works: how often, on what device, how much patience they have.",
    whyItMatters: "It is what makes the persona usable rather than decorative.",
    example: "Uses a shared desktop machine. Never saves passwords in the browser.",
    template: "How often they use it:\n\nDevice and setting:\n\nHow much they will read before giving up:",
    tip: "Only include behaviour that would change a decision.",
  },

  "user-journeys.touchpoints": {
    whatItIs: "The places the person passes through, in order, on the way to their goal.",
    whyItMatters: "Each handoff between touchpoints is where people get lost.",
    example: "Login screen → Forgot password → Email inbox → Reset form → Dashboard",
    template: "1. \n2. \n3. \n\nInclude places outside your product, like an email inbox.",
    tip: "Include the steps you do not control. Those are often where the journey breaks.",
  },
  "user-journeys.painPoints": {
    whatItIs: "Where this journey hurts or breaks down today.",
    whyItMatters: "It points at where to spend effort, in the order the user meets the problems.",
    example: "No clear message that the email was sent. The email arrives from an unfamiliar address.",
    template: "One problem per line, tied to the touchpoint where it happens.",
  },
  "user-journeys.opportunities": {
    whatItIs: "What could be done to make this journey better.",
    whyItMatters: "It turns observed problems into work you can actually schedule.",
    example: "Confirm on screen which address was used, and send from a recognisable sender name.",
    template: "One idea per line, each answering one of the pain points above.",
  },
  "user-journeys.stage": {
    whatItIs: "Where in their relationship with the product this journey sits.",
    whyItMatters: "A first-time visitor and a long-term user need very different things from the same screen.",
    example: "Onboarding",
    template: "Awareness before they know you, Consideration while weighing it up, Decision at sign-up, Onboarding for first use, Retention for ongoing use.",
  },

  "tech-stack.rationale": {
    whatItIs: "Why this technology and not the alternatives.",
    whyItMatters: "Without it, someone will re-litigate the decision every year from scratch.",
    example: "Chosen over self-hosted SMTP because deliverability and DKIM setup are handled for us. Cheaper than SES at our volume.",
    template: "Alternatives considered:\n\nWhy we chose this:\n\nWhat it costs us:\n\nWhat would make us change:",
    tip: "Record the downside you accepted. That is what a future reader most needs to know.",
  },
  "tech-stack.category": {
    whatItIs: "Which part of the system this technology belongs to.",
    whyItMatters: "It lets someone see the whole stack layer by layer.",
    example: "Backend",
    template: "Frontend, Backend, Database, DevOps, Testing, Mobile, or Other.",
  },

  "mockups.url": {
    whatItIs: "A link to where the design actually lives.",
    whyItMatters: "The linked design stays current; a pasted screenshot goes stale immediately.",
    example: "https://figma.com/file/abc/reset-flow?node-id=12-34",
    template: "A link straight to the specific frame, not just the file.",
    tip: "Check the link is viewable by the team, not just by you.",
  },
  "mockups.screen": {
    whatItIs: "Which screen or page this design is for.",
    whyItMatters: "It connects the design to the actual thing being built.",
    example: "/forgot-password",
    template: "The route or a name people already use for that screen.",
  },

  "workflows.trigger": {
    whatItIs: "What starts this process off.",
    whyItMatters: "Without a stated trigger, nobody knows when the process is supposed to run.",
    example: "User submits the forgot-password form",
    template: "An event, a schedule, or a person doing something specific.",
  },
  "workflows.steps": {
    whatItIs: "What happens, in order, once the process starts.",
    whyItMatters: "Written down, the process runs the same way no matter who is doing it.",
    example: "1. Check the email exists\n2. Create a single-use token valid 30 minutes\n3. Send the reset email\n4. Delete the token once used",
    template: "1. [who] does [what]\n2. \n3. \n\nIf a step fails:\n\nHow we know it ran:",
    tip: "Name the actor in each step. 'It gets sent' hides who sends it.",
  },

  "business-rules.condition": {
    whatItIs: "When this rule applies — the situation that sets it off.",
    whyItMatters: "A rule with a fuzzy condition gets implemented differently in each place it is needed.",
    example: "A fourth password reset is requested for the same email within 60 minutes.",
    template: "When [specific, checkable situation]",
    tip: "It should be precise enough to write a test for. If it is not, keep sharpening it.",
  },
  "business-rules.action": {
    whatItIs: "What the system must do when that condition is met.",
    whyItMatters: "This is the enforceable half of the rule.",
    example: "Reject the request, return the same generic confirmation as a success, and log the attempt.",
    template: "Then [what the system does], and [what the user sees].",
  },
  "business-rules.category": {
    whatItIs: "What kind of rule this is.",
    whyItMatters: "It groups rules so contradictions between them are easier to spot.",
    example: "Constraint",
    template: "Validation for checking data, Authorization for who may act, Calculation for deriving values, Process for ordering steps, Constraint for limits.",
  },
};

export function getModuleHelp(slug: string): ModuleHelp | undefined {
  return MODULE_HELP[slug];
}

export function getModuleTemplates(slug: string): ModuleTemplate[] {
  return MODULE_TEMPLATES[slug] ?? [];
}

export function getFieldHelp(slug: string, fieldKey: string): Partial<FieldHelpContent> | undefined {
  return FIELD_HELP[`${slug}.${fieldKey}`];
}
