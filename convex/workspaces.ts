import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  return identity;
}

async function getCurrentWorkspaceDoc(ctx: QueryCtx | MutationCtx) {
  const identity = requireIdentity(await ctx.auth.getUserIdentity());

  const existing = await ctx.db
    .query("userWorkspaces")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  return { existing, identity };
}

export const getCurrentWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const { existing } = await getCurrentWorkspaceDoc(ctx);

    return existing?.workspace ?? null;
  },
});

export const saveCurrentWorkspace = mutation({
  args: {
    workspace: v.any(),
  },
  handler: async (ctx, args) => {
    const { existing, identity } = await getCurrentWorkspaceDoc(ctx);
    const patch = {
      tokenIdentifier: identity.tokenIdentifier,
      workosUserId: identity.subject ?? undefined,
      email:
        typeof identity.email === "string" && identity.email.length > 0 ? identity.email : undefined,
      name: typeof identity.name === "string" && identity.name.length > 0 ? identity.name : undefined,
      workspace: args.workspace,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return ctx.db.insert("userWorkspaces", {
      ...patch,
      settings: {
        autosaveIntervalMinutes: 5,
      },
    });
  },
});

export const getCurrentWorkspaceSettings = query({
  args: {},
  handler: async (ctx) => {
    const { existing } = await getCurrentWorkspaceDoc(ctx);

    return (
      existing?.settings ?? {
        autosaveIntervalMinutes: 5,
      }
    );
  },
});

export const saveCurrentWorkspaceSettings = mutation({
  args: {
    autosaveIntervalMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { existing, identity } = await getCurrentWorkspaceDoc(ctx);
    const settings = {
      autosaveIntervalMinutes: Math.max(1, Math.min(60, Math.round(args.autosaveIntervalMinutes))),
    };

    const patch = {
      tokenIdentifier: identity.tokenIdentifier,
      workosUserId: identity.subject ?? undefined,
      email:
        typeof identity.email === "string" && identity.email.length > 0 ? identity.email : undefined,
      name: typeof identity.name === "string" && identity.name.length > 0 ? identity.name : undefined,
      settings,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return settings;
    }

    await ctx.db.insert("userWorkspaces", {
      ...patch,
      workspace: null,
    });
    return settings;
  },
});
