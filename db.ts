import { eq, desc, and, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  InsertHotspot, hotspots,
  InsertItem, items,
  InsertTrade, trades,
  InsertComment, comments,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USER QUERIES =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) return { hotspotsCount: 0, itemsCount: 0, tradesCount: 0 };

  const [hsResult] = await db.select({ count: sql<number>`count(*)` }).from(hotspots).where(eq(hotspots.userId, userId));
  const [itResult] = await db.select({ count: sql<number>`count(*)` }).from(items).where(eq(items.userId, userId));
  const [trResult] = await db.select({ count: sql<number>`count(*)` }).from(trades).where(
    and(
      or(eq(trades.proposerId, userId), eq(trades.receiverId, userId)),
      eq(trades.status, "accepted")
    )
  );

  return {
    hotspotsCount: Number(hsResult?.count ?? 0),
    itemsCount: Number(itResult?.count ?? 0),
    tradesCount: Number(trResult?.count ?? 0),
  };
}

// ===== HOTSPOT QUERIES =====

export async function createHotspot(data: InsertHotspot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(hotspots).values(data).$returningId();
  return result.id;
}

export async function getAllHotspots() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: hotspots.id,
    userId: hotspots.userId,
    name: hotspots.name,
    description: hotspots.description,
    category: hotspots.category,
    latitude: hotspots.latitude,
    longitude: hotspots.longitude,
    address: hotspots.address,
    rating: hotspots.rating,
    imageUrl: hotspots.imageUrl,
    isActive: hotspots.isActive,
    createdAt: hotspots.createdAt,
    userName: users.name,
  }).from(hotspots)
    .leftJoin(users, eq(hotspots.userId, users.id))
    .where(eq(hotspots.isActive, true))
    .orderBy(desc(hotspots.createdAt));
}

export async function getHotspotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: hotspots.id,
    userId: hotspots.userId,
    name: hotspots.name,
    description: hotspots.description,
    category: hotspots.category,
    latitude: hotspots.latitude,
    longitude: hotspots.longitude,
    address: hotspots.address,
    rating: hotspots.rating,
    imageUrl: hotspots.imageUrl,
    isActive: hotspots.isActive,
    createdAt: hotspots.createdAt,
    updatedAt: hotspots.updatedAt,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(hotspots)
    .leftJoin(users, eq(hotspots.userId, users.id))
    .where(eq(hotspots.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserHotspots(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hotspots).where(eq(hotspots.userId, userId)).orderBy(desc(hotspots.createdAt));
}

export async function deleteHotspot(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(hotspots).set({ isActive: false }).where(and(eq(hotspots.id, id), eq(hotspots.userId, userId)));
}

// ===== ITEM QUERIES =====

export async function createItem(data: InsertItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(items).values(data).$returningId();
  return result.id;
}

export async function getAllTradeItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: items.id,
    userId: items.userId,
    hotspotId: items.hotspotId,
    title: items.title,
    description: items.description,
    category: items.category,
    condition: items.condition,
    imageUrl: items.imageUrl,
    estimatedValue: items.estimatedValue,
    retailPrice: items.retailPrice,
    lookingFor: items.lookingFor,
    isAvailableForTrade: items.isAvailableForTrade,
    createdAt: items.createdAt,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(items)
    .leftJoin(users, eq(items.userId, users.id))
    .where(eq(items.isAvailableForTrade, true))
    .orderBy(desc(items.createdAt));
}

export async function getItemById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: items.id,
    userId: items.userId,
    hotspotId: items.hotspotId,
    title: items.title,
    description: items.description,
    category: items.category,
    condition: items.condition,
    imageUrl: items.imageUrl,
    estimatedValue: items.estimatedValue,
    retailPrice: items.retailPrice,
    lookingFor: items.lookingFor,
    isAvailableForTrade: items.isAvailableForTrade,
    createdAt: items.createdAt,
    userName: users.name,
  }).from(items)
    .leftJoin(users, eq(items.userId, users.id))
    .where(eq(items.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(items).where(eq(items.userId, userId)).orderBy(desc(items.createdAt));
}

export async function getHotspotItems(hotspotId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: items.id,
    userId: items.userId,
    title: items.title,
    description: items.description,
    category: items.category,
    condition: items.condition,
    imageUrl: items.imageUrl,
    estimatedValue: items.estimatedValue,
    createdAt: items.createdAt,
    userName: users.name,
  }).from(items)
    .leftJoin(users, eq(items.userId, users.id))
    .where(eq(items.hotspotId, hotspotId))
    .orderBy(desc(items.createdAt));
}

export async function updateItem(id: number, data: Partial<InsertItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(items).set(data).where(eq(items.id, id));
}

export async function deleteItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(items).where(and(eq(items.id, id), eq(items.userId, userId)));
}

// ===== TRADE QUERIES =====

export async function createTrade(data: InsertTrade) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(trades).values(data).$returningId();
  return result.id;
}

export async function getUserTrades(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trades)
    .where(or(eq(trades.proposerId, userId), eq(trades.receiverId, userId)))
    .orderBy(desc(trades.createdAt));
}

export async function updateTradeStatus(id: number, userId: number, status: "accepted" | "declined" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only the receiver can accept/decline, only the proposer can cancel
  if (status === "cancelled") {
    await db.update(trades).set({ status }).where(and(eq(trades.id, id), eq(trades.proposerId, userId)));
  } else {
    await db.update(trades).set({ status }).where(and(eq(trades.id, id), eq(trades.receiverId, userId)));
  }
  // If accepted, mark both items as unavailable
  if (status === "accepted") {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
    if (trade) {
      await db.update(items).set({ isAvailableForTrade: false }).where(eq(items.id, trade.offeredItemId));
      await db.update(items).set({ isAvailableForTrade: false }).where(eq(items.id, trade.requestedItemId));
    }
  }
}

// ===== COMMENT QUERIES =====

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(comments).values(data).$returningId();
  return result.id;
}

export async function getHotspotComments(hotspotId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: comments.id,
    userId: comments.userId,
    content: comments.content,
    createdAt: comments.createdAt,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.hotspotId, hotspotId))
    .orderBy(desc(comments.createdAt));
}