const mongoose = require("mongoose")
const { Schema, model } = mongoose;

const typoSchema = new Schema({
  content: String
}, {
  timestamps: true
})

const userSchema = new Schema({
  typocount: Number,
  messageCount: Number,
  typos: [typoSchema]
})

const serverSchema = new Schema({
  serverid: Number,
  users: [userSchema],
  dictionary: [String]
})

const Server = model('Typo', serverSchema);
export default Server;