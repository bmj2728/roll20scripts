// PassiveCheck - whispers the party's passive skill scores (optionally vs a DC) to the GM
// usage: !pcheck insight (returns passive insight scores) / !pcheck perception 12 (with success/fail)
//
// Scores come from PartyMan's cached skill bonuses, not from the sheet: a check
// costs zero sheet reads. Run !pm refresh if a sheet changed (Beacon sheet-item
// writes fire no sandbox event, so no cache can hear them).
// Requires PartyMan (Party, memberCells, SKILLS vocabulary) and ChatCards (Card, THEME).
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
        if (PartyMan.isSkill(args.join(' '))) {
            checkType = args.join(' ')
        } else if (args.length > 1 && PartyMan.isSkill(args.slice(0, -1).join(' '))) {
            checkType = args.slice(0, -1).join(' ')
            dc = args[args.length - 1]
        } else {
            whisperBack("Invalid check type:\n" + PassiveCheck.helpText())
            return;
        }

        const members = (await PartyMan.getSyncedParty()).members
        //party guard
        if (members.length < 1) {
            whisperBack("Party not found")
            return;
        }

        if (dc === undefined) {
            PassiveCheck.buildCard(members, checkType).whisperGM("Passive Check")
            return
        }

        const parsedDC = parseInt(dc)
        if (isNaN(parsedDC)) {
            whisperBack(`Invalid DC: ${dc}`)
            PassiveCheck.buildCard(members, checkType).whisperGM("Passive Check")
            return
        }

        PassiveCheck.buildCard(members, checkType, parsedDC).whisperGM("Passive Check")
    });
});

/**
 * PassiveCheck namespace. Exposes only what the chat handler needs; everything
 * else stays private to the IIFE.
 *
 * The skill vocabulary (SKILLS, normalize, display names) lives in PartyMan —
 * the same `<skill>_bonus` powers a passive score and an active roll, so it is
 * party vocabulary rather than this script's.
 *
 * Rendering goes through ChatCards.Card, so output stays on-theme with every
 * other ChatCards-based tool.
 *
 * @namespace PassiveCheck
 * @property {Function} buildCard - Builds the score card (verdict column when a DC is given)
 * @property {Function} helpText - Renders the help card
 */
const PassiveCheck = (() => {

    /** Shown in place of a score the sheet couldn't supply. */
    const NO_SCORE = '—'

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
     * score; with a DC, a Success/Failure verdict column is appended, colored
     * via the ChatCards good/bad theme keys.
     *
     * Synchronous — every score comes from PartyMan's cache, so there is nothing
     * to await.
     *
     * @param {PartyMan.Member[]} members
     * @param {string} checkType - Any casing/spacing of a SKILLS entry.
     * @param {number} [dc] - Optional DC to judge against.
     * @returns {ChatCards.Card}
     */
    const buildCard = (members, checkType, dc) => {
        const skill = PartyMan.normalizeSkill(checkType)
        const name = PartyMan.skillDisplayName(skill)
        const title = dc === undefined
            ? `Passive Check — ${name}`
            : `Passive Check - ${name} - DC: ${dc}`
        const card = new ChatCards.Card(title)

        for (const pm of members) {
            const score = pm.skills.getPassive(skill)
            const scoreCell = ChatCards.Card.num(score === null ? NO_SCORE : score)
            if (dc === undefined) {
                card.addRow(...PartyMan.memberCells(pm), scoreCell)
            } else {
                const verdict = score === null
                    ? { content: NO_SCORE, style: "muted" }
                    : { content: isPassiveSuccess(score, dc), style: score >= dc ? "good" : "bad" }
                card.addRow(...PartyMan.memberCells(pm), scoreCell, verdict)
            }
        }
        return card
    }

    /**
     * Renders the help card from PartyMan's skill list, styled via ChatCards.THEME.
     *
     * @returns {string}
     */
    const helpText = () => {
        const t = ChatCards.THEME
        const usage = [
            ['!pcheck &lt;skill&gt;', 'Passive score for that skill, for each party member'],
            ['!pcheck &lt;skill&gt; &lt;dc&gt;', 'Adds Success/Failure vs the DC, e.g. <b>!pcheck insight 12</b>'],
            ['!pcheck help', 'This card']
        ].map(([cmd, desc]) =>
            `<tr><td style="${t.cell}"><b>${cmd}</b></td><td style="${t.cell}">${desc}</td></tr>`
        ).join("")

        const skillList = PartyMan.SKILLS.map(PartyMan.skillDisplayName).join(', ')

        return `<div style="${t.card}">` +
            `<div style="${t.header}">Passive Check — Help</div>` +
            `<div style="padding:6px 8px;">` +
            `Whispers the party's passive scores to the GM. No token selection needed — the party comes from the characters' <b>In Party</b> flag.` +
            `<table style="${t.table}margin-top:4px;">` +
            usage +
            `</table>` +
            `<div style="margin-top:4px;"><b>Skills:</b> ${skillList}</div>` +
            `<div style="margin-top:4px;${t.muted}">Requires PartyMan. Scores are ${PartyMan.PASSIVE_BASE} + the sheet's passive bonus, read from PartyMan's cache — run <b>!pm refresh</b> after sheet edits.</div>` +
            `</div>` +
            `</div>`
    }

    return { buildCard, helpText }
})()
