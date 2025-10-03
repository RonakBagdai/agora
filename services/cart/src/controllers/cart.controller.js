const cartModel = require("../models/cart.model");

// Get cart
async function getCart(req, res) {
  const user = req.user;

  let cart = await cartModel.findOne({ user: user.id });
  if (!cart) {
    cart = new cartModel({ user: user.id, items: [] });
    await cart.save();
  }

  res.status(200).json({
    message: "Cart retrieved successfully",
    cart,
    totals: {
      itemCount: cart.items.length,
      totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    },
  });
}

// Add item to cart
async function addItemToCart(req, res) {
  const { productId, qty } = req.body;

  const user = req.user;

  let cart = await cartModel.findOne({ user: user.id });
  if (!cart) {
    cart = new cartModel({ user: user.id, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (existingItemIndex >= 0) {
    cart.items[existingItemIndex].quantity += qty;
  } else {
    cart.items.push({ productId, quantity: qty });
  }

  await cart.save();

  res.status(200).json({
    message: "Item added to cart",
    cart,
  });
}

// Update item quantity in cart
async function updateCartItem(req, res) {
  const { productId } = req.params;
  const { qty } = req.body;
  const user = req.user;

  const cart = await cartModel.findOne({ user: user.id });

  if (!cart) {
    return res.status(404).json({
      message: "Cart not found",
    });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (existingItemIndex === -1) {
    return res.status(404).json({
      message: "Item not found in cart",
    });
  }

  cart.items[existingItemIndex].quantity = qty;
  await cart.save();

  res.status(200).json({
    message: "Item updated successfully",
    cart,
  });
}

module.exports = {
  addItemToCart,
  updateCartItem,
  getCart,
};
