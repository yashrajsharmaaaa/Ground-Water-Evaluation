import express from "express";
import session from "express-session";
import cors from "cors";  
import waterLevel from "./routes/water-level.js";
import chat from "./routes/chat.js";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, 
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.get("/",(req, res)=> {
  res.send("backend running ✅")
})

app.use("/api", waterLevel);
app.use("/api", chat);

app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
