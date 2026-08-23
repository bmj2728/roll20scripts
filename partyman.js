/**
 {
 "_id":"-P-AIVJfkPml5hIy4Mv-",
 "_type":"character",
 "_charactersheetname":"dnd2024byroll20",
 "_defaulttoken":1787442649209,
 "name":"Kekha Stormleaper Kalukigane",
 "bio":"",
 "gmnotes":"",
 "archived":false,
 "inplayerjournals":"",
 "controlledby":"",
 "avatar":"https://files.d20.io/images/458531169/49_sa9ZCskB0z6MuMzWRPw/med.png?1759254875",
 "inParty":true,
 "tags":"[\"_roll20_internal_party_tag_\"]",
 "custom-attributes":{}
 }
 **/
const getParty = () => {
    return findObjs({ _type: "character", inParty: true })
}

const getPartyMembers = () => {
    return getParty().map(char => new PartyMember(char))
}

class Party {
    constructor() {
        this.members = getPartyMembers ()

        for (let member of this.members) {
            member.syncDefaultToken()
        }
    }
}

class PartyMember {
    constructor(char) {
        this.id = char.get("_id")
        this.characterSheet = char.get("_charactersheetname")
        this.characterName = char.get("name")
        this.controlledBy = char.get("controlledby")
        this.avatar = char.get("avatar")
        this.defaultToken = {}

    }

    async syncDefaultToken() {
        return await getObj("character", this.id).get("_defaulttoken", (_defaulttoken) => {
            this.token = _defaulttoken
        })
    }
}

on('ready', async () => {
    log("Starting PartyMan")

    // Define button styling inside the HTML string

    let command = "!pm party"
    let commandName = "Display Party"

    let style = "background-color: #7e22ce; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; font-weight: bold;";

    let htmlButton = `<a style="${style}" href="${command}">${commandName}</a>`;

    sendChat('PartyMan', "PartyMan HTML:\n" + htmlButton)

    let markdownButton = `[${commandName}](${command})`

    sendChat('PartyMan', "PartyMan MD:\n" + markdownButton)

    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!pm\b/i.test(msg.content)) return;

        const [, cmd] = msg.content.split(/\s+/);
        if (cmd === undefined) {
            sendChat('PartyMan', "Invalid command")
            return
        };

        if (cmd === 'party') {
            new Party().members.forEach(c => {
                sendChat('PartyMan', `Party Member:\n ${c.characterName}\n`)
            })
        }
    });
});