import express from "express";
import waterLevel from "./routes/water-level.js"
const app = express();
app.use(express.json());

app.use("/api", waterLevel);
app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
