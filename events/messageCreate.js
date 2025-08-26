const {Events, ActionRowBuilder, ButtonBuilder, ComponentType, MessageFlags} = require('discord.js');
var mongoose = require('mongoose')
    , Admin = mongoose.mongo.Admin;
const spell = require('spell-checker-js')
const Server = require('../model/Server.js')
const votesRequired = 1;
spell.load('en');
var voteTracker = {};

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
    // console.log("printing dictionary:") //debug message
    // console.log(result.dictionary) //debug message
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
    .filter((word) => !dictionary.includes(word)); //filter out all the words that are in the dictionary
  //console.log(check) //debug message
  return check; //return final filtered list
  } catch (err) {
    console.error(err)
    return []
  }
}

module.exports = {
	name: Events.MessageCreate, //what kind of event does this module describe?
	once: false, //should it run only once or many times?
	async execute(message) { //execute on ever event of this kind (message being sent)
    if (message.author.bot) return; //if message is from a bot, ignore it
		console.log(`Someone sent a message! content: ${message.content}`); //log the message in the debug terminal
    try {
      //TODO: check if message.author.username is a user in the server's document, and if not, create them
      await Server.findOneAndUpdate({serverid : message.guild.id}, {$inc: {["users" + message.author.username]: 1}}) //increment author's message count by 1
      const check = await filterWords(message) //remove all words that aren't typos or that are explicitely allowed
      //console.log(check); //debug message
      if (check !== undefined && check.length != 0) { //if, after filtering, there are still typos
        const messageContent = check.join(" ") + `\n-# If this message is an error, react with 👎. If enough people react, it will be deleted after 60 seconds. Votes required: ${votesRequired}`;
        message.channel.send({content: messageContent, reply: {fail_if_not_exists: false, messageReference: `${message.id}`}}) //send the message built above
        .then((m) => { //once the message is confirmed sent (promise fulfilled)
          //TODO: Log typo in [serverid].users.[user].typos and update [serverid].users.[user].typoCount
          const collector = m.createReactionCollector({filter: collectorFilter, time: 60_000 }); //TODO: Make this timeout a config option
          //for 60 seconds, collect reactions on the bots message
          collector.on('collect', (reaction, user) => { //upon receiving a reaction that passes the collectorFilter
            console.log(`Collected ${reaction.emoji.name} from ${user.tag}`); //debug message
            m.edit(check.join(" ") + `\n-# If this message is an error, react with 👎. If enough people react, it will be deleted after 60 seconds. Votes required: ${votesRequired - reaction.count}`);
            if (votesRequired <= reaction.count) { //if enough people have reacted with passing messages
              m.channel.send({content: "Appeal approved. Deleting message from database."}) //notify that the typo is being deleted
              .then( (m2) => { //once notification is confirmed sent
                for (word of check) {
                  
                  message.channel.send({
                    content: `is "${word}" a typo?`,
                    components: [
                      new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                          .setCustomId("typo")
                          .setLabel('Yes, this is a typo.')
                          .setStyle('Danger'),
                        new ButtonBuilder()
                          .setCustomId("notTypo")
                          .setLabel('No, this is not a typo.')
                          .setStyle('Success')
                      )
                    ]
                  }).then((pollMessage) => {
                    const pollCollector = pollMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: process.env.TYPO_VOTE_TIME});
                    voteTracker[pollMessage.id] = 0;
                    pollCollector.on("collect", pollCollected => {
                      console.log(pollCollected.user)
                      if (pollCollected.type === 3) {
                        if (pollCollected.customId === 'typo') {
                          voteTracker[pollMessage.id] = {...voteTracker[pollMessage.id], [pollCollected.user.id]: "Typo"};
                        } else if (pollCollected.customId === 'notTypo') {
                          voteTracker[pollMessage.id] = {...voteTracker[pollMessage.id], [pollCollected.user.id]: "Not a typo"};
                        }
                      }
                      pollCollected.reply({content: `You voted: ${voteTracker[pollMessage.id][pollCollected.user.id]}`, flags: MessageFlags.ephemeral})
                    })
                    pollCollector.on("end", pollCollected => {
                      //TODO: Tally votes from voteTracker, clear the relevant word from the object, and manage dictionary appropriately
                      pollMessage.delete()
                      console.log("poll ended")
                      console.log(pollCollected)
                      console.log(voteTracker)
                    })
                  })
                }
                //TODO: Reverse the logging of the typo in the users log
              })
            }
          });

          collector.on('end', collected => { //once the collection ends
            m.edit(check.join(" ")) //remove the footnote prompting the appeal vote
          }); 
        })
      }
    } catch (err) {
        console.error(err);
    }
	},
};