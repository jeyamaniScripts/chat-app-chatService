const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const authInterceptor = require("./auth.interceptor");
const {
  accessChatHandler,
  fetchChatsHandler,
  createGroupChatHandler,
  sendMessageHandler,
  fetchMessagesHandler,
} = require("./handlers/chat.handler");

const PROTO_PATH = path.join(__dirname, "chat.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObject = grpc.loadPackageDefinition(packageDef);
const chatPackage = grpcObject.chat;

const server = new grpc.Server();

server.addService(chatPackage.ChatService.service, {
  AccessChat: authInterceptor(accessChatHandler),
  FetchChats: authInterceptor(fetchChatsHandler),
  CreateGroupChat: authInterceptor(createGroupChatHandler),
  SendMessage: authInterceptor(sendMessageHandler),
  FetchMessages: authInterceptor(fetchMessagesHandler),
});

const startGrpcServer = () => {
  const GRPC_PORT = process.env.GRPC_PORT || "0.0.0.0:50051";

  server.bindAsync(GRPC_PORT, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`gRPC server running on ${GRPC_PORT}`);
  });
};

module.exports = startGrpcServer;
