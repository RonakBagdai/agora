const jwt = require("jsonwebtoken");

// Returns an array suitable for Supertest's .set('Cookie', ...)
// Default cookie name is 'token'; adjust if your app expects a different name.
function getAuthCookie({
  userId = "68d6a2b323d9fbe4508f726d",
  extra = { role: "user" },
} = {}) {
  const secret = process.env.JWT_SECRET || "test-secret";
  const payload = { id: userId, ...extra };
  const token = jwt.sign(payload, secret, { expiresIn: "1h" });
  const cookieName = process.env.JWT_COOKIE_NAME || "token";
  return [`${cookieName}=${token}`];
}

module.exports = { getAuthCookie };
