const { body, validationResult, param } = require("express-validator");
const mongoose = require("mongoose");

function validateResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Validation middleware for adding item to cart
const validateAddItemToCart = [
  body("productId")
    .isString()
    .withMessage("Product ID must be a string")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid Product ID format"),
  body("qty")
    .isInt({ gt: 0 })
    .withMessage("Quantity must be a positive integer"),
  validateResult,
];

// Validation middleware for updating cart item
const validateUpdateCartItem = [
  param("productId")
    .isString()
    .withMessage("Product ID must be a string")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid Product ID format"),
  body("qty")
    .isInt({ gt: 0 })
    .withMessage("Quantity must be a positive integer"),
  validateResult,
];

module.exports = {
  validateAddItemToCart,
  validateUpdateCartItem,
};
