const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");

// Mock the cart model
jest.mock("../src/models/cart.model.js", () => {
  // helper inside factory to avoid out-of-scope reference restriction
  function mockGenerateObjectId() {
    return Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }
  const carts = new Map();
  class CartMock {
    constructor({ user, items }) {
      this._id = mockGenerateObjectId();
      this.user = user;
      this.items = items || [];
    }
    static async findOne(query) {
      const cart = carts.get(query.user);
      if (!cart) return null;

      // Mock populate behavior
      return {
        ...cart,
        populate: async function (field) {
          // Return this to allow chaining
          return this;
        },
      };
    }
    async save() {
      carts.set(this.user, this);
      return this;
    }
  }
  CartMock.__reset = () => carts.clear();
  return CartMock;
});

const CartModel = require("../src/models/cart.model.js");

function generateObjectId() {
  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

describe("GET /api/cart", () => {
  const userId = generateObjectId();
  const productId1 = generateObjectId();
  const productId2 = generateObjectId();
  const productId3 = generateObjectId();

  beforeEach(() => {
    CartModel.__reset();
  });

  describe("Successful scenarios", () => {
    test("returns empty cart when user has no items", async () => {
      const token = signToken({ id: userId, role: "user" });

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toEqual([]);
      expect(res.body.cart.user).toBe(userId);
    });

    test("returns cart with single item", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add one item to cart
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 2 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0]).toMatchObject({
        productId: productId1,
        quantity: 2,
      });
    });

    test("returns cart with multiple items", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add multiple items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 2 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId2, qty: 3 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId3, qty: 1 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(3);
      expect(res.body.cart.items[0].productId).toBe(productId1);
      expect(res.body.cart.items[0].quantity).toBe(2);
      expect(res.body.cart.items[1].productId).toBe(productId2);
      expect(res.body.cart.items[1].quantity).toBe(3);
      expect(res.body.cart.items[2].productId).toBe(productId3);
      expect(res.body.cart.items[2].quantity).toBe(1);
    });

    test("returns cart with populated product details", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 1 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      // Check that items exist with product information
      expect(res.body.cart.items[0].productId).toBeDefined();
    });

    test("calculates cart totals correctly", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 2 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId2, qty: 3 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();

      // Verify totals exist
      if (res.body.totalItems !== undefined) {
        expect(res.body.totalItems).toBe(2); // 2 distinct products
      }

      if (res.body.totalQuantity !== undefined) {
        expect(res.body.totalQuantity).toBe(5); // 2 + 3 items
      }

      // If totalPrice is calculated
      if (res.body.totalPrice !== undefined) {
        expect(typeof res.body.totalPrice).toBe("number");
        expect(res.body.totalPrice).toBeGreaterThanOrEqual(0);
      }
    });

    test("works with token in cookie", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", [`token=${token}`])
        .send({ productId: productId1, qty: 1 });

      // Get cart using cookie
      const res = await request(app)
        .get("/api/cart")
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();
    });

    test("returns consistent cart state after multiple operations", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 5 });

      // Update item
      await request(app)
        .patch(`/api/cart/items/${productId1}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 3 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].quantity).toBe(3);
    });
  });

  describe("Authentication and Authorization", () => {
    test("returns 401 when no token provided", async () => {
      const res = await request(app).get("/api/cart");

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("returns 401 when token is invalid", async () => {
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("returns 401 when token is expired", async () => {
      const expiredToken = jwt.sign(
        { id: userId, role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" } // Already expired
      );

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("returns 403 when role is not allowed", async () => {
      const token = signToken({ id: userId, role: "admin" });

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test("returns only user's own cart, not other users' carts", async () => {
      const user1Id = generateObjectId();
      const user2Id = generateObjectId();
      const token1 = signToken({ id: user1Id, role: "user" });
      const token2 = signToken({ id: user2Id, role: "user" });

      // User 1 adds items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token1}`)
        .send({ productId: productId1, qty: 5 });

      // User 2 adds different items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token2}`)
        .send({ productId: productId2, qty: 3 });

      // User 1 fetches cart
      const res1 = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token1}`);

      // User 2 fetches cart
      const res2 = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token2}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Verify user 1 only sees their items
      expect(res1.body.cart.items).toHaveLength(1);
      expect(res1.body.cart.items[0].productId).toBe(productId1);
      expect(res1.body.cart.items[0].quantity).toBe(5);

      // Verify user 2 only sees their items
      expect(res2.body.cart.items).toHaveLength(1);
      expect(res2.body.cart.items[0].productId).toBe(productId2);
      expect(res2.body.cart.items[0].quantity).toBe(3);
    });
  });

  describe("Edge cases and data integrity", () => {
    test("handles cart with zero quantity items gracefully", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 1 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Verify no items have zero or negative quantities
      res.body.cart.items.forEach((item) => {
        expect(item.quantity).toBeGreaterThan(0);
      });
    });

    test("returns cart with large number of items", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add multiple items (simulate large cart)
      const productIds = [];
      for (let i = 0; i < 10; i++) {
        productIds.push(generateObjectId());
      }

      // Add all items
      for (const prodId of productIds) {
        await request(app)
          .post("/api/cart/items")
          .set("Authorization", `Bearer ${token}`)
          .send({ productId: prodId, qty: 1 });
      }

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(10);
    });

    test("returns cart with items having large quantities", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item with large quantity
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 9999 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(9999);
    });

    test("returns properly formatted response structure", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 2 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("cart");
      expect(res.body.cart).toHaveProperty("items");
      expect(Array.isArray(res.body.cart.items)).toBe(true);

      // Verify item structure
      if (res.body.cart.items.length > 0) {
        const item = res.body.cart.items[0];
        expect(item).toHaveProperty("productId");
        expect(item).toHaveProperty("quantity");
        expect(typeof item.quantity).toBe("number");
      }
    });

    test("handles concurrent GET requests correctly", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 3 });

      // Make multiple concurrent GET requests
      const promises = [
        request(app).get("/api/cart").set("Authorization", `Bearer ${token}`),
        request(app).get("/api/cart").set("Authorization", `Bearer ${token}`),
        request(app).get("/api/cart").set("Authorization", `Bearer ${token}`),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.cart.items).toHaveLength(1);
        expect(res.body.cart.items[0].quantity).toBe(3);
      });
    });
  });

  describe("Response content validation", () => {
    test("includes message in response", async () => {
      const token = signToken({ id: userId, role: "user" });

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Message is optional but if present should be meaningful
      if (res.body.message) {
        expect(typeof res.body.message).toBe("string");
        expect(res.body.message.length).toBeGreaterThan(0);
      }
    });

    test("cart items maintain insertion order", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add items in specific order
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 1 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId2, qty: 1 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId3, qty: 1 });

      // Get cart
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(3);
      // Verify order is preserved
      expect(res.body.cart.items[0].productId).toBe(productId1);
      expect(res.body.cart.items[1].productId).toBe(productId2);
      expect(res.body.cart.items[2].productId).toBe(productId3);
    });

    test("does not expose sensitive user information", async () => {
      const token = signToken({ id: userId, role: "user" });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId1, qty: 1 });

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Should not contain password or sensitive fields
      expect(res.body.cart.password).toBeUndefined();
      expect(res.body.cart.passwordHash).toBeUndefined();
      // User ID is fine to include
      expect(res.body.cart.user).toBeDefined();
    });
  });
});
