import type { AccessToken, Session } from "@workos-inc/authkit-nextjs";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { decodeJwt } from "jose";
import type { NextRequest } from "next/server";
import type { BrowserAuditEventPayload } from "@/lib/audit/events";

const WORKSPACE_AUDIT_TARGET = {
  type: "workspace",
  id: "browser-cloud-workspace",
  name: "Pseudocode Compiler Cloud Workspace",
} as const;

function getConfiguredAuditOrganizationId(): string | undefined {
  const configuredOrganizationId =
    process.env.WORKOS_AUDIT_ORGANIZATION_ID ?? process.env.WORKOS_ORGANIZATION_ID;

  if (!configuredOrganizationId) {
    return undefined;
  }

  const trimmedOrganizationId = configuredOrganizationId.trim();
  return trimmedOrganizationId.length > 0 ? trimmedOrganizationId : undefined;
}

function getSessionOrganizationId(session: Session): string | undefined {
  try {
    const { org_id: organizationId } = decodeJwt<AccessToken>(session.accessToken);
    if (typeof organizationId === "string" && organizationId.length > 0) {
      return organizationId;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveWorkOsAuditOrganizationId(session: Session): string | undefined {
  return getSessionOrganizationId(session) ?? getConfiguredAuditOrganizationId();
}

function buildAuditActor(session: Session) {
  const firstName =
    "firstName" in session.user && typeof session.user.firstName === "string"
      ? session.user.firstName
      : undefined;
  const lastName =
    "lastName" in session.user && typeof session.user.lastName === "string"
      ? session.user.lastName
      : undefined;
  const email =
    "email" in session.user && typeof session.user.email === "string"
      ? session.user.email
      : undefined;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || email || session.user.id;

  return {
    type: "user" as const,
    id: session.user.id,
    name,
    ...(email
      ? {
          metadata: {
            email,
          },
        }
      : {}),
  };
}

function getForwardedIpAddress(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return undefined;
  }

  const [firstIpAddress] = forwardedFor.split(",");
  const trimmedIpAddress = firstIpAddress?.trim();
  return trimmedIpAddress ? trimmedIpAddress : undefined;
}

function buildAuditContext(request: NextRequest) {
  const location = getForwardedIpAddress(request) ?? "unknown";
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? { location, userAgent } : { location };
}

function buildAuditMetadata(
  payload: BrowserAuditEventPayload,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(payload.metadata).map(([key, value]) => [key, value]),
  ) as Record<string, string | number | boolean>;
}

export async function emitWorkOsAuditEvent(
  request: NextRequest,
  session: Session,
  payload: BrowserAuditEventPayload,
): Promise<"emitted" | "skipped"> {
  const organizationId = resolveWorkOsAuditOrganizationId(session);
  if (!organizationId) {
    return "skipped";
  }

  const baseEvent = {
    action: payload.action,
    occurredAt: new Date(),
    version: 1,
    actor: buildAuditActor(session),
    targets: [WORKSPACE_AUDIT_TARGET],
    context: buildAuditContext(request),
    metadata: buildAuditMetadata(payload),
  };
  await getWorkOS().auditLogs.createEvent(organizationId, baseEvent);

  return "emitted";
}
