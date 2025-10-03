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
      return carts.get(query.user) || null;
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

const endpoint = "/api/cart/items";

describe("POST /api/cart/items", () => {
  const userId = generateObjectId();
  const productId = generateObjectId();
  const productId2 = generateObjectId();

  beforeEach(() => {
    CartModel.__reset();
  });

  describe("Successful scenarios", () => {
    test("creates new cart and adds first item", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Item added to cart");
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0]).toMatchObject({ productId, quantity: 2 });
    });

    test("increments quantity when item already exists", async () => {
      const token = signToken({ id: userId, role: "user" });

      // First add
      await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2 });

      // Second add
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 3 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0]).toMatchObject({ productId, quantity: 5 });
    });

    test("adds multiple different items to cart", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add first item
      await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2 });

      // Add second different item
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId2, qty: 3 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(2);
      expect(res.body.cart.items[0]).toMatchObject({ productId, quantity: 2 });
      expect(res.body.cart.items[1]).toMatchObject({
        productId: productId2,
        quantity: 3,
      });
    });

    test("works with token in cookie", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Cookie", [`token=${token}`])
        .send({ productId, qty: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Item added to cart");
      expect(res.body.cart.items).toHaveLength(1);
    });

    test("adds item with large quantity", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 9999 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(9999);
    });
  });

  describe("Validation errors", () => {
    test("validation error for invalid productId", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: "invalid-id", qty: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      const messages = res.body.errors.map((e) => e.msg);
      expect(messages).toContain("Invalid Product ID format");
    });

    test("validation error for non-positive qty (zero)", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId, qty: 0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      const messages = res.body.errors.map((e) => e.msg);
      expect(messages).toContain("Quantity must be a positive integer");
    });

    test("validation error for negative qty", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: -5 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("validation error for qty as string", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: "two" });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("validation error for qty as decimal", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("validation error when productId is missing", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("validation error when qty is missing", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("validation error when productId is not a string", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: 12345, qty: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("Authentication and Authorization", () => {
    test("401 when no token provided", async () => {
      const res = await request(app).post(endpoint).send({ productId, qty: 1 });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("403 when role not allowed", async () => {
      const token = signToken({ id: userId, role: "admin" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 1 });
      expect(res.status).toBe(403);
    });

    test("401 when token invalid", async () => {
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", "Bearer invalid.token.here")
        .send({ productId, qty: 1 });
      expect(res.status).toBe(401);
    });

    test("401 when token expired", async () => {
      const expiredToken = jwt.sign(
        { id: userId, role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" }
      );
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ productId, qty: 1 });
      expect(res.status).toBe(401);
    });
  });

  describe("User isolation and data integrity", () => {
    test("different users have separate carts", async () => {
      const user1Id = generateObjectId();
      const user2Id = generateObjectId();
      const token1 = signToken({ id: user1Id, role: "user" });
      const token2 = signToken({ id: user2Id, role: "user" });

      // User 1 adds item
      await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token1}`)
        .send({ productId, qty: 5 });

      // User 2 adds same product
      const res2 = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token2}`)
        .send({ productId, qty: 3 });

      // User 2 should have their own cart with qty 3, not 8
      expect(res2.status).toBe(200);
      expect(res2.body.cart.items).toHaveLength(1);
      expect(res2.body.cart.items[0].quantity).toBe(3);
    });

    test("returns properly formatted response structure", async () => {
      const token = signToken({ id: userId, role: "user" });
      const res = await request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 1 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("cart");
      expect(res.body.cart).toHaveProperty("items");
      expect(Array.isArray(res.body.cart.items)).toBe(true);

      const item = res.body.cart.items[0];
      expect(item).toHaveProperty("productId");
      expect(item).toHaveProperty("quantity");
      expect(typeof item.quantity).toBe("number");
    });
  });
});
