// Environment setup for Order service tests
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_for_orders";
process.env.NODE_ENV = "test";
