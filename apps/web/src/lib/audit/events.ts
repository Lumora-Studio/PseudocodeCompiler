export type BrowserAuditSaveReason = "manual" | "close";

interface WorkspaceAuditCounts {
  documentCount: number;
  folderCount: number;
}

export type BrowserAuditEventPayload =
  | {
      action: "workspace.created";
      metadata: WorkspaceAuditCounts;
    }
  | {
      action: "workspace.saved";
      metadata: WorkspaceAuditCounts & {
        saveReason: BrowserAuditSaveReason;
      };
    }
  | {
      action: "workspace.settings_updated";
      metadata: {
        autosaveIntervalMinutes: number;
      };
    };

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isWorkspaceAuditCounts(value: unknown): value is WorkspaceAuditCounts {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorkspaceAuditCounts>;
  return (
    isNonNegativeInteger(candidate.documentCount) &&
    isNonNegativeInteger(candidate.folderCount)
  );
}

function isBrowserAuditSaveReason(value: unknown): value is BrowserAuditSaveReason {
  return value === "manual" || value === "close";
}

export function isBrowserAuditEventPayload(value: unknown): value is BrowserAuditEventPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BrowserAuditEventPayload>;
  switch (candidate.action) {
    case "workspace.created":
      return isWorkspaceAuditCounts(candidate.metadata);
    case "workspace.saved":
      return (
        isWorkspaceAuditCounts(candidate.metadata) &&
        isBrowserAuditSaveReason(candidate.metadata.saveReason)
      );
    case "workspace.settings_updated":
      return (
        Boolean(candidate.metadata) &&
        typeof candidate.metadata === "object" &&
        isNonNegativeInteger(candidate.metadata.autosaveIntervalMinutes)
      );
    default:
      return false;
  }
}
