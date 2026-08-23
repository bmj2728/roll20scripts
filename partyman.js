//PartyMan - classes and utility for party management in Roll20 VTT
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
        }

        if (cmd === 'party') {
            new Party().members.forEach(c => {
                sendChat('PartyMan', `Party Member:\n ${c.characterName}\n`)
            })
        }
    });
});

/*
***********************************************************************************
******************************Party & Party Member*********************************
***********************************************************************************
*/

/**
 * Retrieves a list of character objects that are part of the party.
 *
 * This function filters and returns all character objects with an `inParty` property set to `true`.
 *
 * @function
 * @returns {Object[]} An array of character objects currently marked as being in the party.
 */
const getParty = () => {
    return findObjs({ _type: "character", inParty: true })
}

/**
 * Retrieves the list of party members.
 *
 * This function fetches the current party by invoking the `getParty` function
 * and maps each character in the party to a `PartyMember` object.
 *
 * @function getPartyMembers
 * @returns {PartyMember[]} An array of `PartyMember` instances representing the current party members.
 */
const getPartyMembers = () => {
    return getParty().map(char => new PartyMember(char))
}

/**
 * Represents a Party, which is a collection of members.
 * Each member of the party is synchronized with its default token upon initialization.
 *
 * The class initializes by retrieving party members and invoking their syncDefaultToken method.
 */
class Party {
    constructor() {
        this.members = getPartyMembers ()

        for (let member of this.members) {
            member.syncDefaultToken()
        }
    }
}

/**
 * Represents a party member, holding information about their character sheet, name,
 * controlling player, avatar, and associated token data.
 */
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
            this.defaultToken = _defaulttoken
        })
    }
}

/*
***********************************************************************************
******************************Card Generation**************************************
***********************************************************************************
*/

