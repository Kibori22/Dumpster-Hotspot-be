import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== HOTSPOT ROUTES =====
  hotspots: router({
    list: publicProcedure.query(async () => {
      return db.getAllHotspots();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getHotspotById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["retail", "grocery", "electronics", "furniture", "clothing", "other"]),
        latitude: z.string(),
        longitude: z.string(),
        address: z.string().optional(),
        rating: z.number().min(1).max(5).default(3),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createHotspot({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          category: input.category,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address,
          rating: input.rating,
          imageUrl: input.imageUrl,
        });
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteHotspot(input.id, ctx.user.id);
        return { success: true };
      }),

    getComments: publicProcedure
      .input(z.object({ hotspotId: z.number() }))
      .query(async ({ input }) => {
        return db.getHotspotComments(input.hotspotId);
      }),

    addComment: protectedProcedure
      .input(z.object({
        hotspotId: z.number(),
        content: z.string().min(1).max(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createComment({
          userId: ctx.user.id,
          hotspotId: input.hotspotId,
          content: input.content,
        });
        return { id };
      }),

    getItems: publicProcedure
      .input(z.object({ hotspotId: z.number() }))
      .query(async ({ input }) => {
        return db.getHotspotItems(input.hotspotId);
      }),
  }),

  // ===== ITEM ROUTES =====
  items: router({
    list: publicProcedure.query(async () => {
      return db.getAllTradeItems();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getItemById(input.id);
      }),

    myItems: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserItems(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["electronics", "furniture", "clothing", "books", "toys", "kitchen", "sports", "tools", "other"]),
        condition: z.enum(["new", "like_new", "good", "fair", "poor"]),
        imageUrl: z.string().optional(),
        estimatedValue: z.string().optional(),
        lookingFor: z.string().optional(),
        hotspotId: z.number().optional(),
        isAvailableForTrade: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createItem({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          condition: input.condition,
          imageUrl: input.imageUrl,
          estimatedValue: input.estimatedValue,
          lookingFor: input.lookingFor,
          hotspotId: input.hotspotId,
          isAvailableForTrade: input.isAvailableForTrade,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        estimatedValue: z.string().optional(),
        retailPrice: z.string().optional(),
        isAvailableForTrade: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateItem(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteItem(input.id, ctx.user.id);
        return { success: true };
      }),

    // Price comparison using LLM
    comparePrice: publicProcedure
      .input(z.object({
        itemName: z.string(),
        condition: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const prompt = `You are a price estimation expert. Given the following item found while dumpster diving, estimate its value across different markets. Return ONLY a JSON object with no markdown formatting.

Item: ${input.itemName}
Condition: ${input.condition}
${input.description ? `Description: ${input.description}` : ""}

Return this exact JSON format:
{
  "retailPrice": <estimated new retail price in USD as a number>,
  "thriftPrice": <estimated thrift store price in USD as a number>,
  "resalePrice": <estimated online resale price (eBay/Facebook Marketplace) in USD as a number>,
  "savings": <percentage saved compared to retail as a number>,
  "summary": "<one sentence summary of the item's value>"
}`;

          const result = await invokeLLM({
            messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
          });

          // Parse the LLM response
          const choice = result.choices?.[0];
          const rawContent = choice?.message?.content;
          const text = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
          return {
            retailPrice: 0,
            thriftPrice: 0,
            resalePrice: 0,
            savings: 100,
            summary: "Unable to estimate price at this time.",
          };
        } catch (error) {
          console.error("Price comparison error:", error);
          return {
            retailPrice: 0,
            thriftPrice: 0,
            resalePrice: 0,
            savings: 100,
            summary: "Price comparison service temporarily unavailable.",
          };
        }
      }),
  }),

  // ===== TRADE ROUTES =====
  trades: router({
    myTrades: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserTrades(ctx.user.id);
    }),

    propose: protectedProcedure
      .input(z.object({
        offeredItemId: z.number(),
        requestedItemId: z.number(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get the requested item to find the receiver
        const requestedItem = await db.getItemById(input.requestedItemId);
        if (!requestedItem) throw new Error("Requested item not found");
        if (requestedItem.userId === ctx.user.id) throw new Error("Cannot trade with yourself");

        const id = await db.createTrade({
          proposerId: ctx.user.id,
          receiverId: requestedItem.userId,
          offeredItemId: input.offeredItemId,
          requestedItemId: input.requestedItemId,
          message: input.message,
        });
        return { id };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["accepted", "declined", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateTradeStatus(input.id, ctx.user.id, input.status);
        return { success: true };
      }),
  }),

  // ===== PROFILE ROUTES =====
  profile: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserStats(ctx.user.id);
    }),

    getMyHotspots: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserHotspots(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ===== FILE UPLOAD =====
  upload: router({
    getUploadUrl: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `${ctx.user.id}-uploads/${input.fileName}-${randomSuffix}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url };
      }),
  }),
});

export type AppRouter = typeof appRouter;