import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Retrieve summaries for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const month = searchParams.get("month"); // 0-11
    const year = searchParams.get("year");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Find or create user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { githubId: session.user.id || "" },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ summaries: [] });
    }

    // Build query
    interface SummaryWhereClause {
      userId: string;
      summaryDate?: Date | { gte: Date; lt: Date };
    }
    const where: SummaryWhereClause = { userId: user.id };

    if (date) {
      // For @db.Date fields, we need to match exactly on the date (no time component)
      // Parse the incoming date and create a Date at midnight UTC for that day
      const queryDate = new Date(date);
      const dateOnly = new Date(
        Date.UTC(
          queryDate.getUTCFullYear(),
          queryDate.getUTCMonth(),
          queryDate.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
      where.summaryDate = dateOnly;
    } else if (month !== null && year !== null) {
      // Filter by month/year range
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      const startDate = new Date(yearNum, monthNum, 1);
      const endDate = new Date(yearNum, monthNum + 1, 1);
      where.summaryDate = {
        gte: startDate,
        lt: endDate,
      };
    }

    const summaries = await prisma.summary.findMany({
      where,
      orderBy: { summaryDate: "desc" },
      take: limit,
    });

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch summaries" },
      { status: 500 }
    );
  }
}

// POST - Save a new summary
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      summaryDate,
      summaryText,
      bulletPoints,
      highlights,
      ticketSummaries,
      untracked,
      totalCommits,
      totalAdditions,
      totalDeletions,
      totalFiles,
      complexityLevel,
      jiraTickets,
      repositories,
      commitsData,
      pullRequestsData,
      llmProvider,
    } = body;

    if (!summaryDate || !summaryText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { githubId: session.user.id || "" },
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          githubId: session.user.id || `github_${Date.now()}`,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        },
      });
    }

    // Upsert summary (update if exists for this date, create otherwise)
    const summary = await prisma.summary.upsert({
      where: {
        userId_summaryDate: {
          userId: user.id,
          summaryDate: new Date(summaryDate),
        },
      },
      update: {
        summaryText,
        bulletPoints: bulletPoints || [],
        highlights: highlights || [],
        ticketSummaries: ticketSummaries || null,
        untracked: untracked || [],
        totalCommits: totalCommits || 0,
        totalAdditions: totalAdditions || 0,
        totalDeletions: totalDeletions || 0,
        totalFiles: totalFiles || 0,
        complexityLevel: complexityLevel || "simple",
        jiraTickets: jiraTickets || [],
        repositories: repositories || [],
        commitsData: commitsData || null,
        pullRequestsData: pullRequestsData || null,
        llmProvider: llmProvider || null,
      },
      create: {
        userId: user.id,
        summaryDate: new Date(summaryDate),
        summaryText,
        bulletPoints: bulletPoints || [],
        highlights: highlights || [],
        ticketSummaries: ticketSummaries || null,
        untracked: untracked || [],
        totalCommits: totalCommits || 0,
        totalAdditions: totalAdditions || 0,
        totalDeletions: totalDeletions || 0,
        totalFiles: totalFiles || 0,
        complexityLevel: complexityLevel || "simple",
        jiraTickets: jiraTickets || [],
        repositories: repositories || [],
        commitsData: commitsData || null,
        pullRequestsData: pullRequestsData || null,
        llmProvider: llmProvider || null,
      },
    });

    return NextResponse.json({ summary, saved: true });
  } catch (error) {
    console.error("Error saving summary:", error);
    return NextResponse.json(
      { error: "Failed to save summary" },
      { status: 500 }
    );
  }
}
