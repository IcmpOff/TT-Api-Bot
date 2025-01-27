require('dotenv').config();
const { addCommas, createAndSendTemp, msToTime, useTemplate, processErrorCode, getServer, sotdGen, getUser } = require('./utils');
const htmlToImage = require('node-html-to-image');
const Discord = require('discord.js');
const axios = require('axios');
//const bot = [];
var lastSOTD;

function sotdTimer(botArg) {
    if (botArg) bot.push(botArg);
    const date = new Date();
    try {
      (async () => {
        if (lastSOTD == date.getUTCDate()) return;
        if (date.getUTCHours() == 0 && date.getUTCMinutes() >= 10 && 
        date.getUTCMinutes() < 20) {
        bot[0].channels.cache.get(process.env.SOTDCHANNEL).send(await sotdGen());
        }
        lastSOTD = date.getUTCDate();
      })();
    }catch(err){console.log(err)}
    
    setTimeout(() => {
        sotdTimer();
        // modify the *5 for minutes
      }, ((1000 * 60) * 5) );
  }

const servers = [
    'http://server.tycoon.community:30120',
    'http://server.tycoon.community:30122',
    'http://server.tycoon.community:30123',
    'http://server.tycoon.community:30124',
    'http://server.tycoon.community:30125',
    'http://na.tycoon.community:30120',
    'http://na.tycoon.community:30122',
    'http://na.tycoon.community:30123',
    'http://na.tycoon.community:30124',
    'http://na.tycoon.community:30125',
  ];
  //What endpoints can take a user id?
  const userCapablePoints = [
    'wealth',
  ]

     async function commands(msg, bot) {
     var args = msg.content.toLowerCase().split(' ');
     const prefix = args.shift();
     if (prefix !== '-tt') return;

     // Process what specific command the user has typer, will determine path & processing
     if (args.length < 1) return;
 
     if (userCapablePoints.includes(args[0]) && !args[1]) args[1] = msg.author.id;
     const serverSelection = userCapablePoints.includes(args[0]) ? await getServer(args[1]) : await getServer();

     if (userCapablePoints.includes(args[0]) && !serverSelection) {
     msg.channel.send(`User not found`); return;
     } 
     else if (!serverSelection) {
     msg.channel.send(`Could not find an active server`); return;
     };
     //Tycoon Server Selection And Key
     const TT = axios.create({
     baseURL: serverSelection,
     headers: { 'X-Tycoon-Key': process.env.TYCOONTOKEN },
     timeout: 5000,
     });
     try {
     // Custom inventory command, exists outside of the default endpoint as arg section
     if (args[0] === 'inventory') {
        const { data: { data: { inventory } } } = await TT(`/status/dataadv/${args[1]}`);
        const items = [];

        Object.keys(inventory).forEach((itemId) => {
        items.push({
            name: inventory[itemId].name,
            amount: inventory[itemId].amount,
            weight: inventory[itemId].weight,
            stripped: inventory[itemId].name.replace(/(<([^>]+)>)/gi, ''),
            total: (inventory[itemId].weight * inventory[itemId].amount).toFixed(2)
        });
        });

        items.sort((a, b) => a.stripped.localeCompare(b.stripped));

        const rows = [];
        const rowLimit = 20;
        
        for (let i=0; i < items.length; i += rowLimit) {
        rows.push(items.slice(i, i + rowLimit));
        }
        
        const img = await htmlToImage({ 
        html: useTemplate('inventory'),
        content: {
            rows,
            userId: args[1],
            totalItems: items.length
        }
        });
        msg.channel.send(new Discord.MessageAttachment(img, `inventory-${args[1]}.png`));
        // Custom skills command
        } else if (args[0] === 'skills') {
        const { data: { data: { gaptitudes_v } } } = await TT(`/status/data/${args[1]}`);
        const skillArr = [];

        Object.keys(gaptitudes_v).forEach((cat) => {
        let data = {
            name: cat.charAt(0).toUpperCase() + cat.slice(1),
            skills: []
        };

        Object.keys(gaptitudes_v[cat]).forEach((skill) => {
            const skillLevel = Math.floor((Math.sqrt(1 + 8 * gaptitudes_v[cat][skill] / 5) - 1) / 2);
            data.skills.push({
            name: skill === 'skill' ? cat.charAt(0).toUpperCase() + cat.slice(1) : skill.charAt(0).toUpperCase() + skill.slice(1),
            level: skillLevel,
            maxLevel: skill === 'strength' ? '30' : '100'
            });
        });

        skillArr.push(data);
        });

        skillArr.sort((a, b) => a.skills.length - b.skills.length);

        const firstRow = [];
        const secondRow = [];
        skillArr.forEach((skill) => {
        if (firstRow.length < 5) {
            firstRow.push(skill);
        } else {
            secondRow.push(skill);
        }
        });

        const img = await htmlToImage({
        html: useTemplate('skills'), 
        content: {
            userId: args[1],
            firstRow,
            secondRow
        }
        });
        msg.channel.send(new Discord.MessageAttachment(img, `skills-${args[1]}.png`));
    
        //Logans Custom Server List
        } else if (args[0] === 'server') {
        if (!args[1] || Number.isNaN(parseInt(args[1]))) return msg.reply('Please enter a number from 1-10!');
        const srvId = parseInt(args[1]);

        try {
        const { data: serverData } = await axios(`${servers[srvId - 1]}/status/widget/players.json`);
        const playercount = serverData.players.length;

        if (serverData.players.length > 10) serverData.players.length = 10;

        const img = await htmlToImage({
            html: useTemplate('server'),
            content: {
            players: serverData.players,
            server: serverData.server,
            playercount,
            srvId,
            timeRemaining: serverData.server.dxp[0] ? msToTime(serverData.server.dxp[2]) : null
            }
        });

        msg.channel.send(new Discord.MessageAttachment(img, `server-${args[1]}.png`));
        } catch (e) {
        console.log(e);
        msg.reply('Uh oh, server seems unresponsive! ' + e);
        }

        //Custom Economy Viewer
        } else if (args[0] === 'economy') {
        const { data } = await TT('/status/economy.csv');
        const splitEconomy = data.split('\n');
        splitEconomy.pop();
        const shortData = splitEconomy.splice(splitEconomy.length - 20);

        const economyData = [];
        shortData.forEach((economy) => {
        let split = economy.split(';');
        economyData.push({
            time: new Date(split[0] * 1000).toLocaleString(),
            debt: addCommas(split[1]),
            money: addCommas(split[2]),
            debts: addCommas(split[3]),
            millionaires: addCommas(split[4]),
            billionaires: addCommas(split[5]),
            users: addCommas(split[6]),
            players: addCommas(split[7])
        });

        });

        const img = await htmlToImage({ 
        html: useTemplate('economy'),
        content: {
            economyData: economyData
        }
        });
        msg.channel.send(new Discord.MessageAttachment(img, 'economy.png'));

        //Elfshots Custom Backpack Inventory Viewer
        }
        else if (args[0] === 'backpack') {
        const { data: { data: inventory } } = await TT(`/status/chest/u${args[1]}backpack`);
        const items = [];

        Object.keys(inventory).forEach((itemId) => {
        items.push({
        name: itemId,
        amount: inventory[itemId].amount,
        stripped: itemId.replace(/(<([^>]+)>)/gi, ''),
        });
    });

    items.sort((a, b) => a.stripped.localeCompare(b.stripped));

    const rows = [];
    const rowLimit = 20;
    
    for (let i=0; i < items.length; i += rowLimit) {
        rows.push(items.slice(i, i + rowLimit));
    }
    
    const img = await htmlToImage({ 
        html: useTemplate('backpack'),
        content: {
        rows,
        userId: args[1],
        totalItems: items.length
        }
    });
    msg.channel.send(new Discord.MessageAttachment(img, `napsack-${args[1]}.png`));

    //custom command "SOTD"
} else if (args[0] === 'sotd') {
    msg.channel.send(await sotdGen());
    console.log(data);
   //custom embed "Wealth"
} else if (args[0] === 'wealth') {
    try {
        const dbdata = await getUser(args);
            if (!dbdata.vrpId && parseInt(args[1]) > 1000000) msg.channel.send("User not found");
            var { data } = await TT(`/status/wealth/${dbdata.vrpId ? dbdata.vrpId : args[1] }`);
        if (!data) return;
        if (data.code == '412') { msg.channel.send('User not online'); return; }
    let embed = new Discord.MessageEmbed()
    embed.setColor('#5B00C9')
    embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
    embed.setTitle(`**Wealth of** ${dbdata.userName}`)
    embed.setDescription(`**Wallet**: $${addCommas(data.wallet)}\n**Bank**: $${addCommas(data.bank)}`)
    if (discordAv) embed.setImage(dbdata.discordAv)
	embed.setFooter('( つ ◕_◕ )つ)', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
    embed.setTimestamp()
    msg.channel.send(embed);
    console.log(data);
    } catch(err) {
    console.log(err);
    msg.channel.send(err);
    }
    
    //custom embed "charges"
} else if (args[0] === 'charges') {
    const { data } = await TT(`/status/charges.json`);
    let embed = new Discord.MessageEmbed()
    embed.setColor('#5B00C9')
    embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
    embed.setTitle(`API Charges`)
    embed.setDescription(`**Charges Remaining**: ${addCommas(data)}`)
    embed.setFooter('( つ ◕_◕ )つ)', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
    embed.setTimestamp()
    msg.channel.send(embed);
    console.log(data);
 //Custom Whois Command using Elfshots DB
} else if (args[0] === 'whois') {
    //async function userProfile(msg, inputTaken, userId, discordId, userName) {
        try{
            if (!args[1]) args[1] = msg.author.id;
            const data = await getUser(args);  
            const inputTaken = data.inputTaken;
            const userId = data.vrpId;
            const userName = data.userName;
            var discordId = data.discordId;
            var discordAv;

            if (discordId != 'Not found') {
                await bot.users.fetch(discordId).then(myUser => {
                discordAv = myUser.avatarURL({format: 'png', dynamic: true, size: 128});
                });
                discordId = `<@${discordId}>`;
            }

            var embed = new Discord.MessageEmbed()
            embed.setTitle(`Profile of "${inputTaken}"`)
            //embed.setDescription('Something here')
            embed.addField('Name:', userName, true)
            embed.addField('In-game ID:', userId, true)
            //embed.addField('Last found:', lastFound) - will be added at a later date
            embed.addField('Discord:', discordId, false)
            if (discordAv) embed.setImage(discordAv)
            embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
            embed.setColor('RANDOM');
            embed.setTimestamp()
	        embed.setFooter('( つ ◕_◕ )つ)', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
            msg.channel.send(embed);
            console.log(data);
        } catch(e) {console.log(e); msg.channel.send("Error!")}
          
    //custom embed "Alive" 
} else if (args[0] === 'alive') {
    if (!args[1] || Number.isNaN(parseInt(args[1]))) return msg.reply('Please enter a number from 1-10!');
    const srvId = parseInt(args[1]);
    try {
    const { data } = await TT(`${servers[srvId - 1]}/status/alive`);
    let embed = new Discord.MessageEmbed()
        embed.setColor('05f415')
        embed.setTitle(`Status`)
        embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
        embed.setDescription(`${addCommas(data.description)}`)
        embed.setFooter('( つ ◕_◕ )つ)', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
        embed.setTimestamp()
        msg.channel.send(embed);
        console.log(data);
    } catch (e) {
        console.log(e);
        let embed = new Discord.MessageEmbed()
        embed.setColor('fb0303')
        embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
        embed.setTitle(`Status`)
        embed.setDescription(`${(e)}`)
        embed.setFooter('( つ ◕_◕ )つ)', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
        embed.setTimestamp()
        msg.channel.send(embed);
        console.log(data);
        }  
        //custom embed "Forecast" 
        } else if (args[0] === 'forecast') {
        if (!args[1] || Number.isNaN(parseInt(args[1]))) return msg.reply('Please enter a number from 1-10!');
        const srvId = parseInt(args[1]);
        try {
         const { data } = await TT(`${servers[srvId - 1]}/status/forecast.json`);
         let embed = new Discord.MessageEmbed()
         embed.setColor('#5B00C9')
         embed.setTitle(`Current Forecast`)
         embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
         embed.setDescription(`Weather Forecast: ${addCommas(data)}`)
         embed.setTimestamp()
         embed.setFooter('**BETA SERVER ONLY COMMAND**', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
         msg.channel.send(embed);
         console.log(data);
         } catch (e) {
         console.log(e);
         msg.reply('Uh oh, server seems unresponsive! ' + e);
         }
        //custom embed "Weather" 
        } else if (args[0] === 'weather') {
        if (!args[1] || Number.isNaN(parseInt(args[1]))) return msg.reply('Please enter a number from 1-10!');
        const srvId = parseInt(args[1]);
        try {
        const { data } = await TT(`${servers[srvId - 1]}/status/weather.json`);
        let embed = new Discord.MessageEmbed()
         embed.setColor('#5B00C9')
         embed.setTitle(`**Current Weather**`)
         embed.setAuthor('TT-Api-Bot', 'https://github.com/fluidicon.png',
                'https://github.com/gtaivmostwanted/TT-Api-Bot')
         embed.setDescription(`**${(data.weather)}**`)
         embed.setFooter('**BETA SERVER ONLY COMMAND**', 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png');
         embed.setTimestamp()
         msg.channel.send(embed);
         console.log(data);
         } catch (e) {
         console.log(e);
         msg.reply('Uh oh, server seems unresponsive! ' + e);
         } 
    //custom embed "Commands"
        } else if (args[0] === 'commands') {
            try {
            const commandsembed = {
                color: 1400250,
                author: {
                name: 'Tycoon Stats',
                url: 'http://discord.gg/3p2pQSxZRW',
                },
                description: 'Available Commands',
                thumbnail: {
                url: 'https://cdn.discordapp.com/avatars/826359426457534475/af4862c0f0dcb4daa3b163bbe805d08e.png',
                },
                fields: [
                {
                    name: 'Server [1~10]',
                    value: 'Show users in the selected server',
                    inline: false,
                },
                {
                    name: 'Economy',
                    value: 'Display the economy over the past few hours',
                    inline: false,
                },
                {
                    name: 'Charges',
                    value: 'Show the remaining API charges of the bot',
                    inline: false,
                },
                {
                    name: 'Wealth [vRp id]',
                    value: "Show the player's wealth while they are online",
                    inline: false,
                },
                {
                    name: 'Inventory [vRp id]',
                    value: "Show the selected player's inventory",
                    inline: false,
                },
                {
                    name: 'Backpack [vRp id]',
                    value: "Show the contents of the selected player's backpack",
                    inline: false,
                },
                {
                    name: 'Skills [vRp id]',
                    value: "Show the selected player's skills",
                    inline: false,
                },
                {
                    name: 'SOTD',
                    value: 'Show current Skill of The Day with bonus percentage',
                    inline: false,
                },
                {
                    name: 'Alive [1~10]',
                    value: 'Shows if the selected server is online',
                    inline: false,
                },
                {
                    name: 'WhoIs [vRp id or Discord id]',
                    value: "Show the selected player's information",
                    inline: false,
                },
                {
                    name: 'Weather [1~10]',
                    value: "Show the current weather on selected server",
                    inline: false,
                },
                {
                    name: 'Forecast [1~10]',
                    value: "Show the current forecast on selected server",
                    inline: false,
                },
                ],
            };
            msg.channel.send({ embed: commandsembed });
            } catch (e) {
            console.log(e);
            msg.channel.send('...' + e);
            }
            // Generic .json response shit
            } else {
            const response = await TT('/status/' + `${args[0]}${args[1] ? `/${args[1]}` : ''}`);
            const data = response.data;
            if (typeof data === 'object' || Array.isArray(data)) {
              createAndSendTemp(msg, JSON.stringify(data, null, 2), (args[0].includes('.json') ? args[0] : `${args[0]}.json`))
            }
          };
          } catch (err) {
          // Handling errors by returning statement to the message channel
          msg.channel.send(processErrorCode(err.response.data.code));
          // Can instead use the following line if you would rather not customise return values and use the Axios/Request returned message
          //msg.channel.send(err.response.data.error);
          console.log(err);
          }
      };
      
      module.exports = {
          commands,
          sotdTimer,
      }