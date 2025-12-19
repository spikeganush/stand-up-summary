"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ComplexityMetrics } from "@/lib/llm";

interface ComplexityBadgeProps {
  level: ComplexityMetrics["level"];
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const levelConfig = {
  simple: {
    label: "Simple",
    className: "bg-simple/20 text-simple border-simple/30 hover:bg-simple/30",
    icon: "○",
  },
  moderate: {
    label: "Moderate",
    className: "bg-moderate/20 text-moderate border-moderate/30 hover:bg-moderate/30",
    icon: "◐",
  },
  complex: {
    label: "Complex",
    className: "bg-complex/20 text-complex border-complex/30 hover:bg-complex/30",
    icon: "◕",
  },
  major: {
    label: "Major",
    className: "bg-major/20 text-major border-major/30 hover:bg-major/30",
    icon: "●",
  },
};

const sizeConfig = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export function ComplexityBadge({
  level,
  showLabel = true,
  size = "md",
  className,
}: ComplexityBadgeProps) {
  const config = levelConfig[level];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeConfig[size], "font-medium", className)}
    >
      <span className="mr-1">{config.icon}</span>
      {showLabel && config.label}
    </Badge>
  );
}

interface ComplexityStatsProps {
  metrics: ComplexityMetrics;
  className?: string;
}

export function ComplexityStats({ metrics, className }: ComplexityStatsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <ComplexityBadge level={metrics.level} />
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-mono">{metrics.totalCommits}</span>
          <span>commits</span>
        </span>
        <span className="flex items-center gap-1 text-green-500">
          <span className="font-mono">+{metrics.totalAdditions}</span>
        </span>
        <span className="flex items-center gap-1 text-red-500">
          <span className="font-mono">-{metrics.totalDeletions}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono">{metrics.totalFilesChanged}</span>
          <span>files</span>
        </span>
      </div>
    </div>
  );
}


