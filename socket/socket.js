const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true, //  auto reflect origin (fixes Render CORS)
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // 🔐 Socket JWT auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 User Connected:", socket.id);

    const userId = socket.user.id;
    socket.join(userId);

    socket.on("join chat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("typing", ({ chatId, userId, name }) => {
      socket.to(chatId).emit("typing", { userId, name });
    });

    socket.on("stopTyping", ({ chatId, userId }) => {
      socket.to(chatId).emit("stopTyping", { userId });
    });

    socket.on("disconnect", () => {
      console.log("🔴 User Disconnected:", socket.id);
    });
  });
};

module.exports = { initSocket };
