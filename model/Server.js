const mongoose = require("mongoose")
const { Schema, model } = mongoose;

const typos = new Schema({
        content: String,
        messageId: String
      }, {timestamps: true}
    )

const users = new Schema({
      userid: Number,
      typoCount : Number,
      messageCount: Number,
      typos: [typos]
    })

const serverSchema = new Schema({
  serverid: Number,
  users: [users],
  dictionary: [String]
}, {collection: "ServerData"})

const Server = model('ServerData', serverSchema);
module.exports = Server;