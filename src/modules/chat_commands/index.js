const moment = require('moment');
const twitch = require('../../utils/twitch');
const twitchAPI = require('../../utils/twitch-api');
const tmiAPI = require('../../utils/tmi-api');
const chat = require('../chat');
const anonChat = require('../anon_chat');

const CommandHelp = {
    b: 'Usage: "/b <login> [reason]" - Shortcut for /ban',
    chatters: 'Usage: "/chatters" - Retrieces the number of chatters in the chat',
    customcommands: 'Usage: "/customcommands" - Shows custom commands added to BTTV',
    followed: 'Usage: "/followed" - Tells you for how long you have been following a channel',
    follows: 'Usage: "/follows" - Retrieves the number of followers for the channel',
    join: 'Usage: "/join" - Temporarily join a chat (anon chat)',
    localascii: 'Usage "/localascii" - Turns on local ascii-only mode (only your chat is ascii-only mode)',
    localasciioff: 'Usage "/localasciioff" - Turns off local ascii-only mode',
    localmod: 'Usage "/localmod" - Turns on local mod-only mode (only your chat is mod-only mode)',
    localmodoff: 'Usage "/localmodoff" - Turns off local mod-only mode',
    localsub: 'Usage "/localsub" - Turns on local sub-only mode (only your chat is sub-only mode)',
    localsuboff: 'Usage "/localsuboff" - Turns off local sub-only mode',
    massunban: 'Usage "/massunban" - Unbans all users in the channel (channel owner only)',
    p: 'Usage "/p <login> [reason]" - Shortcut for /purge',
    part: 'Usage: "/part" - Temporarily leave a chat (anon chat)',
    purge: 'Usage "/purge <login> [reason]" - Purges a user\'s chat',
    shrug: 'Usage "/shrug" - Appends your chat line with a shrug face',
    sub: 'Usage "/sub" - Shortcut for /subscribers',
    suboff: 'Usage "/suboff" - Shortcut for /subscribersoff',
    t: 'Usage "/t <login> [duration] [reason]" - Shortcut for /timeout',
    u: 'Usage "/u <login>" - Shortcut for /unban',
    uptime: 'Usage "/uptime" - Retrieves the amount of time the channel has been live',
    viewers: 'Usage "/viewers" - Retrieves the number of viewers watching the channel'
};

const CustomCommands = {
    brainpower: 'Usage: "/brainpower [color or isAction]" - Sends the brainpower meme',
    colormode: 'Usage: "/colormode" - Turns on random coloring mode',
    colormodeoff: 'Usage: "/colormodeoff" - Turns off random coloring mode',
    actionmode: 'Usage: "/actionmode" - Turns on always action mode',
    actionmodeoff: 'Usage: "/actionmodeoff" - Turns off always action mode',
    print: 'Usage: "/print [color] [message]" - Sends a message in the specified color',
    pyramid: 'Usage: "/pyramid [size] [emote]" - Makes a pyramid of the given size and emote',
    rainbow: 'Usage: "/rainbow [message]" - Spams the given message in rainbow colors'
};

const colors = {'red': '#FF0000', 'orange': '#FF7F00', 'yellow': '#FFFF00', 'green': '#00FF00', 'blue': '#0000FF', 'purple': '#4B0082'};
const originalColor = '#DAA520';

let colorMode = false;
let actionMode = false;

function getHexColor(color) {
    if (color.match('^[#][0-9A-Fa-f]{6}$')) {
        return color;
    } else if (colors[color]) {
        return colors[color];
    }
    
    return null;
}

function secondsToLength(s) {
    const days = Math.floor(s / 86400);
    const hours = Math.floor(s / 3600) - (days * 24);
    const minutes = Math.floor(s / 60) - (days * 1440) - (hours * 60);
    const seconds = s - (days * 86400) - (hours * 3600) - (minutes * 60);

    return (days > 0 ? days + ' day' + (days === 1 ? '' : 's') + ', ' : '') +
           (hours > 0 ? hours + ' hour' + (hours === 1 ? '' : 's') + ', ' : '') +
           (minutes > 0 ? minutes + ' minute' + (minutes === 1 ? '' : 's') + ', ' : '') +
           seconds + ' second' + (seconds === 1 ? '' : 's');
}

