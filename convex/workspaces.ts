import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function requireServerSecret(serverSecret: string) {
  const expected = process.env.WORKSPACE_SYNC_SECRET;
  if (!expected || serverSecret !== expected) {
    throw new Error("Unauthorized workspace sync request.");
  }
}

export const getCurrent = queryGeneric({
  args: {
    serverSecret: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_workos_user", (query) => query.eq("workosUserId", args.workosUserId))
      .unique();

    return workspace?.workspace ?? null;
  },
});

export const saveCurrent = mutationGeneric({
  args: {
    serverSecret: v.string(),
    user: v.object({
      workosUserId: v.string(),
      email: v.string(),
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
    }),
    workspace: v.any(),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);

    const now = Date.now();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_workos_user", (query) => query.eq("workosUserId", args.user.workosUserId))
      .unique();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        email: args.user.email,
        firstName: args.user.firstName,
        lastName: args.user.lastName,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("users", {
        ...args.user,
        updatedAt: now,
      });
    }

    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_workos_user", (query) => query.eq("workosUserId", args.user.workosUserId))
      .unique();

    if (existingWorkspace) {
      await ctx.db.patch(existingWorkspace._id, {
        workspace: args.workspace,
        updatedAt: now,
      });
      return existingWorkspace._id;
    }

    return await ctx.db.insert("workspaces", {
      workosUserId: args.user.workosUserId,
      workspace: args.workspace,
      updatedAt: now,
    });
  },
});
