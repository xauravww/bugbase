import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getAuthUser } from "@/lib/auth";

const execAsync = promisify(exec);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    let gitCmd = 'git log --pretty=format:"%h - %an, %ar : %s" -n 50';
    if (since) gitCmd += ` --since="${since} 00:00:00"`;
    if (until) gitCmd += ` --until="${until} 23:59:59"`;

    try {
      const { stdout } = await execAsync(gitCmd, { cwd: process.cwd() });
      return NextResponse.json({ commits: stdout || "No commits found in this date range." });
    } catch (gitErr) {
      console.error("Git log failed:", gitErr);
      return NextResponse.json({ commits: "Failed to fetch git commits. Git might not be initialized." });
    }
  } catch (error) {
    console.error("GET git-commits error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
