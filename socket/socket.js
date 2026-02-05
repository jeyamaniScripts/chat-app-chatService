const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://chat-app-practice-frontend.vercel.app",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // 🔐 Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 User Connected:", socket.id);

    const userId = socket.user.id;

    // 🔥 Each user joins their personal room
    socket.join(userId);

    // Join chat room for messages
    socket.on("join chat", (chatId) => {
      socket.join(chatId);
      console.log("Joined chat room:", chatId);
      console.log("📦 Rooms for", socket.user.id, ":", [...socket.rooms]);
    });

    // Typing
    socket.on("typing", ({ chatId, userId, name }) => {
      socket.to(chatId).emit("typing", { userId, name });
    });

    socket.on("stopTyping", ({ chatId, userId }) => {
      socket.to(chatId).emit("stopTyping", { userId });
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 User Disconnected:", socket.id);
      console.log("🔌 Socket disconnected:", reason);
    });
  });
};

const getIO = () => io;

module.exports = { initSocket, getIO };
