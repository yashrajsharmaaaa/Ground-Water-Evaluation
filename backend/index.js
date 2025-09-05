import express from "express";
import session from "express-session";   // ← add this
import waterLevel from "./routes/water-level.js";
import chat from "./routes/chat.js";

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // set secure:true if using https
  })
);

app.use("/api", waterLevel);
app.use("/api", chat);

app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
