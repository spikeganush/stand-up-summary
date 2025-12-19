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
    const where: { userId: string; summaryDate?: Date } = { userId: user.id };

    if (date) {
      where.summaryDate = new Date(date);
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
      totalCommits,
      totalAdditions,
      totalDeletions,
      totalFiles,
      complexityLevel,
      jiraTickets,
      repositories,
      commitsData,
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
        totalCommits: totalCommits || 0,
        totalAdditions: totalAdditions || 0,
        totalDeletions: totalDeletions || 0,
        totalFiles: totalFiles || 0,
        complexityLevel: complexityLevel || "simple",
        jiraTickets: jiraTickets || [],
        repositories: repositories || [],
        commitsData: commitsData || null,
        llmProvider: llmProvider || null,
      },
      create: {
        userId: user.id,
        summaryDate: new Date(summaryDate),
        summaryText,
        bulletPoints: bulletPoints || [],
        highlights: highlights || [],
        totalCommits: totalCommits || 0,
        totalAdditions: totalAdditions || 0,
        totalDeletions: totalDeletions || 0,
        totalFiles: totalFiles || 0,
        complexityLevel: complexityLevel || "simple",
        jiraTickets: jiraTickets || [],
        repositories: repositories || [],
        commitsData: commitsData || null,
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
