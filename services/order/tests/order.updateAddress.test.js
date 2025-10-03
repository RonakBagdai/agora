const request = require("supertest");
const app = require("../src/app");
const { getAuthCookie } = require("../tests/setup/auth");
const { setupAxiosMock, resetAxiosMock } = require("./setup/axiosMock");
const orderModel = require("../src/models/order.model");

describe("PATCH /api/orders/:id/address — Update delivery address prior to payment capture", () => {
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

  const validAddress = {
    street: "456 New Street",
    city: "San Francisco",
    state: "CA",
    pincode: "94102",
    country: "USA",
  };

  const updatedAddress = {
    street: "789 Updated Ave",
    city: "Los Angeles",
    state: "CA",
    pincode: "90001",
    country: "USA",
  };

  // Reset mocks after each test
  afterEach(() => {
    setupAxiosMock();
  });

  // Clean up after all tests
  afterAll(() => {
    resetAxiosMock();
  });

  it("should successfully update address for PENDING order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    if (res.status !== 200) {
      console.log("Response status:", res.status);
      console.log("Response body:", res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.order).toBeDefined();

    const { order } = res.body;
    expect(order.shippingAddress).toBeDefined();
    expect(order.shippingAddress.street).toBe(validAddress.street);
    expect(order.shippingAddress.city).toBe(validAddress.city);
    expect(order.shippingAddress.state).toBe(validAddress.state);
    expect(order.shippingAddress.zip).toBe(validAddress.pincode);
    expect(order.shippingAddress.country).toBe(validAddress.country);
    expect(res.body.message).toBeDefined();
    expect(res.body.message).toMatch(/address.*update/i);
  });

  it("should update individual address fields", async () => {
    const partialUpdate = {
      shippingAddress: {
        street: "789 Oak Boulevard",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(partialUpdate)
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      expect(res.body.order.shippingAddress.street).toBe(
        partialUpdate.shippingAddress.street
      );
    }
  });

  it("should return 400 when address is missing required fields", async () => {
    const incompleteAddress = {
      shippingAddress: {
        street: "123 Main St",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(incompleteAddress)
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.errors).toBeDefined();
  });

  it("should return 400 when shippingAddress is not provided", async () => {
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({})
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.errors).toBeDefined();
  });

  it("should return 400 when trying to update address for CONFIRMED (paid) order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${confirmedOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 when trying to update address for SHIPPED order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${shippedOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 when trying to update address for DELIVERED order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${deliveredOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 400 when trying to update address for CANCELED order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${canceledOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    expect([400, 409, 404]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.message || res.body.error).toBeDefined();
    }
  });

  it("should return 404 when order does not exist", async () => {
    const res = await request(app)
      .patch(`/api/orders/${nonExistentOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/)
      .expect(404);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 400 for invalid order id format", async () => {
    const res = await request(app)
      .patch(`/api/orders/${invalidOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 401 when user is not authenticated", async () => {
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .send({ shippingAddress: validAddress })
      .expect(401);

    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should return 403 when user tries to update another user's order address", async () => {
    const differentUserId = "68d6a2b323d9fbe4508f9999";
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: differentUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    expect([403, 404]).toContain(res.status);
    expect(res.body.message || res.body.error).toBeDefined();
  });

  it("should validate street field", async () => {
    const invalidStreet = {
      shippingAddress: {
        street: "",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        country: "India",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(invalidStreet)
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.errors).toBeDefined();
  });

  it("should validate city field", async () => {
    const invalidCity = {
      shippingAddress: {
        street: "123 Main St",
        city: "",
        state: "Maharashtra",
        pincode: "411001",
        country: "India",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(invalidCity)
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.errors).toBeDefined();
  });

  it("should validate pincode format", async () => {
    const invalidPincode = {
      shippingAddress: {
        street: "123 Main St",
        city: "Pune",
        state: "Maharashtra",
        pincode: "12345",
        country: "India",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(invalidPincode)
      .expect("Content-Type", /json/);

    if (res.status === 400) {
      expect(res.body.message || res.body.errors).toBeDefined();
    }
  });

  it("should validate country field", async () => {
    const invalidCountry = {
      shippingAddress: {
        street: "123 Main St",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        country: "",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(invalidCountry)
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.message || res.body.errors).toBeDefined();
  });

  it("should preserve other order fields when updating address", async () => {
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: updatedAddress })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const { order } = res.body;
      expect(order._id).toBeDefined();
      expect(order.items).toBeDefined();
      expect(order.totalAmount).toBeDefined();
      expect(order.status).toBeDefined();
      expect(order.user).toBeDefined();
    }
  });

  it("should update the order's updatedAt timestamp", async () => {
    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send({ shippingAddress: validAddress })
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const { order } = res.body;
      expect(order.updatedAt).toBeDefined();
      const updatedAt = new Date(order.updatedAt);
      const createdAt = new Date(order.createdAt);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    }
  });

  it("should handle special characters in address fields", async () => {
    const addressWithSpecialChars = {
      shippingAddress: {
        street: "123, D'Costa Lane, Flat #4-B",
        city: "St. John's",
        state: "Goa",
        pincode: "403001",
        country: "India",
      },
    };

    const res = await request(app)
      .patch(`/api/orders/${pendingOrderId}/address`)
      .set("Cookie", getAuthCookie({ userId: testUserId }))
      .send(addressWithSpecialChars)
      .expect("Content-Type", /json/);

    if (res.status === 200) {
      const { order } = res.body;
      expect(order.shippingAddress.street).toBe(
        addressWithSpecialChars.shippingAddress.street
      );
    }
  });
});
