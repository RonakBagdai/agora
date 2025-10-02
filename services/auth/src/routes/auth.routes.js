const express = require("express");
const validators = require("../middlewares/validator.middleware");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// POST /auth/register
router.post(
  "/register",
  validators.registerUserValidations,
  authController.registerUser
);

// POST /auth/login
router.post(
  "/login",
  validators.loginUserValidations,
  authController.loginUser
);

// GET /auth/me
router.get("/me", authMiddleware.authMiddleware, authController.getCurrentUser);

// GET /auth/logout
router.get("/logout", authController.logoutUser);

// GET /users/me/addresses
router.get(
  "/users/me/addresses",
  authMiddleware.authMiddleware,
  authController.getUserAddresses
);

// POST /users/me/addresses
router.post(
  "/users/me/addresses",
  validators.addUserAddressValidations,
  authMiddleware.authMiddleware,
  authController.addUserAddress
);

// DELETE /users/me/addresses/:addressId
router.delete(
  "/users/me/addresses/:addressId",
  authMiddleware.authMiddleware,
  authController.deleteUserAddress
);

module.exports = router;
