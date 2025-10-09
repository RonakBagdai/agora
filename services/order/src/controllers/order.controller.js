const orderModel = require("../models/order.model");
const axios = require("axios");
const { publishToQueue } = require("../broker/broker");

// Create order from current cart
async function createOrder(req, res) {
  const user = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  try {
    // 1. Fetch the user's current cart from the Cart Service
    const cartResponse = await axios.get(
      `http://agora-alb-1823681050.ap-south-1.elb.amazonaws.com/api/cart`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const products = await Promise.all(
      cartResponse.data.cart.items.map(async (item) => {
        return (
          await axios.get(
            `http://agora-alb-1823681050.ap-south-1.elb.amazonaws.com/api/products/${item.productId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        ).data.data;
      })
    );

    let priceAmount = 0;

    const orderItems = cartResponse.data.cart.items.map((item, index) => {
      const product = products.find((p) => p._id === item.productId);

      // if not in stock, dont allow order creation
      if (product.stock < item.quantity) {
        throw new Error(
          `Product ${product.title} is out of stock or insufficient quantity`
        );
      }

      const itemTotal = product.price.amount * item.quantity;
      priceAmount += itemTotal;

      return {
        product: item.productId, // ✅ Match schema field name 'product'
        quantity: item.quantity,
        price: {
          amount: product.price.amount, // ✅ Unit price
          currency: product.price.currency,
        },
      };
    });

    const order = await orderModel.create({
      user: user.id,
      items: orderItems,
      status: "PENDING",
      totalAmount: {
        amount: priceAmount,
        currency: "INR", // Assuming all products are in INR; adjust as needed
      },
      shippingAddress: {
        street: req.body.shippingAddress.street,
        city: req.body.shippingAddress.city,
        state: req.body.shippingAddress.state,
        zip: req.body.shippingAddress.pincode,
        country: req.body.shippingAddress.country,
      },
    });

    await publishToQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", order);

    return res.status(201).json({ order });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

// Get paginated list of current user's orders
async function getMyOrders(req, res) {
  const user = req.user;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1 || limit < 1) {
    return res.status(400).json({ message: "Invalid page or limit" });
  }
  const skip = (page - 1) * limit;

  try {
    const orders = await orderModel
      .find({ user: user.id })
      .skip(skip)
      .limit(limit)
      .exec();
    const totalOrders = await orderModel.countDocuments({ user: user.id });

    return res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

// Get order by id with timeline and payment summary
async function getOrderById(req, res) {
  const user = req.user;
  const orderId = req.params.id;

  if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid order ID format" });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not have access to this order" });
    }

    res.status(200).json({ order });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

// Cancel order by id
async function cancelOrderById(req, res) {
  const user = req.user;
  const orderId = req.params.id;

  if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid order ID format" });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not have access to this order" });
    }

    if (order.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "Only pending orders can be canceled" });
    }

    order.status = "CANCELED";
    await order.save();

    return res
      .status(200)
      .json({ message: "Order canceled successfully", order });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

// Update delivery address by id
async function updateOrderAddress(req, res) {
  const user = req.user;
  const orderId = req.params.id;

  if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ message: "Invalid order ID format" });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not have access to this order" });
    }

    if (order.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "Only pending orders can update address" });
    }

    order.shippingAddress = {
      street: req.body.shippingAddress.street,
      city: req.body.shippingAddress.city,
      state: req.body.shippingAddress.state,
      zip: req.body.shippingAddress.pincode,
      country: req.body.shippingAddress.country,
    };

    await order.save();

    return res
      .status(200)
      .json({ message: "Order address updated successfully", order });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrderById,
  updateOrderAddress,
};
