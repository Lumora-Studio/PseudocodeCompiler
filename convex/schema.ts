import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    updatedAt: v.number(),
  }).index("by_clerk_user", ["clerkUserId"]),
  workspaces: defineTable({
    clerkUserId: v.string(),
    workspace: v.any(),
    updatedAt: v.number(),
  }).index("by_clerk_user", ["clerkUserId"]),
});
