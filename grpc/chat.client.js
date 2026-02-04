const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "chat.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObject = grpc.loadPackageDefinition(packageDef);
const chatPackage = grpcObject.chat;

const client = new chatPackage.ChatService(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

module.exports = client;
