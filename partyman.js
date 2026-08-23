//PartyMan - classes and utility for party management in Roll20 VTT
// Requires ChatCards (THEME, Card) for chat output.
on('ready', async () => {
    log("Starting PartyMan")

    let command = "!pm party"
    let commandName = "Display Party"

    let htmlButton = `<a style="${ChatCards.THEME.button}" href="${command}">${commandName}</a>`;

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
            const card = new ChatCards.Card("Party Roster")
            for (const member of new PartyMan.Party().members) {
                card.addRow(...PartyMan.memberCells(member))
            }
            card.send('PartyMan')
        }
    });
});

/**
 * PartyMan namespace. The IIFE keeps helpers private and exposes a single
 * global, so downstream scripts (Passive Check, PartyFund, ...) reference
 * everything as `PartyMan.<thing>` and cannot collide with other sandbox
 * scripts' globals.
 *
 * @namespace PartyMan
 * @property {Function} getParty - Raw party character objects
 * @property {Function} getMembers - Party characters wrapped as Member instances
 * @property {Function} memberCells - Avatar + name cells for a ChatCards.Card row
 * @property {Class} Member - Snapshot of one party character
 * @property {Class} Party - The member collection
 */
const PartyMan = (() => {

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
     * and maps each character in the party to a `Member` object.
     *
     * @function getMembers
     * @returns {Member[]} An array of `Member` instances representing the current party members.
     */
    const getMembers = () => {
        return getParty().map(char => new Member(char))
    }

    /**
     * Represents a party member, holding information about their character sheet, name,
     * controlling player, avatar, and associated token data.
     */
    class Member {
        constructor(char) {
            this.id = char.get("_id")
            this.characterSheet = char.get("_charactersheetname")
            this.characterName = char.get("name")
            this.controlledBy = char.get("controlledby")
            this.avatar = char.get("avatar")
            this.defaultToken = {}
        }

        /**
         * Loads the character's default token blob (only available via callback)
         * into `this.defaultToken`.
         *
         * @returns {Promise<Object>} Resolves with the default token blob.
         */
        syncDefaultToken() {
            return new Promise(resolve => {
                getObj("character", this.id).get("_defaulttoken", (_defaulttoken) => {
                    this.defaultToken = _defaulttoken
                    resolve(_defaulttoken)
                })
            })
        }
    }

    /**
     * Represents a Party, which is a collection of members.
     * Each member of the party is synchronized with its default token upon initialization.
     *
     * The class initializes by retrieving party members and invoking their syncDefaultToken method.
     */
    class Party {
        constructor() {
            this.members = getMembers()

            for (let member of this.members) {
                member.syncDefaultToken()
            }
        }
    }

    /*
    ***********************************************************************************
    ******************************Card helpers*****************************************
    ***********************************************************************************
    */

    /**
     * The party-flavored row prefix for a ChatCards.Card: an avatar cell and a
     * name cell. Spread it into addRow, then append whatever the script needs:
     *
     *     card.addRow(...PartyMan.memberCells(pm), ChatCards.Card.num(score))
     *
     * References ChatCards only at call time, so script load order never matters.
     *
     * @param {Member} member
     * @returns {Array<string|{content: string, style: string}>} Cells for ChatCards.Card.addRow.
     */
    const memberCells = (member) => {
        return [
            {
                content: `<img src="${member.avatar}" style="${ChatCards.THEME.avatar}" alt="${member.characterName}">`,
                style: "avatarCell"
            },
            member.characterName
        ]
    }

    return { getParty, getMembers, Member, Party, memberCells }
})()
