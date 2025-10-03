const express = require("express");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const cartController = require("../controllers/cart.controller");
const validation = require("../middlewares/validation.middleware");

const router = express.Router();

/* get cart*/
router.get("/", createAuthMiddleware(["user"]), cartController.getCart);

/* Add item to cart */
router.post(
  "/items",
  validation.validateAddItemToCart,
  createAuthMiddleware(["user"]),
  cartController.addItemToCart
);

/* Update item quantity in cart */
router.patch(
  "/items/:productId",
  validation.validateUpdateCartItem,
  createAuthMiddleware(["user"]),
  cartController.updateCartItem
);

module.exports = router;
