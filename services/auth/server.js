require("dotenv").config();
const app = require("./src/app");
const connectDb = require("./src/db/db");

// Connect to the database
connectDb();

app.listen(3000, () => {
  console.log("Auth service listening on port 3000");
});
