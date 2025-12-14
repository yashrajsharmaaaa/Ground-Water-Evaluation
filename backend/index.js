import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import waterLevelRouter from "./routes/water-level.js";
import chat from "./routes/chat.js";
import authRouter from "./routes/auth.js";
import systemRouter from "./routes/system.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestTimer } from "./utils/performance.js";

dotenv.config({ path: [".env.local", ".env"] });

const app = express();

// MongoDB connection with optimized settings
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/jalmitra";
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
app.use(compression());

// Performance monitoring
app.use(requestTimer);

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://192.168.0.193:8081'];

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins 
      : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later.",
});

app.use("/api", limiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.get("/",(req, res)=> {
  res.json({ 
    status: "running",
    message: "JalMitra API ✅",
    version: "1.0.0",
    endpoints: {
      waterLevels: "/api/water-levels",
      chat: "/api/chat",
      auth: "/api/auth"
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use("/api", waterLevelRouter);
app.use("/api", chat);
app.use("/api/auth", authRouter);
app.use("/api/system", systemRouter);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
