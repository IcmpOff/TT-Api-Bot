const tmp = require('tmp');
const { join } = require('path');
const fs = require('fs');
const Discord = require('discord.js');

function createAndSendTemp(msg, data, fileName) {
  tmp.file((err, path, fd, cleanupCallback) => {
    if (err) throw new Error(err);
    fs.writeFileSync(path, data);
    msg.channel.send(new Discord.MessageAttachment(path, fileName)).then(() => {
      cleanupCallback();
    });
  });
}

function useTemplate(template) {
  return fs.readFileSync(join(__dirname, 'templates', `${template}.hbs`)).toString();
}

function msToTime(s) {
  var ms = s % 1000;
  s = (s - ms) / 1000;
  var secs = s % 60;
  s = (s - secs) / 60;
  var mins = s % 60;
  var hrs = (s - mins) / 60;

  return hrs + ':' + mins + ':' + secs + '.' + ms;
}

function addCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  createAndSendTemp,
  useTemplate,
  msToTime,
  addCommas
};