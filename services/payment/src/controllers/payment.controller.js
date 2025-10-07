const paymentModel = require("../models/payment.model");
const axios = require("axios");
const { publishToQueue } = require("../broker/broker");

require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Controller to handle payment creation
async function createPayment(req, res) {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  try {
    const orderId = req.params.orderId;

    const orderResponse = await axios.get(
      `http://localhost:3003/api/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const price = orderResponse.data.order.totalAmount;

    const order = await razorpay.orders.create(price);

    const payment = await paymentModel.create({
      order: orderId,
      razorpayOrderId: order.id,
      user: req.user.id,
      price: {
        amount: price.amount,
        currency: price.currency,
      },
    });

    res.status(201).json({ message: "Payment initiated", payment });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

// Controller to handle payment verification
async function verifyPayment(req, res) {
  const { razorpayOrderId, paymentId, signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  try {
    const {
      validatePaymentVerification,
    } = require("../../node_modules/razorpay/dist/utils/razorpay-utils");

    const isValid = validatePaymentVerification(
      {
        order_id: razorpayOrderId,
        payment_id: paymentId,
      },
      signature,
      secret
    );

    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const payment = await paymentModel.findOne({
      razorpayOrderId,
      status: "PENDING",
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.paymentId = paymentId;
    payment.signature = signature;
    payment.status = "COMPLETED";
    await payment.save();

    await publishToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", {
      email: req.user.email,
      orderId: payment.order,
      paymentId: payment.paymentId,
      amount: payment.price.amount / 100,
      currency: payment.price.currency,
      fullName: req.user.fullName,
    });

    res.status(200).json({ message: "Payment verified successfully", payment });
  } catch (error) {
    await publishToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", {
      email: req.user.email,
      paymentId: paymentId,
      orderId: razorpayOrderId,
      fullName: req.user.fullName,
    });

    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createPayment,
  verifyPayment,
};
