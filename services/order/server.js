require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");
const { connect } = require("./src/broker/broker");

// Connect to the database
connectDB();
connect();

app.listen(3003, () => {
  console.log("Order service listening on port 3003");
});
