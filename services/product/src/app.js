const express = require("express");
const cookieParser = require("cookie-parser");
const productRoutes = require("./routes/product.routes");

const app = express();
app.use(express.json());
app.use(cookieParser());

/* Product Routes */
app.use("/api/products", productRoutes);

module.exports = app;
