const { subscribeToQueue } = require("./broker");
const sendEmail = require("../email");

module.exports = () => {
  subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
    const emailHTMLTemplate = `
        <h1>Welcome to our platform!</h1>
        <p>Dear ${
          data.fullName.firstName + " " + data.fullName.lastName || "<User>"
        },</p>
        <p>Thank you for registering with us. We're excited to have you on board!</p>
        <p>Best regards,<br/>The Team</p>
      `;

    await sendEmail(
      data.email,
      "Welcome to Our Platform",
      "Thank you for registering with us.",
      emailHTMLTemplate
    );
  });

  subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", async (data) => {
    const emailHTMLTemplate = `
        <h1>Payment Successful!</h1>
        <p>Dear ${data.username || "<User>"},</p>
        <p>We have received your payment of ${data.amount} ${
      data.currency
    } for order ID: ${data.orderId}.</p>
        <p>Thank you for your purchase!</p>
        <p>Best regards,<br/>The Team</p>
      `;

    await sendEmail(
      data.email,
      "Payment Successful",
      "We have received your payment. Thank you for your purchase!",
      emailHTMLTemplate
    );
  });

  subscribeToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", async (data) => {
    const emailHTMLTemplate = `
        <h1>Payment Failed</h1>
        <p>Dear ${data.username || "<User>"},</p>
        <p>Unfortunately, your payment for order ID: ${data.orderId} was not successful.</p>
        <p>Please try again or contact support if the issue persists.</p>
        <p>Best regards,<br/>The Team</p>
      `;

    await sendEmail(
      data.email,
      "Payment Failed",
      "Unfortunately, your payment was not successful. Please try again.",
      emailHTMLTemplate
    );
  });
};