function massUnban() {
    const currentUser = twitch.getCurrentUser();
    const currentChannel = twitch.getCurrentChannel();
    if (!currentUser || currentUser.id !== currentChannel.id) {
        twitch.sendChatAdminMessage('You must be the channel owner to use this command.');
        return;
    }

    // some users can fail to be unbanned, so store unbanned names to prevent infinite loop
    const unbannedChatters = [];
    let unbanCount = 0;

    function unbanChatters(users, callback) {
        const interval = setInterval(() => {
            const user = users.shift();

            if (!user) {
                clearInterval(interval);
                callback();
                return;
            }
            unbannedChatters.push(user);
            twitch.sendChatMessage(`/unban ${user}`);
        }, 333);
    }

    function getBannedChatters() {
        twitch.sendChatAdminMessage('Fetching banned users...');

        const query = `
            query Settings_ChannelChat_BannedChatters {
                currentUser {
                    bannedUsers {
                        bannedUser {
                            login
                        }
                    }
                }
            }
        `;

        twitchAPI.graphqlQuery(query).then(({data: {currentUser: {bannedUsers}}}) => {
            const users = bannedUsers
                .map(({bannedUser: {login}}) => login)
                .filter(login => login && !unbannedChatters.includes(login));

            if (users.length === 0) {
                twitch.sendChatAdminMessage(`You have no banned users. Total Unbanned Users: ${unbanCount}`);
                return;
            }

            unbanCount += users.length;
            twitch.sendChatAdminMessage(`Starting purge of ${users.length} users in 5 seconds.`);
            twitch.sendChatAdminMessage(`This block of users will take ${(users.length / 3).toFixed(1)} seconds to unban.`);
            setTimeout(() => (
                unbanChatters(users, () => {
                    twitch.sendChatAdminMessage('This block of users has been purged. Checking for more..');
                    getBannedChatters();
                })
            ), 5000);
        });
    }

    getBannedChatters();
}

function isModeratorOrHigher() {
    return twitch.getCurrentUserIsModerator() || twitch.getCurrentUserIsOwner();
}

function getTimeBetweenMessages() {
    return isModeratorOrHigher() ? 100 : 1500;
}

