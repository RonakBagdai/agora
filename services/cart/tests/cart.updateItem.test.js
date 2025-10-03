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

describe("PATCH /api/cart/items/:productId", () => {
  const userId = generateObjectId();
  const productId = generateObjectId();
  const productId2 = generateObjectId();

  beforeEach(() => {
    CartModel.__reset();
  });

  describe("Successful scenarios", () => {
    test("updates quantity of existing item in cart", async () => {
      const token = signToken({ id: userId, role: "user" });

      // First, add an item to cart
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 5 });

      // Update the quantity
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 10 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Item updated successfully");
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0]).toMatchObject({
        productId,
        quantity: 10,
      });
    });

    test("updates quantity to 1 (minimum valid value)", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item with quantity 10
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 10 });

      // Update to quantity 1
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 1 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(1);
    });

    test("updates correct item when cart has multiple items", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add two items
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId, qty: 5 });

      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId: productId2, qty: 3 });

      // Update only the second item
      const res = await request(app)
        .patch(`/api/cart/items/${productId2}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 8 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(2);

      // Find the updated item
      const updatedItem = res.body.cart.items.find(
        (item) => item.productId === productId2
      );
      expect(updatedItem.quantity).toBe(8);

      // Verify first item unchanged
      const unchangedItem = res.body.cart.items.find(
        (item) => item.productId === productId
      );
      expect(unchangedItem.quantity).toBe(5);
    });

    test("works with token in cookie", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", [`token=${token}`])
        .send({ productId, qty: 2 });

      // Update using cookie auth
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Cookie", [`token=${token}`])
        .send({ qty: 5 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(5);
    });
  });

  describe("Error scenarios - Cart and Item not found", () => {
    test("returns 404 when cart does not exist", async () => {
      const token = signToken({ id: userId, role: "user" });

      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Cart not found");
    });

    test("returns 404 when item not in cart", async () => {
      const token = signToken({ id: userId, role: "user" });
      const nonExistentProductId = generateObjectId();

      // Add one item to create cart
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2 });

      // Try to update a different product that's not in cart
      const res = await request(app)
        .patch(`/api/cart/items/${nonExistentProductId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Item not found in cart");
    });
  });

  describe("Authentication and Authorization", () => {
    test("returns 401 when no token provided", async () => {
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .send({ qty: 5 });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("returns 401 when token is invalid", async () => {
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", "Bearer invalid.token.here")
        .send({ qty: 5 });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    test("returns 403 when role is not allowed", async () => {
      const token = signToken({ id: userId, role: "admin" });

      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 5 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/);
    });
  });

  describe("Validation errors", () => {
    test("returns 400 when qty is missing", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item first
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 2 });

      // Try to update without qty
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("returns 400 when qty is zero", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item first
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 5 });

      // Try to update with qty = 0
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      const messages = res.body.errors.map((e) => e.msg);
      expect(messages).toContain("Quantity must be a positive integer");
    });

    test("returns 400 when qty is negative", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item first
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 5 });

      // Try to update with negative qty
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: -3 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("returns 400 when qty is a string", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item first
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 5 });

      // Try to update with string qty
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: "ten" });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("returns 400 when qty is a decimal", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item first
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 5 });

      // Try to update with decimal qty
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("returns 400 when productId format is invalid", async () => {
      const token = signToken({ id: userId, role: "user" });

      const res = await request(app)
        .patch("/api/cart/items/invalid-id-format")
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 5 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      const messages = res.body.errors.map((e) => e.msg);
      expect(messages).toContain("Invalid Product ID format");
    });
  });

  describe("Edge cases", () => {
    test("updates to large quantity value", async () => {
      const token = signToken({ id: userId, role: "user" });

      // Add item
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, qty: 1 });

      // Update to large quantity
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ qty: 9999 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(9999);
    });
  });
});
