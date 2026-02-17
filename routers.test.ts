import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
type CookieCall = { name: string; options: Record<string, unknown> };

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createCtx(user: AuthenticatedUser | null = null): TrpcContext {
  const clearedCookies: CookieCall[] = [];
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
}

// Mock the database module
vi.mock("../server/db", () => ({
  getAllHotspots: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      name: "Test Hotspot",
      description: "A great spot",
      category: "retail",
      latitude: "40.7128000",
      longitude: "-74.0060000",
      address: "123 Main St",
      rating: 4,
      imageUrl: null,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      userName: "Test User",
    },
  ]),
  getHotspotById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    name: "Test Hotspot",
    description: "A great spot",
    category: "retail",
    latitude: "40.7128000",
    longitude: "-74.0060000",
    address: "123 Main St",
    rating: 4,
    imageUrl: null,
    isActive: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    userName: "Test User",
    userAvatar: null,
  }),
  createHotspot: vi.fn().mockResolvedValue(1),
  deleteHotspot: vi.fn().mockResolvedValue(undefined),
  getHotspotComments: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      content: "Great spot!",
      createdAt: new Date("2025-01-01"),
      userName: "Test User",
      userAvatar: null,
    },
  ]),
  createComment: vi.fn().mockResolvedValue(1),
  getHotspotItems: vi.fn().mockResolvedValue([]),
  getAllTradeItems: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      hotspotId: null,
      title: "Test Item",
      description: "A nice item",
      category: "electronics",
      condition: "good",
      imageUrl: null,
      estimatedValue: "50.00",
      retailPrice: null,
      lookingFor: "Books",
      isAvailableForTrade: true,
      createdAt: new Date("2025-01-01"),
      userName: "Test User",
      userAvatar: null,
    },
  ]),
  getItemById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 2,
    hotspotId: null,
    title: "Test Item",
    description: "A nice item",
    category: "electronics",
    condition: "good",
    imageUrl: null,
    estimatedValue: "50.00",
    retailPrice: null,
    lookingFor: "Books",
    isAvailableForTrade: true,
    createdAt: new Date("2025-01-01"),
    userName: "Other User",
  }),
  getUserItems: vi.fn().mockResolvedValue([]),
  createItem: vi.fn().mockResolvedValue(1),
  updateItem: vi.fn().mockResolvedValue(undefined),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  getUserTrades: vi.fn().mockResolvedValue([]),
  createTrade: vi.fn().mockResolvedValue(1),
  updateTradeStatus: vi.fn().mockResolvedValue(undefined),
  getUserStats: vi.fn().mockResolvedValue({ hotspotsCount: 3, itemsCount: 5, tradesCount: 2 }),
  getUserHotspots: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

// Mock the LLM module
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            retailPrice: 299.99,
            thriftPrice: 45.00,
            resalePrice: 120.00,
            savings: 85,
            summary: "Great find! This item retails for about $300.",
          }),
        },
      },
    ],
  }),
}));

// Mock storage
vi.mock("../server/storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/file.png" }),
}));

describe("Hotspot Routes", () => {
  it("lists all hotspots (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.hotspots.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name", "Test Hotspot");
    expect(result[0]).toHaveProperty("latitude");
    expect(result[0]).toHaveProperty("longitude");
    expect(result[0]).toHaveProperty("category", "retail");
  });

  it("gets a hotspot by id (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.hotspots.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test Hotspot");
    expect(result?.rating).toBe(4);
  });

  it("creates a hotspot (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.hotspots.create({
      name: "New Spot",
      category: "grocery",
      latitude: "40.7128",
      longitude: "-74.0060",
      rating: 5,
    });
    expect(result).toHaveProperty("id", 1);
  });

  it("rejects hotspot creation without auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.hotspots.create({
        name: "New Spot",
        category: "grocery",
        latitude: "40.7128",
        longitude: "-74.0060",
        rating: 5,
      })
    ).rejects.toThrow();
  });

  it("gets comments for a hotspot (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.hotspots.getComments({ hotspotId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("content", "Great spot!");
  });

  it("adds a comment (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.hotspots.addComment({ hotspotId: 1, content: "Nice find!" });
    expect(result).toHaveProperty("id", 1);
  });
});

describe("Item Routes", () => {
  it("lists all trade items (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.items.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("title", "Test Item");
    expect(result[0]).toHaveProperty("isAvailableForTrade", true);
  });

  it("gets an item by id (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.items.getById({ id: 1 });
    expect(result).toBeDefined();
    expect(result?.title).toBe("Test Item");
  });

  it("creates an item (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.items.create({
      title: "Found Monitor",
      category: "electronics",
      condition: "good",
      estimatedValue: "75.00",
      isAvailableForTrade: true,
    });
    expect(result).toHaveProperty("id", 1);
  });

  it("rejects item creation without auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.items.create({
        title: "Found Monitor",
        category: "electronics",
        condition: "good",
      })
    ).rejects.toThrow();
  });

  it("compares item prices using LLM (public)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.items.comparePrice({
      itemName: "Sony WH-1000XM4",
      condition: "good",
      description: "Working headphones",
    });
    expect(result).toHaveProperty("retailPrice");
    expect(result).toHaveProperty("thriftPrice");
    expect(result).toHaveProperty("resalePrice");
    expect(result).toHaveProperty("savings");
    expect(result).toHaveProperty("summary");
    expect(result.retailPrice).toBe(299.99);
    expect(result.savings).toBe(85);
  });
});

describe("Trade Routes", () => {
  it("proposes a trade (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.trades.propose({
      offeredItemId: 2,
      requestedItemId: 1,
      message: "I'd like to trade!",
    });
    expect(result).toHaveProperty("id", 1);
  });

  it("rejects trade proposal without auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.trades.propose({
        offeredItemId: 2,
        requestedItemId: 1,
      })
    ).rejects.toThrow();
  });

  it("gets user trades (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.trades.myTrades();
    expect(Array.isArray(result)).toBe(true);
  });

  it("updates trade status (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.trades.updateStatus({ id: 1, status: "accepted" });
    expect(result).toEqual({ success: true });
  });
});

describe("Profile Routes", () => {
  it("gets user stats (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.profile.getStats();
    expect(result).toHaveProperty("hotspotsCount", 3);
    expect(result).toHaveProperty("itemsCount", 5);
    expect(result).toHaveProperty("tradesCount", 2);
  });

  it("gets user hotspots (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.profile.getMyHotspots();
    expect(Array.isArray(result)).toBe(true);
  });

  it("updates user profile (authenticated)", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.profile.update({ name: "New Name", bio: "Diver extraordinaire" });
    expect(result).toEqual({ success: true });
  });

  it("rejects profile update without auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.profile.update({ name: "Hacker" })
    ).rejects.toThrow();
  });
});

describe("Auth Routes", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const user = createUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User");
  });
});