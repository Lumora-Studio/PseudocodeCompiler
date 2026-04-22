import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isBrowserAuditEventPayload } from "@/lib/audit/events";
import { emitWorkOsAuditEvent } from "@/lib/audit/workos";
import { getWorkOsSession } from "@/lib/auth/session";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(request: NextRequest) {
  const session = await getWorkOsSession();
  if (!session?.user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload.",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  if (!isBrowserAuditEventPayload(payload)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid audit log payload.",
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  try {
    const status = await emitWorkOsAuditEvent(request, session, payload);
    return NextResponse.json(
      {
        ok: true,
        status,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    console.error("Failed to emit WorkOS audit log event.", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to emit WorkOS audit log event.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
