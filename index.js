const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");
const protect = require("./middleware/auth.middleware.js");
const { initSocket } = require("./socket/socket.js"); // 👈 import
const startGrpcServer = require("./grpc/server.js");

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5001;

// middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-practice-frontend.vercel.app",
  "https://chatapp-practice-frontend.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// test route
app.get("/health", (req, res) => {
  res.json({ status: "Chat service running" });
});

app.get("/api/chat/test", protect, (req, res) => {
  res.json({
    message: "Protected chat route works",
    user: req.user,
  });
});

app.use("/api/chat", require("./rest/chat.routes"));

// create HTTP server
const server = http.createServer(app);

// initialize socket
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 REST + Socket server running on port ${PORT}`);
});

startGrpcServer();
