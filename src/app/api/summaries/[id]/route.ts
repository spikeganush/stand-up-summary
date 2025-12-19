import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Retrieve a single summary by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { githubId: session.user.id || "" },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the summary by ID, ensuring it belongs to the authenticated user
    const summary = await prisma.summary.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Error fetching summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a summary by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { githubId: session.user.id || "" },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the summary first to ensure it exists and belongs to the user
    const summary = await prisma.summary.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!summary) {
      return NextResponse.json({ error: "Summary not found" }, { status: 404 });
    }

    // Find the closest summary to navigate to after deletion
    // Try to find the next summary (more recent)
    const nextSummary = await prisma.summary.findFirst({
      where: {
        userId: user.id,
        id: { not: id },
        summaryDate: { gt: summary.summaryDate },
      },
      orderBy: { summaryDate: "asc" },
      select: { id: true },
    });

    // If no next summary, find the previous one (older)
    const previousSummary = !nextSummary
      ? await prisma.summary.findFirst({
          where: {
            userId: user.id,
            id: { not: id },
            summaryDate: { lt: summary.summaryDate },
          },
          orderBy: { summaryDate: "desc" },
          select: { id: true },
        })
      : null;

    const nextId = nextSummary?.id || previousSummary?.id || null;

    // Delete the summary
    await prisma.summary.delete({
      where: { id },
    });

    return NextResponse.json({ deleted: true, nextId });
  } catch (error) {
    console.error("Error deleting summary:", error);
    return NextResponse.json(
      { error: "Failed to delete summary" },
      { status: 500 }
    );
  }
}

