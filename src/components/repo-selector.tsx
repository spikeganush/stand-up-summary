"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsStore } from "@/stores/settings-store";
import { Search, GitBranch, Lock, Globe, Settings2, Check } from "lucide-react";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  owner: string;
  ownerAvatar: string;
  language: string | null;
  updatedAt: string;
  pushedAt: string;
  url: string;
}

interface RepoSelectorProps {
  className?: string;
}

export function RepoSelector({ className }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { selectedRepos, setSelectedRepos, githubPat, useGithubPat } =
    useSettingsStore();
  const [usingPat, setUsingPat] = useState(false);

  useEffect(() => {
    async function fetchRepos() {
      try {
        setLoading(true);
        setError(null);

        const headers: HeadersInit = {};
        if (useGithubPat && githubPat) {
          headers["x-github-pat"] = githubPat;
        }

        const response = await fetch("/api/repos", { headers });
        if (!response.ok) throw new Error("Failed to fetch repositories");
        const data = await response.json();
        setRepos(data.repos);
        setUsingPat(data.usingPat || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repos");
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      fetchRepos();
    }
  }, [isOpen, useGithubPat, githubPat]);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRepo = (fullName: string) => {
    if (selectedRepos.includes(fullName)) {
      setSelectedRepos(selectedRepos.filter((r) => r !== fullName));
    } else {
      setSelectedRepos([...selectedRepos, fullName]);
    }
  };

  const selectAll = () => {
    setSelectedRepos(filteredRepos.map((r) => r.fullName));
  };

  const clearAll = () => {
    setSelectedRepos([]);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          <Settings2 className="h-4 w-4" />
          <span>Select Repos</span>
          {selectedRepos.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedRepos.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Select Repositories</SheetTitle>
          <SheetDescription>
            Choose which repositories to include in your stand-up summary.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {selectedRepos.length} selected
            </span>
          </div>

          {/* Repo List */}
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedRepos.includes(repo.fullName)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent"
                    )}
                    onClick={() => toggleRepo(repo.fullName)}
                  >
                    <Checkbox
                      id={`repo-${repo.id}`}
                      checked={selectedRepos.includes(repo.fullName)}
                      onCheckedChange={() => toggleRepo(repo.fullName)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`repo-${repo.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {repo.name}
                        </Label>
                        {repo.private ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {repo.owner}
                        </span>
                        {repo.language && (
                          <>
                            <span>·</span>
                            <span>{repo.language}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedRepos.includes(repo.fullName) && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
