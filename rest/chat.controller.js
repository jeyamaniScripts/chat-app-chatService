const grpcClient = require("../grpc/chat.client");
const grpc = require("@grpc/grpc-js");
const Message = require("../models/message.model"); // ✅ FIX
const Chat = require("../models/chat.model"); // ✅ FIX
const { getIO } = require("../socket/socket");

const getMetadata = (req) => {
  const metadata = new grpc.Metadata();
  metadata.add("authorization", req.headers.authorization);
  return metadata;
};

const accessChat = (req, res) => {
  const token = req.headers.authorization;

  const metadata = new grpc.Metadata();
  metadata.add("authorization", token);

  grpcClient.AccessChat(
    {
      targetUserId: req.body.userId,
    },
    metadata,
    (err, response) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json(response);
    },
  );
};

const fetchChats = (req, res) => {
  grpcClient.FetchChats({}, getMetadata(req), (err, response) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(response);
  });
};

const createGroupChat = async (req, res) => {
  try {
    const { name, users } = req.body; // users = array of userIds

    if (!name || !users || users.length < 2) {
      return res.status(400).json({ message: "Group needs at least 2 users" });
    }

    const allUsers = [...users, req.user._id];

    const groupChat = await Chat.create({
      chatName: name,
      isGroupChat: true,
      users: allUsers,
      groupAdmin: req.user._id,
    });

    const fullGroup = await Chat.findById(groupChat._id).populate("users");

    // 🔥 REALTIME EMIT TO ALL MEMBERS
    const io = getIO();

    fullGroup.users.forEach((user) => {
      io.to(user._id.toString()).emit("group_created", fullGroup);
    });

    res.status(201).json(fullGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// const sendMessage = async (req, res) => {
//   try {
//     const { chatId, content } = req.body;

//     const newMessage = await Message.create({
//       sender: req.user._id,
//       content,
//       chat: chatId,
//     });

//     await Chat.findByIdAndUpdate(chatId, {
//       latestMessage: newMessage._id,
//     });

//     const populatedMsg = await newMessage.populate("sender", "name _id");

//     const messageData = {
//       messageId: populatedMsg._id.toString(),
//       chatId,
//       senderId: populatedMsg.sender._id.toString(),
//       senderName: populatedMsg.sender.name,
//       content: populatedMsg.content,
//       createdAt: populatedMsg.createdAt,
//     };
// a
//     const io = getIO();

//     // 🔥 EMIT TO EACH USER ROOM (NOT CHAT ROOM)
//     const chat = await Chat.findById(chatId).populate("users", "_id");

//     chat.users.forEach((u) => {
//       io.to(u._id.toString()).emit("message received", messageData);
//     });

//     res.json(messageData);
//   } catch (err) {
//     console.error("SEND MESSAGE ERROR:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

const sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    const senderId = req.user._id.toString();

    const newMessage = await Message.create({
      sender: req.user._id,
      content,
      chat: chatId,
    });

    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: newMessage._id,
    });

    const chat = await Chat.findById(chatId).populate("users", "_id");

    // ✅ INCREMENT UNREAD FOR OTHERS
    await Promise.all(
      chat.users.map((u) => {
        if (u._id.toString() !== senderId) {
          return Chat.updateOne(
            { _id: chatId },
            { $inc: { [`unreadCounts.${u._id}`]: 1 } },
          );
        }
      }),
    );

    const populatedMsg = await newMessage.populate("sender", "name _id");

    const messageData = {
      messageId: populatedMsg._id.toString(),
      chatId,
      senderId: populatedMsg.sender._id.toString(),
      senderName: populatedMsg.sender.name,
      content: populatedMsg.content,
      createdAt: populatedMsg.createdAt,
    };

    const io = getIO();
    chat.users.forEach((u) => {
      io.to(u._id.toString()).emit("message received", messageData);
    });

    res.json(messageData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const fetchMessages = (req, res) => {
  grpcClient.FetchMessages(
    { chatId: req.params.chatId },
    getMetadata(req),
    (err, response) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(response);
    },
  );
};
module.exports = {
  accessChat,
  fetchChats,
  fetchMessages,
  createGroupChat,
  sendMessage,
};
