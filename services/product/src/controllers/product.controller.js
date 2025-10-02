const productModel = require("../models/product.model");
const { uploadImage } = require("../config/imagekit.config");
const mongoose = require("mongoose");

/**
 * Create a new product with image uploads
 * @route POST /api/products
 */
async function createProduct(req, res) {
  try {
    const { title, description, priceAmount, priceCurrency = "INR" } = req.body;
    const seller = req.user.id; // Assuming auth middleware sets req.user

    const price = {
      amount: Number(priceAmount),
      currency: priceCurrency,
    };

    // Handle image uploads
    const images = await Promise.all(
      (req.files || []).map((file) => uploadImage({ buffer: file.buffer }))
    );

    // Create product
    const product = await productModel.create({
      title,
      description,
      price,
      seller,
      images,
    });

    return res.status(201).json({
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({
      message: error.message || "Internal server error",
    });
  }
}

/**
 * Get all products
 * @route GET /api/products
 */
async function getProducts(req, res) {
  const { q, minPrice, maxPrice, skip = 0, limit = 20 } = req.query;

  const filter = {};

  if (q) {
    filter.$text = { $search: q };
  }

  if (minPrice) {
    filter["price.amount"] = {
      ...filter["price.amount"],
      $gte: Number(minPrice),
    };
  }

  if (maxPrice) {
    filter["price.amount"] = {
      ...filter["price.amount"],
      $lte: Number(maxPrice),
    };
  }

  const products = await productModel
    .find(filter)
    .skip(Number(skip))
    .limit(Math.min(Number(limit), 20));

  return res.status(200).json({
    message: "Products fetched successfully",
    data: products,
  });
}

/**
 * Get product by ID
 * @route GET /api/products/:id
 */
async function getProductById(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }

  const product = await productModel.findById(id);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  return res.status(200).json({
    message: "Product fetched successfully",
    data: product,
  });
}

/**
 * Update product by ID
 * @route PATCH /api/products/:id
 */
async function updateProduct(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }

  const product = await productModel.findOne({ _id: id });

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  // Ensure the authenticated user is the seller
  if (product.seller.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Forbidden: You can only update your own products",
    });
  }

  const allowedUpdates = ["title", "description", "price"];
  for (const key of Object.keys(req.body)) {
    if (allowedUpdates.includes(key)) {
      if (key === "price" && typeof req.body.price === "object") {
        if (req.body.price.amount !== undefined) {
          product.price.amount = Number(req.body.price.amount);
        }
        if (req.body.price.currency !== undefined) {
          product.price.currency = req.body.price.currency;
        }
      } else {
        product[key] = req.body[key];
      }
    }
  }

  await product.save();

  return res.status(200).json({
    message: "Product updated successfully",
    data: product,
  });
}

/**
 * Delete product by ID
 * @route DELETE /api/products/:id
 */
async function deleteProduct(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }

  const product = await productModel.findOne({ _id: id });

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  // Ensure the authenticated user is the seller
  if (product.seller.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Forbidden: You can only delete your own products",
    });
  }

  await productModel.findOneAndDelete({ _id: id });

  return res.status(200).json({
    message: "Product deleted successfully",
  });
}

/**
 * Get products by seller
 * @route GET /api/products/seller
 */
async function getProductsBySeller(req, res) {
  const seller = req.user;

  const { skip = 0, limit = 20 } = req.query;

  const products = await productModel
    .find({ seller: seller.id })
    .skip(skip)
    .limit(Math.min(limit, 20));

  return res.status(200).json({
    message: "Products fetched successfully",
    data: products,
  });
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
};
