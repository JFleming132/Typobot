const {Events } = require('discord.js');
const spell = require('spell-checker-js')
const votesRequired = 1;
const fs = require("fs");
spell.load('en');
var textByLine;
fs.readFile("./appealed-words.txt", "utf-8", (err, data) => {//TODO: Migrate words to a database
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
  if (data != undefined) {
    textByLine = data.split("\n");
  }
});

const collectorFilter = (reaction, user) => {
	return reaction.emoji.name === '👎';
};



module.exports = {
	name: Events.MessageCreate,
	once: false,
	execute(message) {
    if (message.author.bot) return;
    console.log(textByLine)
		console.log(`Someone sent a message! content: ${message.content}`);

    //update [serverid].users.[user].messageCount

    var unfilteredCheck = spell.check(message.content);
    const check = unfilteredCheck.filter((word, i, arr) => { //TODO: check words against [serverid].dictionary instead
      return !textByLine.includes(word);
    });
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
	},
};