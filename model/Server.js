const mongoose = require("mongoose")
const { Schema, model } = mongoose;

const serverSchema = new Schema({
  serverid: Number,
  users: {
    type: Map,
    of: new Schema({
      typoCount : Number,
      messageCount: Number,
      typos: new Schema({
        content: String
      }, {timestamps: true})
    })
  },
  dictionary: [String]
}, {collection: "ServerData"})

const Server = model('ServerData', serverSchema);
module.exports = Server;