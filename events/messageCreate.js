const {Events} = require('discord.js');
var mongoose = require('mongoose')
    , Admin = mongoose.mongo.Admin;
const spell = require('spell-checker-js')
const Server = require('../model/Server.js')
const votesRequired = 1;
spell.load('en');

//callback function for if database can't connect
mongoose.connection.on('error', function (err) {
  console.error(err)
})
//callback function for if database connects successfully
mongoose.connection.on('connected', function() {
  console.log("mongoose connected successfully")
});
//connect to the database using private URI
mongoose.connect(process.env.MONGODB_URI)
//define callback function to return true only if reaction is a thumbs down
const collectorFilter = (reaction, user) => {
	return reaction.emoji.name === '👎';
};

//Helper function to load the current server's list of allowed words
async function getDictionary(guildid) {
  try {
  const result = await Server.findOne({serverid: guildid}, "dictionary");
  console.log("printing dictionary:")
  console.log(result.dictionary)
  //TODO: Add check for if specified server does not exist (and then create it with an empty dictionary)
  return result.dictionary;
  } catch (err) {
    console.error(err)
    return [];
  }
}

//helper function to filter out all allowed words from the typo list
async function filterWords(msg) {
  try {
  const dictionary = await getDictionary(msg.guild.id); //load dictionary into local array variable
  const check = spell.check(msg.content) //get all mispelled words according to spell-checker.js
    .filter((word) => !dictionary.includes(word));
  console.log(check)
  return check; //return final filtered list
  } catch (err) {
    console.error(err)
    return []
  }
}

module.exports = {
	name: Events.MessageCreate,
	once: false,
	async execute(message) { //upon every message being sent
    if (message.author.bot) return; //if that message is from this bot, ignore it
		console.log(`Someone sent a message! content: ${message.content}`); //log the message in the debug terminal
    try {
      //TODO: check if message.author.username is a user in the server's document, and if not, create them
      await Server.findOneAndUpdate({serverid : message.guild.id}, {$inc: {["users" + message.author.username]: 1}}) //increment that users message count by 1

      const check = await filterWords(message)

      console.log(check);
      if (check !== undefined && check.length != 0) {
        const messageContent = check.join(" ") + `\n-# If this message is an error, react with 👎. If enough people react, it will be deleted after 60 seconds. Votes required: ${votesRequired}`;
        message.channel.send({content: messageContent, reply: {fail_if_not_exists: false, messageReference: `${message.id}`}})
        .then((m) => {
          //TODO: Log typo in [serverid].users.[user].typos and update [serverid].users.[user].typoCount
          const collector = m.createReactionCollector({filter: collectorFilter, time: 60_000 }); //TODO: Make this timeout a config option

            collector.on('collect', (reaction, user) => {
              console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
              m.edit(check.join(" ") + `\n-# If this message is an error, react with 👎. If enough people react, it will be deleted after 60 seconds. Votes required: ${votesRequired - reaction.count}`);
              if (votesRequired <= reaction.count) {
                m.channel.send({content: "Appeal approved. Deleting message..."})
                .then( (m2) => {
                  m.delete()
                  m2.delete()
                  //TODO: For each typo, initiate a poll asking if that word should be added to the dictionary
                })
              }
            });

            collector.on('end', collected => {
              m.edit(check.join(" ")) //after collection ended, disallow reactions.
            });
        })
      }
    }catch (err) {
        console.error(err);
    }
	},
};