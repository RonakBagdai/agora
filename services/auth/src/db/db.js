const mongoose = require("mongoose");

async function connectDb() {
  try {
    if (mongoose.connection.readyState === 1) {
      // already connected
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

module.exports = connectDb;
