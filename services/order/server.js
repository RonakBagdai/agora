require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

// Connect to the database
connectDB();

app.listen(3003, () => {
  console.log("Order service listening on port 3003");
});
