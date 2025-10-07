const mongoose = require("mongoose");

// Define the product schema
const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["USD", "INR"],
      default: "INR",
    },
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  images: [
    {
      url: String,
      thumbnail: String,
      id: String,
    },
  ],
  stock: {
    type: Number,
    default: 0,
  },
});

// Create text index for search
productSchema.index({ title: "text", description: "text" });

// Create the product model
const productModel = mongoose.model("product", productSchema);

// Export the model
module.exports = productModel;
