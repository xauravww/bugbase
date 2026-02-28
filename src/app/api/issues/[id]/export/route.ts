import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";

// GET /api/issues/[id]/export
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = getAuthUser(request);

        if (!authUser) {
            return NextResponse.json(
                { error: "Unauthorized", code: "UNAUTHORIZED" },
                { status: 401 }
            );
        }

        const { id } = await params;
        const issueId = parseInt(id);

        if (isNaN(issueId)) {
            return NextResponse.json(
                { error: "Invalid issue ID", code: "INVALID_ID" },
                { status: 400 }
            );
        }

        const issue = await db.query.issues.findFirst({
            where: eq(issues.id, issueId),
            with: {
                project: true,
                reporter: { columns: { id: true, name: true, email: true } },
                assignees: { with: { user: { columns: { id: true, name: true, email: true } } } },
                verifiers: { with: { user: { columns: { id: true, name: true, email: true } } } },
                comments: {
                    with: { user: { columns: { id: true, name: true } } },
                },
            },
        });

        if (!issue) {
            return NextResponse.json(
                { error: "Issue not found", code: "NOT_FOUND" },
                { status: 404 }
            );
        }

        const membership = await db.query.projectMembers.findFirst({
            where: and(
                eq(projectMembers.projectId, issue.projectId),
                eq(projectMembers.userId, authUser.id)
            ),
        });

        if (!membership && authUser.role !== "Admin") {
            return NextResponse.json(
                { error: "Forbidden", code: "FORBIDDEN" },
                { status: 403 }
            );
        }

        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on("data", buffers.push.bind(buffers));
                doc.on("end", () => {
                    resolve(Buffer.concat(buffers));
                });

                // Header
                doc.fontSize(22).font("Helvetica-Bold").text(`#${issue.id} - ${issue.title}`);
                doc.fontSize(12).font("Helvetica").fillColor("gray").text(`Project: ${issue.project.name}`);
                doc.moveDown(2);

                // Attributes Table
                doc.fillColor("black").fontSize(11).font("Helvetica-Bold");
                doc.text("Issue Type:", 50, doc.y, { continued: true }).font("Helvetica").text(` ${issue.type}`);
                doc.font("Helvetica-Bold").text("Status:", 50, doc.y, { continued: true }).font("Helvetica").text(` ${issue.status}`);
                doc.font("Helvetica-Bold").text("Priority:", 50, doc.y, { continued: true }).font("Helvetica").text(` ${issue.priority}`);

                const assignees = issue.assignees.map(a => a.user.name).join(", ") || "None";
                doc.font("Helvetica-Bold").text("Assignees:", 50, doc.y, { continued: true }).font("Helvetica").text(` ${assignees}`);

                doc.moveDown(2);

                // Contents
                if (issue.description) {
                    doc.font("Helvetica-Bold").fontSize(14).text("Description");
                    doc.moveDown(0.5);
                    doc.font("Helvetica").fontSize(11).text(issue.description);
                    doc.moveDown(1.5);
                }

                if (issue.type === "Bug") {
                    if (issue.stepsToReproduce) {
                        doc.font("Helvetica-Bold").fontSize(14).text("Steps to Reproduce");
                        doc.moveDown(0.5);
                        doc.font("Helvetica").fontSize(11).text(issue.stepsToReproduce);
                        doc.moveDown(1.5);
                    }
                    if (issue.expectedResult) {
                        doc.font("Helvetica-Bold").fontSize(14).text("Expected Result");
                        doc.moveDown(0.5);
                        doc.font("Helvetica").fontSize(11).text(issue.expectedResult);
                        doc.moveDown(1.5);
                    }
                    if (issue.actualResult) {
                        doc.font("Helvetica-Bold").fontSize(14).text("Actual Result");
                        doc.moveDown(0.5);
                        doc.font("Helvetica").fontSize(11).text(issue.actualResult);
                        doc.moveDown(1.5);
                    }
                }

                // Comments
                if (issue.comments.length > 0) {
                    doc.addPage();
                    doc.font("Helvetica-Bold").fontSize(16).text("Comments");
                    doc.moveDown();

                    for (const comment of issue.comments) {
                        const dateStr = comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Unknown date";
                        doc.font("Helvetica-Bold").fontSize(10).text(`${comment.user.name} on ${dateStr}`);
                        doc.moveDown(0.2);
                        doc.font("Helvetica").fontSize(11).text(comment.body);
                        doc.moveDown(1);
                    }
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
                "Content-Disposition": `attachment; filename="issue_${issue.id}_export.pdf"`,
            },
        });

    } catch (error) {
        console.error("Export issue error:", error);
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}
