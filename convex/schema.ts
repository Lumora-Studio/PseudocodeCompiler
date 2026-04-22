import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userWorkspaces: defineTable({
    tokenIdentifier: v.string(),
    workosUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    workspace: v.optional(v.any()),
    settings: v.optional(
      v.object({
        autosaveIntervalMinutes: v.number(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});
