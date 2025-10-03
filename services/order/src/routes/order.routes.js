const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const orderController = require("../controllers/order.controller");
const validation = require("../middlewares/validation.middleware");

const router = express.Router();

// Create order from current cart
router.post(
  "/",
  createAuthMiddleware(["user"]),
  validation.createOrderValidation,
  orderController.createOrder
);

// Get paginated list of current user's orders
router.get("/me", createAuthMiddleware(["user"]), orderController.getMyOrders);

// Cancel order by id
router.post(
  "/:id/cancel",
  createAuthMiddleware(["user"]),
  orderController.cancelOrderById
);

// update delivery address by id
router.patch(
  "/:id/address",
  createAuthMiddleware(["user"]),
  validation.updateAddressValidation,
  orderController.updateOrderAddress
);

// Get order by id with timeline and payment summary
router.get(
  "/:id",
  createAuthMiddleware(["user", "admin"]),
  orderController.getOrderById
);

module.exports = router;
