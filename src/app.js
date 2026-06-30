// app.js
require("./queue/workers");
const PORT = process.env.PORT || 3000;
const express = require("express");
const routes = require("./api/routes");
const app = express();
app.use(express.json());

app.use("/api", routes);

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("KARDI backend running");
});