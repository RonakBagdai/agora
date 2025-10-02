const { body, validationResult } = require("express-validator");

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  next();
};

/**
 * Validation rules for creating a product
 */
const createProductValidation = [
  body("title").isString().trim().notEmpty().withMessage("Title is required"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("priceAmount")
    .notEmpty()
    .withMessage("Price amount is required")
    .isFloat({ gt: 0 })
    .withMessage("Price amount must be a positive number greater than 0"),

  body("priceCurrency")
    .optional()
    .isIn(["USD", "INR"])
    .withMessage("Currency must be either USD or INR"),

  handleValidationErrors,
];

module.exports = {
  createProductValidation,
};
