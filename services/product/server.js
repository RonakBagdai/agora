require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

// Connect to the database
connectDB();

app.listen(3001, () => {
  console.log("Product service is running on port 3001");
});
