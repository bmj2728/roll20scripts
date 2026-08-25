//PartyMan - classes and utility for party management in Roll20 VTT
// Requires ChatCards (THEME, Card) for chat output.
on('ready', async () => {
    log("Starting PartyMan")

    // The sync is the slow part, and it is awaited before the card goes out —
    // so the card appearing in chat IS the readiness signal: cache warm, every
    // script built on PartyMan can now read party data with zero sheet traffic.
    const party = await PartyMan.refreshParty()
    log(`PartyMan ready — ${party.members.length} member(s) synced`)

    let htmlButton = `<div style="text-align: center;">${ChatCards.Card.button("Display Party", "!pm party")}</div>`;

    const initCard = new ChatCards.Card("PartyMan Ready")
    initCard.addRow({
        content: `<div style="text-align:center;">${party.members.length} party member(s) synced</div>`,
        style: "muted"
    })
    initCard.addRow(htmlButton)
    initCard.send('PartyMan')

    let resyncQueued = false
    on("change:character", async (obj, prev) => {
        if (obj.get("inParty") || obj.get("inParty") !== prev.inParty) {
            if (resyncQueued) return
            resyncQueued = true
            setTimeout(async () => {
                resyncQueued = false
                const fresh = await PartyMan.refreshParty()
                sendChat('PartyMan', `/w gm Party re-synced — ${fresh.members.length} member(s).`)
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
            for (const member of (await PartyMan.getSyncedParty()).members) {
                card.addRow(...PartyMan.memberCells(member, 'lg'))
                card.addRow(member.abilityScores.abilityScoreCells(2))
            }
            card.send('PartyMan')
        }

        if (cmd === 'refresh') {
            const party = await PartyMan.refreshParty()
            sendChat('PartyMan', `/w gm Party re-synced — ${party.members.length} member(s).`)
        }
    });
});

/**
 * PartyMan namespace. The IIFE keeps helpers private and exposes a single
 * global, so downstream scripts (Passive Check, PartyFund, ...) reference
 * everything as `PartyMan.<thing>` and cannot collide with other sandbox
 * scripts' globals.
 *
 * Also the home of the shared skill vocabulary (SKILLS, normalizeSkill,
 * skillDisplayName): the same `<skill>_bonus` drives passive scores and active
 * rolls, so it belongs to the party layer rather than to any one check script.
 *
 * @namespace PartyMan
 * @property {string[]} SKILLS - The 18 skills, as the 2024 sheet names them
 * @property {number} PASSIVE_BASE - The 10 in `passive = 10 + bonus`
 * @property {Function} normalizeSkill - User input -> a SKILLS entry
 * @property {Function} isSkill - Whether a string names a supported skill
 * @property {Function} skillDisplayName - 'sleight_of_hand' -> 'Sleight of Hand'
 * @property {Function} modText - 5 -> '+5'
 * @property {Function} getParty - Raw party character objects
 * @property {Function} getMembers - Party characters wrapped as Member instances (unsynced)
 * @property {Function} getSyncedParty - The cached, sheet-synced Party (syncs if cold)
 * @property {Function} getCachedParty - The cached Party, or null before first sync
 * @property {Function} refreshParty - Re-sync from the sheets and replace the cache
 * @property {Function} memberCells - Avatar + name cells for a ChatCards.Card row
 * @property {Class} Member - Snapshot of one party character
 * @property {Class} MemberAbilityScores - One member's six ability scores
 * @property {Class} MemberSkills - One member's cached skill bonuses
 * @property {Class} Party - The member collection
 */
const PartyMan = (() => {

    /*
    ***********************************************************************************
    ******************************Skill vocabulary*************************************
    ***********************************************************************************
    */

    /**
     * The 18 skills, as the 2024 sheet names them. The sheet exposes every skill
     * bonus as `<skill>_bonus`, so the attribute is derived rather than mapped.
     *
     * This lives in PartyMan rather than in either check script because it is
     * party vocabulary, not passive-specific or active-specific: the same bonus
     * drives a passive score (10 + bonus) and an active roll (d20 + bonus).
     */
    const SKILLS = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
        'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
        'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival']

    /** The 10 a passive score is built on: passive = PASSIVE_BASE + skill bonus. */
    const PASSIVE_BASE = 10

    /**
     * Normalizes user input to a SKILLS entry: case-insensitive, and spaces or
     * hyphens become underscores, so "Animal Handling" and "sleight-of-hand"
     * both resolve. Keeps macro dropdown labels friendly.
     *
     * @param {string} input
     * @returns {string}
     */
    const normalizeSkill = (input) => input.toLowerCase().replace(/[\s-]+/g, '_')

    /**
     * True when a string names a supported skill, in any casing/spacing.
     *
     * @param {string} input
     * @returns {boolean}
     */
    const isSkill = (input) => SKILLS.includes(normalizeSkill(input))

    /**
     * Renders a skill key for display: 'sleight_of_hand' -> 'Sleight of Hand'.
     *
     * @param {string} skill - A SKILLS entry.
     * @returns {string}
     */
    const skillDisplayName = (skill) => skill
        .split('_')
        .map((word, i) => (i > 0 && word === 'of') ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    /**
     * Formats a modifier as sheet-style text: '+5', '-1', '+0'.
     *
     * @param {number} mod
     * @returns {string}
     */
    const modText = (mod) => mod >= 0 ? `+${mod}` : `${mod}`

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
     * One member's skill bonuses, cached from the sheet.
     *
     * The cached bonus serves both check styles: a passive score is
     * `PASSIVE_BASE + bonus`, an active roll is `d20 + bonus`. Scripts that
     * read from here do zero sheet traffic per check.
     */
    class MemberSkills {
        constructor(charId) {
            this.member = charId
            this.skills = {}
        }

        /**
         * Loads every skill bonus from the sheet concurrently.
         *
         * A skill the sheet has no usable value for is stored as null rather
         * than NaN, so callers can distinguish "no such attribute" from a
         * legitimate +0.
         *
         * @returns {Promise<MemberSkills>} this, once populated.
         */
        async syncSkills() {
            const values = await Promise.all(
                SKILLS.map(skill => getSheetItem(this.member, `${skill}_bonus`))
            )
            SKILLS.forEach((skill, i) => {
                const n = Number(values[i])
                this.skills[skill] = Number.isNaN(n) ? null : n
            })
            return this
        }

        /**
         * The cached bonus for a skill, or null if the sheet had no usable value.
         *
         * @param {string} skill - Any casing/spacing of a SKILLS entry.
         * @returns {number|null}
         */
        getMod(skill) {
            const key = normalizeSkill(skill)
            return this.skills[key] === undefined ? null : this.skills[key]
        }

        /**
         * The cached bonus as sheet-style text ('+5'), or null if unavailable.
         *
         * @param {string} skill
         * @returns {string|null}
         */
        getModText(skill) {
            const mod = this.getMod(skill)
            return mod === null ? null : modText(mod)
        }

        /**
         * The passive score for a skill: PASSIVE_BASE + bonus.
         *
         * @param {string} skill
         * @returns {number|null} null when the sheet has no usable bonus.
         */
        getPassive(skill) {
            const mod = this.getMod(skill)
            return mod === null ? null : PASSIVE_BASE + mod
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
            this.skills = new MemberSkills(this.id)

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

        async syncSkills() {
            await this.skills.syncSkills()
        }

        /**
         * Loads everything this member caches from the sheet, concurrently.
         *
         * @returns {Promise<Member>} this, once populated.
         */
        async syncSheet() {
            await Promise.all([this.abilityScores.syncScores(), this.skills.syncSkills()])
            return this
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
         * Refreshes the member list and loads every member's sheet data —
         * ability scores and skill bonuses — concurrently across the whole
         * party (one await for everything, not one per member per dataset).
         *
         * This is the slow call by design: it takes the sheet-traffic hit once
         * at startup so every script built on PartyMan reads from memory.
         *
         * @returns {Promise<Party>} this, once every member is populated.
         */
        async syncParty() {
            this.members = getMembers()
            await Promise.all(this.members.map(member => member.syncSheet()))
            return this
        }

        /**
         * Finds a member of this party by character id.
         *
         * @param {string} charId
         * @returns {Member|undefined}
         */
        getMember(charId) {
            return this.members.find(m => m.id === charId)
        }
    }

    /*
    ***********************************************************************************
    ******************************The cached party*************************************
    ***********************************************************************************
    */

    /**
     * The synced party, cached in the namespace rather than in a handler
     * closure so every script built on PartyMan reads the same one.
     */
    let cachedParty = null

    /**
     * The party as last synced. Null before the first sync completes — prefer
     * getSyncedParty() unless you specifically want the cold-cache case.
     *
     * @returns {Party|null}
     */
    const getCachedParty = () => cachedParty

    /**
     * Re-syncs the party from the sheets and replaces the cache. This is the
     * expensive call; everything downstream reads the result from memory.
     *
     * @returns {Promise<Party>}
     */
    const refreshParty = async () => {
        cachedParty = await new Party().syncParty()
        return cachedParty
    }

    /**
     * The synced party, syncing on first use if the cache is cold. The safe
     * default for any script that needs party data:
     *
     *     const party = await PartyMan.getSyncedParty()
     *
     * @returns {Promise<Party>}
     */
    const getSyncedParty = async () => cachedParty || await refreshParty()

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

    return {
        SKILLS, PASSIVE_BASE, normalizeSkill, isSkill, skillDisplayName, modText,
        getParty, getMembers, memberCells,
        getCachedParty, refreshParty, getSyncedParty,
        Member, Party, MemberAbilityScores, MemberSkills
    }
})()
