const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("AI Buddy Service is up and running");
});

module.exports = app;
