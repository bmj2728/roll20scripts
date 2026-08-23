// PassiveCheck - whispers the party's passive skill scores (optionally vs a DC) to the GM
// usage: !pcheck insight (returns passive insight scores) / !pcheck perception 12 (with success/fail)
// Requires PartyMan (Party, Member, memberCells) and Cards (Card, THEME).
on('ready', () => {
    on('chat:message', async msg => {
        // process chat
        // start of line w/ word bound
        if (msg.type !== 'api' || !/^!pcheck\b/i.test(msg.content)) return;
        //split message on whitespace, drop the command itself
        const args = msg.content.trim().split(/\s+/).slice(1);
        const who = msg.who.replace(/ \(GM\)$/, '')
        const whisperBack = (text) => sendChat("Passive Check", `/w "${who}" ${text}`)

        // type guards
        if (args.length < 1) {
            whisperBack("Missing check type:\n" + PassiveCheck.helpText())
            return;
        }
        if (args[0].toLowerCase() === 'help') {
            whisperBack(PassiveCheck.helpText())
            return;
        }

        // Skills can be multi-word ("sleight of hand"), so match greedily first
        // and only then treat a trailing argument as the DC.
        let checkType, dc
        if (PassiveCheck.isValidType(args.join(' '))) {
            checkType = args.join(' ')
        } else if (args.length > 1 && PassiveCheck.isValidType(args.slice(0, -1).join(' '))) {
            checkType = args.slice(0, -1).join(' ')
            dc = args[args.length - 1]
        } else {
            whisperBack("Invalid check type:\n" + PassiveCheck.helpText())
            return;
        }

        let party = new PartyMan.Party()
        //party guard
        if (party.members.length < 1) {
            whisperBack("Party not found")
            return;
        }

        if (dc === undefined) {
            const card = await PassiveCheck.buildCard(party, checkType)
            card.whisperGM("Passive Check")
            return
        }

        const parsedDC = parseInt(dc)
        if (isNaN(parsedDC)) {
            whisperBack(`Invalid DC: ${dc}`)
            const card = await PassiveCheck.buildCard(party, checkType)
            card.whisperGM("Passive Check")
            return
        }

        const card = await PassiveCheck.buildCard(party, checkType, parsedDC)
        card.whisperGM("Passive Check")
    });
});

/**
 * PassiveCheck namespace. Exposes only what the chat handler needs; everything
 * else stays private to the IIFE.
 *
 * Rendering goes through Cards.Card, so output stays on-theme with every
 * other Cards-based tool.
 *
 * @namespace PassiveCheck
 * @property {Function} isValidType - Whether a string names a supported passive skill
 * @property {Function} buildCard - Builds the score card (verdict column when a DC is given)
 * @property {Function} helpText - Renders the help card
 */
const PassiveCheck = (() => {

    const BASE_VALUE = 10

    /**
     * Supported passive skills. The 2024 sheet names every skill bonus
     * consistently as `<skill>_bonus`, so the attribute is derived rather than
     * mapped — the guards, the help card and the sheet lookup all read from
     * this one list. The DMG allows a passive version of any skill.
     */
    const SKILLS = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
        'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
        'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival']

    /** Shown in place of a score the sheet couldn't supply. */
    const NO_SCORE = '—'

    /**
     * Normalizes user input to a SKILLS entry: case-insensitive, and spaces or
     * hyphens become underscores, so "Animal Handling" and "sleight-of-hand"
     * both resolve. Keeps macro dropdown labels friendly.
     *
     * @param {string} input
     * @returns {string}
     */
    const normalize = (input) => input.toLowerCase().replace(/[\s-]+/g, '_')

    const isValidType = (checkType) => SKILLS.includes(normalize(checkType))

    /**
     * Renders a skill key for display: 'sleight_of_hand' -> 'Sleight of Hand'.
     *
     * @param {string} skill - A SKILLS entry.
     * @returns {string}
     */
    const displayName = (skill) => skill
        .split('_')
        .map((word, i) => (i > 0 && word === 'of') ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    /**
     * Fetches one character's passive score for a skill.
     *
     * @param {string} charId
     * @param {string} skill - A SKILLS entry.
     * @returns {Promise<number|null>} 10 + the sheet's passive bonus, or null when
     *   the sheet has no usable value for that attribute.
     */
    const getPassiveScore = async (charId, skill) => {
        const bonus = await getSheetItem(charId, `${skill}_bonus`)
        const score = Number(bonus) + BASE_VALUE
        return Number.isNaN(score) ? null : score
    }

    /**
     * Decides a passive check against a DC.
     *
     * @param {number} score
     * @param {number} dc
     * @returns {string} 'Success' or 'Failure'.
     */
    const isPassiveSuccess = (score, dc) => {
        return score >= dc ? 'Success' : 'Failure'
    }

    /**
     * Builds the results card: one row per party member with avatar, name and
     * score; with a DC, a Success/Failure verdict column is appended.
     *
     * @param {PartyMan.Party} party
     * @param {string} checkType - Any casing/spacing of a SKILLS entry.
     * @param {number} [dc] - Optional DC to judge against.
     * @returns {Promise<Cards.Card>}
     */
    const buildCard = async (party, checkType, dc) => {
        const skill = normalize(checkType)
        const title = dc === undefined
            ? `Passive Check — ${displayName(skill)}`
            : `Passive Check - ${displayName(skill)} - DC: ${dc}`
        const card = new Cards.Card(title)

        for (const pm of party.members) {
            const score = await getPassiveScore(pm.id, skill)
            const scoreCell = Cards.Card.num(score === null ? NO_SCORE : score)
            if (dc === undefined) {
                card.addRow(...PartyMan.memberCells(pm), scoreCell)
            } else {
                const verdict = score === null ? NO_SCORE : isPassiveSuccess(score, dc)
                card.addRow(...PartyMan.memberCells(pm), scoreCell, verdict)
            }
        }
        return card
    }

    /**
     * Renders the help card from the SKILLS list, styled via Cards.THEME.
     *
     * @returns {string}
     */
    const helpText = () => {
        const t = Cards.THEME
        const usage = [
            ['!pcheck &lt;skill&gt;', 'Passive score for that skill, for each party member'],
            ['!pcheck &lt;skill&gt; &lt;dc&gt;', 'Adds Success/Failure vs the DC, e.g. <b>!pcheck insight 12</b>'],
            ['!pcheck help', 'This card']
        ].map(([cmd, desc]) =>
            `<tr><td style="${t.cell}"><b>${cmd}</b></td><td style="${t.cell}">${desc}</td></tr>`
        ).join("")

        const skillList = SKILLS.map(displayName).join(', ')

        return `<div style="${t.card}">` +
            `<div style="${t.header}">Passive Check — Help</div>` +
            `<div style="padding:6px 8px;">` +
            `Whispers the party's passive scores to the GM. No token selection needed — the party comes from the characters' <b>In Party</b> flag.` +
            `<table style="${t.table}margin-top:4px;">` +
            usage +
            `</table>` +
            `<div style="margin-top:4px;"><b>Skills:</b> ${skillList}</div>` +
            `<div style="margin-top:4px;${t.muted}">Requires PartyMan. Scores are ${BASE_VALUE} + the sheet's passive bonus.</div>` +
            `</div>` +
            `</div>`
    }

    return { isValidType, buildCard, helpText }
})()
