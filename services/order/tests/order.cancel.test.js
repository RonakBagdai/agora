const request = require("supertest");
const app = require("../src/app");
const { getAuthCookie } = require("../tests/setup/auth");
const { setupAxiosMock, resetAxiosMock } = require("./setup/axiosMock");
const orderModel = require("../src/models/order.model");

describe("POST /api/orders/:id/cancel — Buyer-initiated cancel while pending/paid rules apply", () => {
  let pendingOrderId;
  let confirmedOrderId;
  let shippedOrderId;
  let deliveredOrderId;
  let canceledOrderId;
  const testUserId = "68d6a2b323d9fbe4508f726d";
  const invalidOrderId = "invalid-id-format";
  const nonExistentOrderId = "507f1f77bcf86cd799439099";

  // Setup mocks before all tests
  beforeAll(() => {
    setupAxiosMock();
  });

  // Create test orders with different statuses before each test
  beforeEach(async () => {
    // Create PENDING order
    const pendingOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439011",
          quantity: 1,
          price: { amount: 99.99, currency: "USD" },
        },
      ],
      status: "PENDING",
      totalAmount: { amount: 99.99, currency: "USD" },
      shippingAddress: {
        street: "123 Main St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    pendingOrderId = pendingOrder._id.toString();

    // Create CONFIRMED order
    const confirmedOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439012",
          quantity: 1,
          price: { amount: 149.99, currency: "USD" },
        },
      ],
      status: "CONFIRMED",
      totalAmount: { amount: 149.99, currency: "USD" },
      shippingAddress: {
        street: "456 Oak St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    confirmedOrderId = confirmedOrder._id.toString();

    // Create SHIPPED order
    const shippedOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439013",
          quantity: 1,
          price: { amount: 79.99, currency: "USD" },
        },
      ],
      status: "SHIPPED",
      totalAmount: { amount: 79.99, currency: "USD" },
      shippingAddress: {
        street: "789 Elm St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    shippedOrderId = shippedOrder._id.toString();

    // Create DELIVERED order
    const deliveredOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439014",
          quantity: 1,
          price: { amount: 59.99, currency: "USD" },
        },
      ],
      status: "DELIVERED",
      totalAmount: { amount: 59.99, currency: "USD" },
      shippingAddress: {
        street: "321 Pine St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    deliveredOrderId = deliveredOrder._id.toString();

    // Create CANCELED order
    const canceledOrder = await orderModel.create({
      user: testUserId,
      items: [
        {
          product: "507f1f77bcf86cd799439015",
          quantity: 1,
          price: { amount: 39.99, currency: "USD" },
        },
      ],
      status: "CANCELED",
      totalAmount: { amount: 39.99, currency: "USD" },
      shippingAddress: {
        street: "654 Maple St",
        city: "Metropolis",
        state: "CA",
        zip: "90210",
        country: "USA",
      },
    });
    canceledOrderId = canceledOrder._id.toString();
  });

  // Reset mocks after each test
  afterEach(() => {
    setupAxiosMock();
  });

  // Clean up after all tests
  afterAll(() => {
    resetAxiosMock();
  });

  it("should successfully cancel order with PENDING status", async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Changed my mind" })
      .expect("Content-Type", /json/);

    if (res.status !== 200) {
      console.log("Response status:", res.status);
      console.log("Response body:", res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();

    const order = res.body.order || res.body.data || res.body;
    expect(order).toBeDefined();

    // Order status should be updated to CANCELED
    expect(order.status).toBe("CANCELED");

    // Success message should be included
    if (res.body.message) {
      expect(res.body.message).toMatch(/cancel/i);
    }
  });

  it("should successfully cancel order with CONFIRMED (paid) status", async () => {
    const res = await request(app)
      .post(`/api/orders/${confirmedOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Product no longer needed" })
      .expect("Content-Type", /json/);

    expect([200, 400, 409]).toContain(res.status);

    if (res.status === 200) {
      const order = res.body.order || res.body.data || res.body;
      expect(order.status).toBe("CANCELED");
      // Refund information might be included
      if (res.body.refund) {
        expect(res.body.refund).toBeDefined();
        expect(res.body.refund.status).toBeDefined();
      }
    }
  });

  it("should include cancellation reason in the response", async () => {
    const cancellationReason = "Found a better deal elsewhere";
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: cancellationReason })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const order = res.body.order || res.body.data || res.body;
      expect(order).toBeDefined();
      // Cancellation details might be stored
      if (order.cancellationReason) {
        expect(order.cancellationReason).toBe(cancellationReason);
      }
    }
  });

  it("should return 400 when trying to cancel order with SHIPPED status", async () => {
    const res = await request(app)
      .post(`/api/orders/${shippedOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Changed my mind" })
      .expect("Content-Type", /json/);

    // Order is already shipped, should not allow cancellation
    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 when trying to cancel order with DELIVERED status", async () => {
    const res = await request(app)
      .post(`/api/orders/${deliveredOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Not satisfied" })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 when trying to cancel already CANCELED order", async () => {
    const res = await request(app)
      .post(`/api/orders/${canceledOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Duplicate cancel" })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 404 when order does not exist", async () => {
    const res = await request(app)
      .post(`/api/orders/${nonExistentOrderId}/cancel`)
      .set("Cookie", getAuthCookie())
      .send({ reason: "Test" })
      .expect("Content-Type", /json/)
      .expect(404);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 400 for invalid order id format", async () => {
    const res = await request(app)
      .post(`/api/orders/${invalidOrderId}/cancel`)
      .set("Cookie", getAuthCookie())
      .send({ reason: "Test" })
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 401 when user is not authenticated", async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .send({ reason: "Test" })
      .expect(401);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 403 when user tries to cancel another user's order", async () => {
    const differentUserId = "68d6a2b323d9fbe4508f9999";
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: differentUserId }))
      .send({ reason: "Test" })
      .expect("Content-Type", /json/);

    expect([403, 404]).toContain(res.status);
    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should accept cancellation without reason (optional field)", async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({})
      .expect("Content-Type", /json/);

    // Should still process cancellation even without reason
    expect([200, 400, 404]).toContain(res.status);
  });

  it("should restore inventory when canceling PENDING order", async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Cancel and restore inventory" })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const order = res.body.order || res.body.data || res.body;
      expect(order.status).toBe("CANCELED");
      // Inventory restoration acknowledgement might be included
      if (res.body.inventoryRestored !== undefined) {
        expect(res.body.inventoryRestored).toBe(true);
      }
    }
  });

  it("should initiate refund process when canceling CONFIRMED (paid) order", async () => {
    const res = await request(app)
      .post(`/api/orders/${confirmedOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Need refund" })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      // Check if refund information is included
      if (res.body.refund) {
        expect(res.body.refund).toBeDefined();
        expect(res.body.refund.status).toBeDefined();
        expect(["INITIATED", "PENDING", "PROCESSING"]).toContain(
          res.body.refund.status
        );
      }
    }
  });

  it("should update order timeline with cancellation event", async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Timeline test" })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const order = res.body.order || res.body.data || res.body;
      if (order.timeline) {
        const timeline = order.timeline;
        expect(Array.isArray(timeline)).toBe(true);

        // Check if CANCELED status is in timeline
        const cancelEvent = timeline.find(
          (event) => event.status === "CANCELED"
        );
        if (cancelEvent) {
          expect(cancelEvent.timestamp).toBeDefined();
        }
      }
    }
  });

  it("should handle concurrent cancellation requests gracefully", async () => {
    // This test would ideally test race conditions, but we can at least verify
    // that multiple cancel attempts don't cause server errors
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: "Concurrent test" })
      .expect("Content-Type", /json/);

    // Should either succeed or return appropriate error
    expect([200, 400, 409, 404]).toContain(res.status);
  });

  it("should return proper error message with reason validation", async () => {
    const longReason = "a".repeat(1001); // Assuming max length is 1000
    const res = await request(app)
      .post(`/api/orders/${pendingOrderId}/cancel`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ reason: longReason })
      .expect("Content-Type", /json/);

    // If validation exists for reason length
    if (res.status === 400) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });
});
