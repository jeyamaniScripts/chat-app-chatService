const Chat = require("../../models/chat.model");
const Message = require("../../models/message.model");
require("../../models/user.model");

const mongoose = require("mongoose");
const { getIO } = require("../../socket/socket");

/* ================= ACCESS 1-1 CHAT ================= */
const accessChatHandler = async (call, callback) => {
  try {
    const userId = call.user.id;
    const targetUserId = call.request.targetUserId;

    let chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [userId, targetUserId] },
    });

    let isNewChat = false;

    if (!chat) {
      chat = await Chat.create({
        chatName: "private",
        isGroupChat: false,
        users: [userId, targetUserId],
      });
      isNewChat = true;
    }

    const populatedChat = await Chat.findById(chat._id)
      .populate("users", "name email pic")
      .lean();

    const chatPayload = {
      chatId: populatedChat._id.toString(),
      chatName: "",
      isGroupChat: false,
      users: populatedChat.users.map((u) => ({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        pic: u.pic || "",
      })),
    };

    // 🔥 ONLY WHEN NEW CHAT
    if (isNewChat) {
      const io = getIO();
      populatedChat.users.forEach((u) => {
        io.to(u._id.toString()).emit("private_chat_created", chatPayload);
      });
    }

    callback(null, { ...chatPayload, message: "Chat ready" });
  } catch (err) {
    callback({ code: 13, message: err.message });
  }
};

/* ================= FETCH CHATS ================= */
const fetchChatsHandler = async (call, callback) => {
  try {
    const userId = call.user.id;

    const chats = await Chat.find({
      users: { $elemMatch: { $eq: userId } },
    })
      .populate("users", "name email pic")
      .sort({ updatedAt: -1 })
      .lean();

    const responseChats = chats.map((chat) => ({
      chatId: chat._id.toString(),
      chatName: chat.chatName || "",
      isGroupChat: chat.isGroupChat,
      unreadCount: chat.unreadCounts?.get
        ? chat.unreadCounts.get(userId.toString()) || 0
        : chat.unreadCounts?.[userId] || 0,
      users: chat.users.map((u) => ({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        pic: u.pic || "",
      })),
    }));

    callback(null, { chats: responseChats });
  } catch (err) {
    console.error("FetchChats error:", err);
    callback({ code: 13, message: err.message });
  }
};

/* ================= CREATE GROUP CHAT ================= */
const createGroupChatHandler = async (call, callback) => {
  try {
    const rawAdminId = call.user._id || call.user.id;

    if (!mongoose.Types.ObjectId.isValid(rawAdminId)) {
      return callback({ code: 3, message: "Invalid admin ID" });
    }

    const adminId = new mongoose.Types.ObjectId(rawAdminId);
    let { name, users } = call.request;

    if (!name) return callback({ code: 3, message: "Group name required" });

    // Convert users input
    if (typeof users === "string") {
      try {
        users = JSON.parse(users);
      } catch {
        users = users.split(",");
      }
    }

    if (!Array.isArray(users)) users = [users];

    users = users
      .map((id) => id.replace(/[^a-fA-F0-9]/g, ""))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (users.length < 2) {
      return callback({ code: 3, message: "At least 2 users required" });
    }

    const groupUsers = users.map((id) => new mongoose.Types.ObjectId(id));
    groupUsers.push(adminId);

    const groupChat = await Chat.create({
      chatName: name,
      isGroupChat: true,
      users: groupUsers,
      groupAdmin: adminId,
    });

    // 🔥 IMPORTANT FIX — re-fetch populated doc
    const fullGroup = await Chat.findById(groupChat._id)
      .populate("users", "name email pic")
      .populate("groupAdmin", "name email pic")
      .lean();

    callback(null, {
      chatId: fullGroup._id.toString(),
      chatName: fullGroup.chatName,
      isGroupChat: true,
      users: fullGroup.users.map((u) => ({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        pic: u.pic || "",
      })),
      message: "Group created",
    });
  } catch (err) {
    console.error("CreateGroupChat error:", err);
    callback({ code: 13, message: err.message });
  }
};

/* ================= SEND MESSAGE ================= */
const sendMessageHandler = async (call, callback) => {
  try {
    const senderId = call.user._id.toString();
    const { chatId, content } = call.request;
    console.log("🔥 gRPC sendMessageHandler HIT");

    const newMessage = await Message.create({
      sender: new mongoose.Types.ObjectId(senderId),
      content,
      chat: chatId,
    });
console.log("🔥 gRPC sendMessageHandler HIT");

    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: newMessage._id,
    });

    const chat = await Chat.findById(chatId).populate("users", "_id");
console.log("🔥 gRPC sendMessageHandler HIT");

    // ✅ INCREMENT UNREAD FOR ALL EXCEPT SENDER
    await Promise.all(
      chat.users.map((u) => {
        const uid = u._id.toString();
        if (uid !== senderId) {
          return Chat.updateOne(
            { _id: chatId },
            { $inc: { [`unreadCounts.${uid}`]: 1 } },
          );
        }
      }),
    );

    const messageData = {
      messageId: newMessage._id.toString(),
      chatId,
      senderId,
      content,
      createdAt: newMessage.createdAt.toISOString(),
    };

    const io = getIO();
    chat.users.forEach((u) => {
      io.to(u._id.toString()).emit("message received", messageData);
    });

    callback(null, messageData);
  } catch (err) {
    console.error("SendMessage error:", err);
    callback({ code: 13, message: err.message });
  }
};

const fetchMessagesHandler = async (call, callback) => {
  try {
    const { chatId } = call.request;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return callback({ code: 3, message: "Invalid chatId" });
    }

    const messages = await Message.find({
      chat: new mongoose.Types.ObjectId(chatId),
    })
      .sort({ createdAt: 1 })
      .lean();

    callback(null, {
      messages: messages.map((m) => ({
        messageId: m._id?.toString() || "",
        chatId: m.chat?.toString() || "",
        senderId: m.sender ? m.sender.toString() : "unknown", // 🔥 SAFE FIX
        content: m.content || "",
        createdAt: m.createdAt?.toISOString() || "",
      })),
    });
  } catch (err) {
    console.error("FetchMessages error:", err);
    callback({ code: 13, message: err.message });
  }
};

module.exports = {
  accessChatHandler,
  fetchChatsHandler,
  createGroupChatHandler,
  sendMessageHandler,
  fetchMessagesHandler,
};
