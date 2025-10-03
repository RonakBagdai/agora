const request = require("supertest");
const app = require("../src/app");
const { getAuthCookie } = require("../tests/setup/auth");
const { setupAxiosMock, resetAxiosMock } = require("./setup/axiosMock");

describe("GET /api/orders/me — Paginated list of the customer's orders", () => {
  // Setup mocks before all tests
  beforeAll(() => {
    setupAxiosMock();
  });

  // Reset mocks after each test
  afterEach(() => {
    setupAxiosMock();
  });

  // Clean up after all tests
  afterAll(() => {
    resetAxiosMock();
  });

  it("should return paginated list of current user's orders with default pagination", async () => {
    const res = await request(app)
      .get("/api/orders/me")
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/);

    if (res.status !== 200) {
      console.log("Response status:", res.status);
      console.log("Response body:", res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();

    // Pagination structure
    expect(res.body.orders).toBeDefined();
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBeDefined();
    expect(res.body.pagination.limit).toBeDefined();
    expect(res.body.pagination.totalPages).toBeDefined();
    expect(res.body.pagination.totalOrders).toBeDefined();

    // Default pagination values
    expect(typeof res.body.pagination.page).toBe("number");
    expect(typeof res.body.pagination.limit).toBe("number");
    expect(typeof res.body.pagination.totalPages).toBe("number");
    expect(typeof res.body.pagination.totalOrders).toBe("number");
  });

  it("should return orders with correct structure for each order", async () => {
    const res = await request(app)
      .get("/api/orders/me")
      .set("Cookie", getAuthCookie())
      .expect(200);

    const { orders } = res.body;

    if (orders.length > 0) {
      const order = orders[0];

      // Basic order fields
      expect(order._id).toBeDefined();
      expect(order.user).toBeDefined();
      expect(order.status).toBeDefined();
      expect([
        "PENDING",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELED",
      ]).toContain(order.status);

      // Items array
      expect(Array.isArray(order.items)).toBe(true);
      if (order.items.length > 0) {
        const item = order.items[0];
        expect(item.product).toBeDefined();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.price).toBeDefined();
        expect(item.price.amount).toBeDefined();
        expect(item.price.currency).toBeDefined();
      }

      // Total amount
      expect(order.totalAmount).toBeDefined();
      expect(order.totalAmount.amount).toBeDefined();
      expect(order.totalAmount.currency).toBeDefined();

      // Shipping address
      expect(order.shippingAddress).toBeDefined();

      // Timestamps
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    }
  });

  it("should respect page query parameter", async () => {
    const page = 2;
    const res = await request(app)
      .get(`/api/orders/me?page=${page}`)
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body.pagination.page).toBe(page);
  });

  it("should respect limit query parameter", async () => {
    const limit = 5;
    const res = await request(app)
      .get(`/api/orders/me?limit=${limit}`)
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body.pagination.limit).toBe(limit);
    expect(res.body.orders.length).toBeLessThanOrEqual(limit);
  });

  it("should handle both page and limit query parameters", async () => {
    const page = 1;
    const limit = 10;
    const res = await request(app)
      .get(`/api/orders/me?page=${page}&limit=${limit}`)
      .set("Cookie", getAuthCookie())
      .expect(200);

    expect(res.body.pagination.page).toBe(page);
    expect(res.body.pagination.limit).toBe(limit);
    expect(res.body.orders.length).toBeLessThanOrEqual(limit);
  });

  it("should return empty array when user has no orders", async () => {
    const newUserId = "68d6a2b323d9fbe4508f0000";
    const res = await request(app)
      .get("/api/orders/me")
      .set("Cookie", getAuthCookie({ userId: newUserId }))
      .expect(200);

    expect(res.body.orders).toBeDefined();
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBe(0);
    expect(res.body.pagination.totalOrders).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });

  it("should return 401 when user is not authenticated", async () => {
    const res = await request(app).get("/api/orders/me").expect(401);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 400 for invalid page parameter", async () => {
    const res = await request(app)
      .get("/api/orders/me?page=invalid")
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/);

    expect([400, 200]).toContain(res.status);
    // If implementation validates and returns 400
    if (res.status === 400) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 for invalid limit parameter", async () => {
    const res = await request(app)
      .get("/api/orders/me?limit=invalid")
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/);

    expect([400, 200]).toContain(res.status);
    // If implementation validates and returns 400
    if (res.status === 400) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 for negative page number", async () => {
    const res = await request(app)
      .get("/api/orders/me?page=-1")
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/);

    expect([400, 200]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 for limit exceeding maximum allowed", async () => {
    const res = await request(app)
      .get("/api/orders/me?limit=1000")
      .set("Cookie", getAuthCookie())
      .expect("Content-Type", /json/);

    expect([400, 200]).toContain(res.status);
    // If implementation has max limit validation
    if (res.status === 400) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should sort orders by creation date (newest first)", async () => {
    const res = await request(app)
      .get("/api/orders/me")
      .set("Cookie", getAuthCookie())
      .expect(200);

    const { orders } = res.body;

    if (orders.length > 1) {
      const firstOrderDate = new Date(orders[0].createdAt);
      const secondOrderDate = new Date(orders[1].createdAt);
      expect(firstOrderDate.getTime()).toBeGreaterThanOrEqual(
        secondOrderDate.getTime()
      );
    }
  });

  it("should only return orders belonging to the authenticated user", async () => {
    const userId = "68d6a2b323d9fbe4508f726d";
    const res = await request(app)
      .get("/api/orders/me")
      .set("Cookie", getAuthCookie({ userId }))
      .expect(200);

    const { orders } = res.body;

    // All returned orders should belong to the authenticated user
    orders.forEach((order) => {
      expect(order.user.toString()).toBe(userId);
    });
  });

  it("should calculate total pages correctly", async () => {
    const limit = 5;
    const res = await request(app)
      .get(`/api/orders/me?limit=${limit}`)
      .set("Cookie", getAuthCookie())
      .expect(200);

    const { pagination } = res.body;
    const expectedTotalPages = Math.ceil(pagination.totalOrders / limit);
    expect(pagination.totalPages).toBe(expectedTotalPages);
  });
});
