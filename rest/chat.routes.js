const Chat = require("../models/chat.model");

const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  sendMessage,
  fetchMessages,
} = require("./chat.controller");

router.post("/access", protect, accessChat);
router.get("/", protect, fetchChats);
router.post("/group", protect, createGroupChat);
router.post("/message", protect, sendMessage);
router.get("/message/:chatId", protect, fetchMessages);

router.put("/:chatId/read", protect, async (req, res) => {
  await Chat.updateOne(
    { _id: req.params.chatId },
    { $set: { [`unreadCounts.${req.user._id}`]: 0 } },
  );
  res.sendStatus(200);
});

module.exports = router;
