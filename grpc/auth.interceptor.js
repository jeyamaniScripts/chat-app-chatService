const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authInterceptor = (handler) => {
  return async (call, callback) => {
    try {
      const token = call.metadata.get("authorization")[0];

      if (!token) {
        return callback({ code: 16, message: "No token" });
      }

      const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);

      // 🔥 fetch real user from DB
      const user = await User.findById(decoded.id).select("_id name email");

      if (!user) {
        return callback({ code: 16, message: "User not found" });
      }

      call.user = user;   // ✅ now call.user._id exists

      handler(call, callback);
    } catch (err) {
      console.error("Auth error:", err);
      callback({ code: 16, message: "Auth failed" });
    }
  };
};

module.exports = authInterceptor;
