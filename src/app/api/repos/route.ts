import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchUserRepos } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check for PAT in header (fallback for restricted repos)
    const patHeader = request.headers.get("x-github-pat");
    
    // Use PAT if provided, otherwise use OAuth token
    const accessToken = patHeader || session?.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized - No access token available" },
        { status: 401 }
      );
    }

    const repos = await fetchUserRepos(accessToken);

    // Return a simplified list of repos
    const simplifiedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      owner: repo.owner.login,
      ownerAvatar: repo.owner.avatar_url,
      language: repo.language,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      url: repo.html_url,
    }));

    return NextResponse.json({ 
      repos: simplifiedRepos,
      usingPat: !!patHeader,
    });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
