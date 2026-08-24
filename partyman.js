//PartyMan - classes and utility for party management in Roll20 VTT
// Requires ChatCards (THEME, Card) for chat output.
on('ready', async () => {
    log("Starting PartyMan")

    let pmParty = await new PartyMan.Party().syncParty()

    let command = "!pm party"
    let commandName = "Display Party"

    let htmlButton = `<div style="text-align: center;"><a style="${ChatCards.THEME.button}" href="${command}">${commandName}</a></div>`;

    const initCard = new ChatCards.Card("Party Man")
    initCard.addRow(htmlButton)
    initCard.send('PartyMan')

    let resyncQueued = false
    on("change:character", async (obj, prev) => {
        if (obj.get("inParty") || obj.get("inParty") !== prev.inParty) {
            if (resyncQueued) return
            resyncQueued = true
            setTimeout(async () => {
                resyncQueued = false
                pmParty = await new PartyMan.Party().syncParty()
            }, 500)
        }
    })

    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!pm\b/i.test(msg.content)) return;

        const [, cmd] = msg.content.split(/\s+/);
        if (cmd === undefined) {
            sendChat('PartyMan', "Invalid command")
            return
        }

        if (cmd === 'party') {
            const card = new ChatCards.Card("Party Roster")
            for (const member of pmParty.members) {
                card.addRow(...PartyMan.memberCells(member, 'lg'))
                card.addRow(member.abilityScores.abilityScoreCells(2))
            }
            card.send('PartyMan')
        }

        if (cmd === 'refresh') {
            pmParty = await new PartyMan.Party().syncParty()
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

    class MemberAbilityScores {
        constructor(charId) {
            this.member = charId
            this.str = 0
            this.dex = 0
            this.con = 0
            this.int = 0
            this.wis = 0
            this.cha = 0
        }

        /**
         * Loads all six scores from the sheet concurrently. Awaiting Promise.all
         * (rather than firing a .then and returning) means callers that await
         * this are guaranteed the scores are populated afterwards.
         *
         * @returns {Promise<MemberAbilityScores>} this, once populated.
         */
        async syncScores() {
            const [str, dex, con, int, wis, cha] = await Promise.all([
                getSheetItem(this.member, "strength"),
                getSheetItem(this.member, "dexterity"),
                getSheetItem(this.member, "constitution"),
                getSheetItem(this.member, "intelligence"),
                getSheetItem(this.member, "wisdom"),
                getSheetItem(this.member, "charisma")
            ])
            this.str = str
            this.dex = dex
            this.con = con
            this.int = int
            this.wis = wis
            this.cha = cha
            return this
        };

        getAbilityMod(ability) {
            return Math.floor((this[ability] - 10) / 2)
        }

        /**
         * The modifier as sheet-style text: '+2', '-1', '+0'.
         *
         * @param {string} ability - 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
         * @returns {string}
         */
        getAbilityModText(ability) {
            const mod = this.getAbilityMod(ability)
            return mod >= 0 ? `+${mod}` : `${mod}`
        }

        /**
         * The six scores as a ChatCards tile strip: abbreviation over score
         * over modifier, character-sheet style. Returns one full-width cell —
         * pass the column count of the card's widest row so it spans cleanly:
         *
         *     card.addRow(member.abilityScores.abilityScoreCells(2))
         *
         * @param {number} [span=2] - Columns the strip should span.
         * @returns {{content: string, style: string, span: number}}
         */
        abilityScoreCells(span = 2) {
            const tiles = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => ({
                label: a.toUpperCase(),
                value: this[a],
                sub: this.getAbilityModText(a)
            }))
            return ChatCards.Card.span(ChatCards.Card.tiles(tiles), span, "padding:0;")
        }

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
            this.abilityScores = new MemberAbilityScores(this.id)

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

        async syncAbilityScores() {
            await this.abilityScores.syncScores()
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

        /**
         * Refreshes the member list and loads every member's scores
         * concurrently (one await for the whole party, not one per member).
         *
         * @returns {Promise<Party>} this, once every member is populated.
         */
        async syncParty() {
            this.members = getMembers()
            await Promise.all(this.members.map(member => member.abilityScores.syncScores()))
            return this
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
     * Two sizes: 'sm' (default) for dense data rows where the member is one of
     * many lines (Passive Check), 'lg' for rows acting as a section header
     * (the roster, where stat tiles sit underneath).
     *
     * References ChatCards only at call time, so script load order never matters.
     *
     * @param {Member} member
     * @param {string} [size='sm'] - 'sm' | 'lg'
     * @returns {Array<{content: string, style: string}>} Cells for ChatCards.Card.addRow.
     */
    const memberCells = (member, size = 'sm') => {
        const lg = size === 'lg'
        return [
            {
                content: `<img src="${member.avatar}" style="${lg ? ChatCards.THEME.avatarLg : ChatCards.THEME.avatar}" alt="${member.characterName}">`,
                style: lg ? "avatarCellLg" : "avatarCell"
            },
            {
                content: member.characterName,
                style: lg ? "nameLg" : "name"
            }
        ]
    }

    return { getParty, getMembers, Member, Party, memberCells, MemberAbilityScores }
})()
