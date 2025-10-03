const axios = require("axios");
const mongoose = require("mongoose");

// Generate valid ObjectIds for testing
const productId1 = new mongoose.Types.ObjectId().toString();
const productId2 = new mongoose.Types.ObjectId().toString();
const cartId = new mongoose.Types.ObjectId().toString();
const userId = "68d6a2b323d9fbe4508f726d";

// Mock data
const mockCartData = {
  cart: {
    _id: cartId,
    user: userId,
    items: [
      {
        productId: productId1,
        quantity: 2,
      },
      {
        productId: productId2,
        quantity: 1,
      },
    ],
  },
};

const mockProductsData = {
  [productId1]: {
    _id: productId1,
    title: "Test Product 1",
    description: "A great product",
    price: {
      amount: 100,
      currency: "INR",
    },
    stock: 10,
  },
  [productId2]: {
    _id: productId2,
    title: "Test Product 2",
    description: "Another great product",
    price: {
      amount: 200,
      currency: "INR",
    },
    stock: 5,
  },
};

// Setup axios mock
function setupAxiosMock() {
  jest.spyOn(axios, "get").mockImplementation((url, config) => {
    // Mock cart service
    if (url.includes("/api/cart")) {
      return Promise.resolve({
        data: mockCartData,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    }

    // Mock product service
    if (url.includes("/api/products/")) {
      const productId = url.split("/").pop();
      const product = mockProductsData[productId];

      if (product) {
        return Promise.resolve({
          data: {
            data: product,
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
      } else {
        return Promise.reject({
          response: {
            status: 404,
            data: { message: "Product not found" },
          },
        });
      }
    }

    // Default: reject unmocked URLs
    return Promise.reject(new Error(`Unmocked URL: ${url}`));
  });
}

// Reset mocks
function resetAxiosMock() {
  jest.restoreAllMocks();
}

// Helper to update mock cart
function setMockCart(cart) {
  mockCartData.cart = { ...mockCartData.cart, ...cart };
}

// Helper to update mock product
function setMockProduct(productId, product) {
  mockProductsData[productId] = product;
}

module.exports = {
  setupAxiosMock,
  resetAxiosMock,
  setMockCart,
  setMockProduct,
  mockCartData,
  mockProductsData,
};
