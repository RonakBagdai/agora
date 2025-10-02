const productModel = require("../models/product.model");
const { uploadImage } = require("../config/imagekit.config");

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

module.exports = {
  createProduct,
};
