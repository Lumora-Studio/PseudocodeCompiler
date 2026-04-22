"use client";

import { ChevronRight } from "lucide-react";
import type { WorkspaceNode } from "@pseudocode-compiler/workspace";

interface BreadcrumbsProps {
  path: WorkspaceNode[];
}

export function Breadcrumbs({ path }: BreadcrumbsProps) {
  const visiblePath = path.filter((node) => node.parentId !== null);

  return (
    <nav
      aria-label="Document path"
      className="flex items-center gap-1 text-[11px] text-[var(--text3)]"
    >
      {visiblePath.map((node, index) => (
        <span key={node.id} className="flex items-center gap-1">
          <span className={index === visiblePath.length - 1 ? "font-medium text-[var(--text2)]" : ""}>
            {node.name}
          </span>
          {index < visiblePath.length - 1 ? <ChevronRight size={10} className="text-[var(--text3)]" /> : null}
        </span>
      ))}
    </nav>
  );
}