function handleCommands(message) {
    const messageParts = message.trim().split(' ');

    let command = messageParts.shift().toLowerCase();
    if (!command || command.charAt(0) !== '/') {
        if (colorMode || actionMode) {
            let color = null;
            let prefix = "";
            if (colorMode) {
                color = '#' + Math.random().toString(16).slice(2, 8).toUpperCase();
            }
            if (actionMode) {
                prefix = "/me "
            }
            
            if (color) {
                twitch.sendChatMessage(`/color ${color}`);
            }
            
            return prefix + message;
        }
        
        return true;
    }
    command = command.slice(1);

    const channel = twitch.getCurrentChannel();

    switch (command) {
        // moderation command shortcuts
        case 'b':
            return `/ban ${messageParts.join(' ')}`;
        case 'p':
        case 'purge':
            return `/timeout ${messageParts.shift()} 1 ${messageParts.join(' ')}`;
        case 'sub':
            return '/subscribers';
        case 'suboff':
            return '/subscribersoff';
        case 't':
            return `/timeout ${messageParts.join(' ')}`;
        case 'u':
        case 'unban':
            const user = messageParts.shift() || '';
            if (user !== 'all') {
                return `/unban ${user}`;
            }
        case 'massunban': // eslint-disable-line no-fallthrough
        case 'unbanall':
            massUnban();
            break;

        // filtering
        case 'localascii':
        case 'localasciioff':
            const asciiOnly = !command.endsWith('off');
            chat.asciiOnly(asciiOnly);
            twitch.sendChatAdminMessage(`Local ascii-only mode ${asciiOnly ? 'enabled' : 'disabled'}.`);
            break;
        case 'localmod':
        case 'localmodoff':
            const modsOnly = !command.endsWith('off');
            chat.modsOnly(modsOnly);
            twitch.sendChatAdminMessage(`Local mods-only mode ${modsOnly ? 'enabled' : 'disabled'}.`);
            break;
        case 'localsub':
        case 'localsuboff':
            const subsOnly = !command.endsWith('off');
            chat.subsOnly(subsOnly);
            twitch.sendChatAdminMessage(`Local subs-only mode ${subsOnly ? 'enabled' : 'disabled'}.`);
            break;

        // fun
        case 'shrug':
            return `${messageParts.join(' ')} ¯\\_(ツ)_/¯`;
        case 'squishy':
            return 'notsquishY WHEN YOU NEED HIM notsquishY IN A JIFFY notsquishY USE THIS EMOTE notsquishY TO SUMMON SQUISHY notsquishY';

        // misc
        case 'join':
        case 'part':
            command === 'join' ? anonChat.join() : anonChat.part();
            break;

        case 'chatters':
            tmiAPI.get(`group/user/${channel.name}/chatters`)
                .then(({chatter_count: chatterCount}) => twitch.sendChatAdminMessage(`Current Chatters: ${chatterCount.toLocaleString()}`))
                .catch(() => twitch.sendChatAdminMessage('Could not fetch chatter count.'));
            break;
        case 'followed':
            const currentUser = twitch.getCurrentUser();
            if (!currentUser) break;
            twitchAPI.get(`users/${currentUser.id}/follows/channels/${channel.id}`)
                .then(({created_at: createdAt}) => {
                    const since = moment(createdAt);
                    twitch.sendChatAdminMessage(`You followed ${channel.displayName} ${since.fromNow()} (${since.format('LLL')})`);
                })
                .catch(() => twitch.sendChatAdminMessage(`You do not follow ${channel.displayName}.`));
            break;
        case 'follows':
            twitchAPI.get(`channels/${channel.id}`)
                .then(({followers}) => twitch.sendChatAdminMessage(`Current Followers: ${followers.toLocaleString()}`))
                .catch(() => twitch.sendChatAdminMessage('Could not fetch follower count.'));
            break;
        case 'viewers':
            twitchAPI.get(`streams/${channel.id}`)
                .then(({stream}) => {
                    const viewers = stream ? stream.viewers : 0;
                    twitch.sendChatAdminMessage(`Current Viewers: ${viewers.toLocaleString()}`);
                })
                .catch(() => twitch.sendChatAdminMessage('Could not fetch stream.'));
            break;
        case 'uptime':
            twitchAPI.get(`streams/${channel.id}`)
                .then(({stream}) => {
                    const startedTime = stream ? new Date(stream.created_at) : null;
                    if (!startedTime) {
                        twitch.sendChatAdminMessage('Stream is not live');
                        return;
                    }

                    const secondsSince = Math.round((Date.now() - startedTime.getTime()) / 1000);
                    twitch.sendChatAdminMessage(`Current Uptime: ${secondsToLength(secondsSince)}`);
                })
                .catch(() => twitch.sendChatAdminMessage('Could not fetch stream.'));
            break;

        // custom commands
        case 'brainpower':
            let brainpowerMessage = 'O-oooooooooo AAAAE-A-A-I-A-U- JO-oooooooooooo AAE-O-A-A-U-U-A- E-eee-ee-eee AAAAE-A-E-I-E-A-JO-ooo-oo-oo-oo EEEEO-A-AAA-AAAA';
        
            if (messageParts && messageParts.length) {
                if (messageParts[0] == 'true' || messageParts[0] == '1' || messageParts[0] == 'me') {
                    return '/me ' + brainpowerMessage;
                }
                
                let color = getHexColor(messageParts[0]);

                if (color != null) {
                    twitch.sendChatMessage(`/color ${color}`);
                    setTimeout(function() {
                        twitch.sendChatMessage('/me ' + brainpowerMessage);
                        setTimeout(function() {
                            twitch.sendChatMessage(`/color ${originalColor}`);
                        }, 150);
                    }, 150);
                    break;                   
                }
            }
            return brainpowerMessage;
        case 'colormode':
        case 'colormodeoff':
            colorMode = !command.endsWith('off');
            twitch.sendChatAdminMessage(`Color mode ${colorMode ? 'enabled' : 'disabled'}.`);
            if (!colorMode) {
                twitch.sendChatMessage(`/color ${originalColor}`);
            }
            break;
        case 'actionmode':
        case 'actionmodeoff':
            actionMode = !command.endsWith('off');
            twitch.sendChatAdminMessage(`Action mode ${actionMode ? 'enabled' : 'disabled'}.`);
            break;
        case 'print':
            if (!messageParts || messageParts.length < 2 || !getHexColor(messageParts[0])) {
                twitch.sendChatAdminMessage('Example usage: /print blue Helloooo I am great');
                break;
            }
            
            let tempArray = messageParts;
            let color = getHexColor(tempArray.shift());
            let message = tempArray.join(' ');
            
            twitch.sendChatMessage(`/color ${color}`);
            setTimeout(function() {
                twitch.sendChatMessage('/me ' + message);
                setTimeout(function() {
                    twitch.sendChatMessage(`/color ${originalColor}`);
                }, 150);
            }, 150);
            break;
        case 'pyramid':
            let size = 0;
            let emote = '';

            if (!messageParts || messageParts.length !== 2) {
                twitch.sendChatAdminMessage('Example usage: /pyramid 3 PogChamp');
                break;
            }

            [size, emote] = messageParts;

            if (size < 2) {
                twitch.sendChatAdminMessage('Pyramid can\'t be smaller than 2 emotes');
                break;
            }

            for (let i = 1; i < (size * 2); i++) {
                let n = (i > size) ? (size * 2) - i : i;
                
                setTimeout(function(n, emote) {
                    twitch.sendChatMessage((emote + ' ').repeat(n));
                }, ((i - 1) * getTimeBetweenMessages()), n, emote);
            }
            break;
        case 'rainbow':
            if (!messageParts || !messageParts.length) {
                twitch.sendChatAdminMessage('Example usage: /rainbow SUB HYPE');
                break;
            }
            
            const time1 = isModeratorOrHigher() ? 150 : 1050;
            const time2 = isModeratorOrHigher() ? 300 : 1200;
            const extramessage = isModeratorOrHigher() ? "" : "⠀";
            
            let i = 0;
            
            for (let key in colors) {
                if (colors.hasOwnProperty(key)) {
                    setTimeout(function(i, color) {
                        twitch.sendChatMessage(`/color ${color}`);
                        setTimeout(function(i) {
                            twitch.sendChatMessage(`/me ${messageParts.join(' ')}` + extramessage.repeat(i));
                        }, time1, i);
                    }, i * time2, i, colors[key]);
                    i++;
                }
            }
            
            setTimeout(_ => {
                twitch.sendChatMessage(`/color ${originalColor}`);
            }, i * time2);
            break;
        
        case 'customcommands':
            const customCommandNames = Object.keys(CustomCommands);
            const customSubCommand = messageParts.length && messageParts[0].replace(/^\//, '').toLowerCase();
            if (customSubCommand && customCommandNames.includes(customSubCommand)) {
                twitch.sendChatAdminMessage(CustomCommands[customSubCommand]);
            } else if (!customSubCommand) {
                twitch.sendChatAdminMessage(`Custom Chat Commands: (Use "/customcommands <command>" for more info on a command) /${customCommandNames.join(' /')}`);
            }
            break;
            
        case 'help':
            const commandNames = Object.keys(CommandHelp);
            const subCommand = messageParts.length && messageParts[0].replace(/^\//, '').toLowerCase();
            if (subCommand && commandNames.includes(subCommand)) {
                twitch.sendChatAdminMessage(CommandHelp[subCommand]);
                return false;
            } else if (!subCommand) {
                twitch.sendChatAdminMessage(`BetterTTV Chat Commands: (Use "/help <command>" for more info on a command) /${commandNames.join(' /')}`);
                twitch.sendChatAdminMessage(`Custom Chat Commands: (Use "/customcommands <command>" for more info on a command) /${Object.keys(CustomCommands).join(' /')}`);
            }
            return true;

        default:
            return true;
    }

    return false;
}

class ChatCommandsModule {
    constructor() {}

    onSendMessage(sendState) {
        const result = handleCommands(sendState.message);
        if (result === false) {
            sendState.preventDefault();
        }

        if (typeof result === 'string') {
            sendState.message = result;
        }
    }
}

module.exports = new ChatCommandsModule();
