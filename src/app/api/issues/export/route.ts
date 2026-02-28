import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, issueAssignees, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, and, inArray, like, or } from "drizzle-orm";
import PDFDocument from "pdfkit";

export async function GET(request: NextRequest) {
    try {
        const authUser = getAuthUser(request);

        if (!authUser) {
            return NextResponse.json(
                { error: "Unauthorized", code: "UNAUTHORIZED" },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const projectId = searchParams.get("projectId");
        const assignedToMe = searchParams.get("assignedToMe") === "true";
        const search = searchParams.get("search") || "";
        const type = searchParams.get("type");
        const status = searchParams.get("status");
        const priority = searchParams.get("priority");

        // Get user's projects
        const userMemberships = await db.query.projectMembers.findMany({
            where: eq(projectMembers.userId, authUser.id),
        });
        const projectIds = userMemberships.map(m => m.projectId);

        if (projectIds.length === 0) {
            return NextResponse.json({ error: "No projects found" }, { status: 404 });
        }

        let assignedIssueIds: number[] = [];
        if (assignedToMe) {
            const assignments = await db.query.issueAssignees.findMany({
                where: eq(issueAssignees.userId, authUser.id),
            });
            assignedIssueIds = assignments.map(a => a.issueId);
        }

        let whereClause = inArray(issues.projectId, projectIds);

        if (assignedToMe && assignedIssueIds.length > 0) {
            whereClause = and(whereClause, inArray(issues.id, assignedIssueIds)) as typeof whereClause;
        }

        if (projectId) {
            whereClause = and(whereClause, eq(issues.projectId, parseInt(projectId))) as typeof whereClause;
        }

        if (search) {
            whereClause = and(
                whereClause,
                or(
                    like(issues.title, `%${search}%`),
                    like(issues.description, `%${search}%`)
                )
            ) as typeof whereClause;
        }

        if (type) {
            whereClause = and(whereClause, eq(issues.type, type as "Bug" | "Feature")) as typeof whereClause;
        }

        if (status) {
            whereClause = and(whereClause, eq(issues.status, status as "Open" | "In Progress" | "In Review" | "Verified" | "Closed")) as typeof whereClause;
        }

        if (priority) {
            whereClause = and(whereClause, eq(issues.priority, priority as "Low" | "Medium" | "High" | "Critical")) as typeof whereClause;
        }

        const issueList = await db.query.issues.findMany({
            where: whereClause,
            with: {
                project: true,
                reporter: { columns: { id: true, name: true, email: true } },
                assignees: { with: { user: { columns: { id: true, name: true, email: true } } } },
            },
            orderBy: desc(issues.updatedAt),
        });

        // Create a PDF using PDFKit
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on("data", buffers.push.bind(buffers));
                doc.on("end", () => {
                    resolve(Buffer.concat(buffers));
                });

                // Title
                doc.fontSize(20).text(`Bugbase Issues Export`, { align: "center" });
                doc.moveDown();

                let subtitleText = "Filter: All Issues";
                if (projectId && issueList.length > 0) {
                    subtitleText = `Project: ${issueList[0].project.name}`;
                } else if (assignedToMe) {
                    subtitleText = "My Assigned Issues";
                }

                doc.fontSize(12).fillColor("gray").text(subtitleText, { align: "center" });
                doc.moveDown(2);

                // Header
                const startY = doc.y;
                doc.fillColor("black").fontSize(10).font("Helvetica-Bold");
                doc.text("ID", 50, startY);
                doc.text("Title", 100, startY);
                doc.text("Type", 300, startY);
                doc.text("Status", 360, startY);
                doc.text("Priority", 420, startY);
                doc.text("Assignees", 480, startY);

                doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();

                let cursorY = startY + 20;

                doc.font("Helvetica").fontSize(9);

                // Rows
                for (const issue of issueList) {
                    if (cursorY > 700) {
                        doc.addPage();
                        cursorY = 50;
                        // re-draw header
                        doc.font("Helvetica-Bold");
                        doc.text("ID", 50, cursorY);
                        doc.text("Title", 100, cursorY);
                        doc.text("Type", 300, cursorY);
                        doc.text("Status", 360, cursorY);
                        doc.text("Priority", 420, cursorY);
                        doc.text("Assignees", 480, cursorY);
                        doc.moveTo(50, cursorY + 15).lineTo(550, cursorY + 15).stroke();
                        cursorY += 20;
                        doc.font("Helvetica");
                    }

                    // truncate title
                    let safeTitle = issue.title.substring(0, 35);
                    if (issue.title.length > 35) safeTitle += "...";

                    const typeText = issue.type;
                    const statusText = issue.status;
                    const priorityText = issue.priority;
                    const assigneesCount = issue.assignees.length;
                    const assigneesStr = assigneesCount > 0 ? `${assigneesCount} assigned` : "Unassigned";

                    doc.text(`#${issue.id}`, 50, cursorY);
                    doc.text(safeTitle, 100, cursorY);
                    doc.text(typeText, 300, cursorY);
                    doc.text(statusText, 360, cursorY);
                    doc.text(priorityText, 420, cursorY);
                    doc.text(assigneesStr, 480, cursorY);

                    cursorY += 20;
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="issues_export_${Date.now()}.pdf"`,
            },
        });

    } catch (error) {
        console.error("Export issues error:", error);
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}
