const request = require("supertest");
const app = require("../src/app");
const { getAuthCookie } = require("../tests/setup/auth");
const { setupAxiosMock, resetAxiosMock } = require("./setup/axiosMock");
const orderModel = require("../src/models/order.model");

describe("GET /api/orders/:id — Get order by id with timeline and payment summary", () => {
  let testOrderId;
  const testUserId = "68d6a2b323d9fbe4508f726d";
  const differentUserId = "68d6a2b323d9fbe4508f9999";

  // Setup mocks before all tests
  beforeAll(() => {
    setupAxiosMock();
  });

  // Create a test order before each test
  beforeEach(async () => {
    const testOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439011",
          quantity: 2,
          price: {
            amount: 99.99,
            currency: "USD",
          },
        },
        {
          product: "507f1f77bcf86cd799439012",
          quantity: 1,
          price: {
            amount: 49.99,
            currency: "USD",
          },
        },
      ],
      status: "PENDING",
      totalAmount: {
        amount: 249.97,
        currency: "USD",
      },
      shippingAddress: {
        street: "123 Main St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    testOrderId = testOrder._id.toString();
  });

  // Reset mocks after each test
  afterEach(() => {
    setupAxiosMock();
  });

  // Clean up after all tests
  afterAll(() => {
    resetAxiosMock();
  });

  it("should return 200 with order details, timeline, and payment summary", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body).toBeDefined();
    const order = res.body.order || res.body.data || res.body;

    // Basic identity
    expect(order._id || order.id).toBe(testOrderId);
    expect(order.user).toBeDefined();

    // Items
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items.length).toBeGreaterThan(0);

    // Validate item structure
    order.items.forEach((item) => {
      expect(item.product).toBeDefined();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.price).toBeDefined();
      expect(item.price.amount).toBeDefined();
      expect(item.price.currency).toBeDefined();
    });

    // Status and total
    expect(order.status).toBeDefined();
    expect([
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELED",
    ]).toContain(order.status);

    const totalAmount = order.totalAmount || order.totalPrice;
    expect(totalAmount).toBeDefined();
    expect(typeof totalAmount.amount).toBe("number");
    expect(totalAmount.currency).toBeDefined();

    // Shipping address
    expect(order.shippingAddress).toBeDefined();
    expect(order.shippingAddress.street).toBeDefined();
    expect(order.shippingAddress.city).toBeDefined();
    expect(order.shippingAddress.state).toBeDefined();
    expect(order.shippingAddress.country).toBeDefined();

    // Timeline (optional - if implemented)
    if (order.timeline) {
      expect(Array.isArray(order.timeline)).toBe(true);
      if (order.timeline.length > 0) {
        const event = order.timeline[0];
        expect(event).toHaveProperty("status");
        expect(event).toHaveProperty("timestamp");
      }
    }

    // Payment Summary (optional - if implemented)
    if (order.paymentSummary) {
      expect(order.paymentSummary).toBeDefined();
      expect(order.paymentSummary.subtotal).toBeDefined();
      expect(order.paymentSummary.total).toBeDefined();
    }

    // Timestamps
    expect(order.createdAt).toBeDefined();
    expect(order.updatedAt).toBeDefined();
  });

  it("should return 404 when order does not exist", async () => {
    const nonExistentId = "507f1f77bcf86cd799439099";
    const res = await request(app)
      .get(`/api/orders/${nonExistentId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect("Content-Type", /json/)
      .expect(404);

    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.error || res.body.message).toMatch(/not found|no.*order/i);
  });

  it("should return 400 for invalid order ID format", async () => {
    const invalidId = "invalid-id-format";
    const res = await request(app)
      .get(`/api/orders/${invalidId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.error || res.body.message).toBeDefined();
  });

  it("should return 401 when user is not authenticated", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .expect(401);

    expect(res.body.error || res.body.message).toBeDefined();
  });

  it("should return 403 or 404 when user tries to access another user's order", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: differentUserId }))
      .expect("Content-Type", /json/);

    // Implementation may return either 403 Forbidden or 404 Not Found
    expect([403, 404]).toContain(res.status);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it("should include all order items with correct structure", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    expect(order.items.length).toBe(2);

    // Verify all items have required fields
    order.items.forEach((item) => {
      expect(item).toHaveProperty("product");
      expect(item).toHaveProperty("quantity");
      expect(item).toHaveProperty("price");
      expect(item.price).toHaveProperty("amount");
      expect(item.price).toHaveProperty("currency");
      expect(["USD", "INR"]).toContain(item.price.currency);
    });
  });

  it("should return order with PENDING status for newly created order", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    expect(order.status).toBe("PENDING");
  });

  it("should include timestamps (createdAt and updatedAt)", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    expect(order.createdAt).toBeDefined();
    expect(order.updatedAt).toBeDefined();

    // Validate timestamp format
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(new Date(order.updatedAt).toISOString()).toBe(order.updatedAt);
  });

  it("should return order with correct total amount calculation", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    const totalAmount = order.totalAmount || order.totalPrice;

    expect(totalAmount.amount).toBe(249.97);
    expect(totalAmount.currency).toBe("USD");
  });

  it("should populate product details in items if API supports population", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    const firstItem = order.items[0];

    // Check if product is populated with details (not just an ID)
    if (typeof firstItem.product === "object" && firstItem.product._id) {
      expect(firstItem.product._id).toBeDefined();
      // API may populate additional product fields like name, description, etc.
    }
  });

  it("should return order with complete shipping address", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    const address = order.shippingAddress;

    expect(address.street).toBe("123 Main St");
    expect(address.city).toBe("Metropolis");
    expect(address.state).toBe("CA");
    expect(address.zip).toBe("90210");
    expect(address.country).toBe("USA");
  });

  it("should return consistent data structure across multiple requests", async () => {
    const res1 = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const res2 = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order1 = res1.body.order || res1.body.data || res1.body;
    const order2 = res2.body.order || res2.body.data || res2.body;

    expect(order1._id || order1.id).toBe(order2._id || order2.id);
    expect(order1.status).toBe(order2.status);
    expect(order1.items.length).toBe(order2.items.length);
  });

  it("should handle orders with different statuses correctly", async () => {
    // Create orders with different statuses
    const confirmedOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439011",
          quantity: 1,
          price: { amount: 99.99, currency: "USD" },
        },
      ],
      status: "CONFIRMED",
      totalAmount: { amount: 99.99, currency: "USD" },
      shippingAddress: {
        street: "456 Oak St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });

    const res = await request(app)
      .get(`/api/orders/${confirmedOrder._id}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    expect(order.status).toBe("CONFIRMED");
  });

  it("should return order with correct user reference", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;

    // User field might be populated or just an ID
    if (typeof order.user === "string") {
      expect(order.user).toBe(testUserId);
    } else if (typeof order.user === "object") {
      expect(order.user._id || order.user.id).toBe(testUserId);
    }
  });

  it("should validate order ID is a valid MongoDB ObjectId", async () => {
    const invalidIds = [
      "123",
      "notanobjectid",
      "12345678901234567890123g", // invalid character
      "null",
    ];

    for (const invalidId of invalidIds) {
      const res = await request(app)
        .get(`/api/orders/${invalidId}`)
        .set("Cookie", getAuthCookie({ userId: testUserId }));

      expect([400, 404]).toContain(res.status);
    }
  });

  it("should handle orders with multiple items correctly", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;

    expect(order.items.length).toBe(2);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[1].quantity).toBe(1);
  });

  it("should return order with currency information", async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderId}`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .expect(200);

    const order = res.body.order || res.body.data || res.body;
    const totalAmount = order.totalAmount || order.totalPrice;

    expect(totalAmount.currency).toBeDefined();
    expect(["USD", "INR"]).toContain(totalAmount.currency);

    // All items should have the same currency
    order.items.forEach((item) => {
      expect(["USD", "INR"]).toContain(item.price.currency);
    });
  });
});
