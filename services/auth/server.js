require("dotenv").config();
const app = require("./src/app");
const connectDb = require("./src/db/db");
const { connect } = require("./src/broker/broker");

// Connect to the database
connectDb();
// Connect to RabbitMQ
connect();

app.listen(3000, () => {
  console.log("Auth service listening on port 3000");
});
