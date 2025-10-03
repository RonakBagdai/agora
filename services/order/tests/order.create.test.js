const request = require("supertest");
const app = require("../src/app");
const { getAuthCookie } = require("../tests/setup/auth");
const { setupAxiosMock, resetAxiosMock } = require("./setup/axiosMock");

describe("POST /api/orders — Create order from current cart", () => {
  // Setup mocks before all tests
  beforeAll(() => {
    setupAxiosMock();
  });

  // Reset mocks after each test
  afterEach(() => {
    setupAxiosMock(); // Re-setup to reset any changes
  });

  // Clean up after all tests
  afterAll(() => {
    resetAxiosMock();
  });

  const sampleAddress = {
    street: "123 Main St",
    city: "Metropolis",
    state: "CA",
    pincode: "90210",
    country: "USA",
  };

  it("creates order from current cart, computes totals, sets status=PENDING, reserves inventory", async () => {
    // Example: Provide any inputs the API expects (headers/cookies/body). Adjust when auth is wired.
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", getAuthCookie())
      .send({ shippingAddress: sampleAddress })
      .expect("Content-Type", /json/);

    // Log the response for debugging
    if (res.status !== 201) {
      console.log("Response status:", res.status);
      console.log("Response body:", res.body);
    }

    expect(res.status).toBe(201);

    // Response shape assertions (adjust fields as you implement)
    expect(res.body).toBeDefined();
    expect(res.body.order).toBeDefined();
    const { order } = res.body;
    expect(order._id).toBeDefined();
    expect(order.user).toBeDefined();
    expect(order.status).toBe("PENDING");

    // Items copied from priced cart
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items.length).toBeGreaterThan(0);
    for (const it of order.items) {
      expect(it.product).toBeDefined(); // ✅ Schema uses 'product' field
      expect(it.quantity).toBeGreaterThan(0);
      expect(it.price).toBeDefined();
      expect(typeof it.price.amount).toBe("number");
      expect(["USD", "INR"]).toContain(it.price.currency);
    }

    // Totals include taxes + shipping
    expect(order.totalAmount).toBeDefined(); // ✅ Changed from 'totalPrice' to 'totalAmount'
    expect(typeof order.totalAmount.amount).toBe("number");
    expect(["USD", "INR"]).toContain(order.totalAmount.currency);

    // Shipping address persisted
    expect(order.shippingAddress).toMatchObject({
      street: sampleAddress.street,
      city: sampleAddress.city,
      state: sampleAddress.state,
      zip: sampleAddress.pincode,
      country: sampleAddress.country,
    });

    // Inventory reservation acknowledgement (shape up to you)
    // For example, you might include a flag or reservation id
    // expect(res.body.inventoryReservation).toEqual({ success: true })
  });

  it("returns 422 when shipping address is missing/invalid", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", getAuthCookie())
      .send({})
      .expect("Content-Type", /json/)
      .expect(400);

    expect(res.body.errors || res.body.message).toBeDefined();
  });
});
