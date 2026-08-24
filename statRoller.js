// StatRoller - rolls ability-score arrays (4d6 drop lowest, six stats) as
// ChatCards tile strips, with per-player attempt tracking in state.
//
// !rollstats            -> roll one array (counts against the attempt limit)
// !rollstats <n>        -> roll n arrays, one card each, clamped to attempts left
// !rollstats history    -> whisper your stored arrays back to you
// !rollstats menu       -> GM: config card (set limit, per-player history/clear)
// !rollstats limit <n>  -> GM: set the attempt limit (0 = unlimited)
// !rollstats history <playerid> -> GM: whisper any player's stored arrays
// !rollstats clear <playerid>   -> GM: rebirth — wipe that player's count AND history
// !rollstats clearall           -> GM: wipe everyone (new campaign)
//
// Players are keyed by playerid (stable), never display name (spoofable);
// GM commands are guarded with playerIsGM(playerid) for the same reason.
// Requires ChatCards (Card, THEME).
on('ready', () => {
    if (!state.StatRoller) state.StatRoller = { limit: 3, players: {} };

    on('chat:message', (msg) => {
        if (msg.type !== 'api' || !/^!rollstats\b/i.test(msg.content)) return;

        const who = msg.who.replace(/ \(GM\)$/, '');
        const args = msg.content.trim().split(/\s+/).slice(1);
        const sub = (args[0] || '').toLowerCase();
        const isGM = playerIsGM(msg.playerid);
        const whisperBack = (text) => sendChat('StatRoller', `/w "${who}" ${text}`);

        // ---- GM subcommands ------------------------------------------------
        if (sub === 'menu' || sub === 'limit' || sub === 'clear' || sub === 'clearall'
            || (sub === 'history' && args[1] !== undefined)) {
            if (!isGM) {
                whisperBack('GM only.');
                return;
            }
            if (sub === 'menu') {
                whisperBack(StatRoller.menuCard().render());
                return;
            }
            if (sub === 'limit') {
                const n = parseInt(args[1]);
                if (isNaN(n) || n < 0) {
                    whisperBack('Usage: !rollstats limit <n> (0 = unlimited)');
                    return;
                }
                state.StatRoller.limit = n;
                whisperBack(`Attempt limit set to ${n === 0 ? 'unlimited' : n}.`);
                return;
            }
            if (sub === 'clear') {
                if (args[1] === undefined) {
                    whisperBack('Usage: !rollstats clear <playerid> (use the menu buttons)');
                    return;
                }
                const rec = state.StatRoller.players[args[1]];
                if (!rec) {
                    whisperBack('No stored rolls for that player id.');
                    return;
                }
                delete state.StatRoller.players[args[1]];
                whisperBack(`${rec.who} is reborn — rolls and history cleared.`);
                return;
            }
            if (sub === 'clearall') {
                state.StatRoller.players = {};
                whisperBack('All stored rolls cleared. A fresh campaign dawns.');
                return;
            }
            // history <playerid>
            if (args[1] === undefined) {
                whisperBack('Usage: !rollstats history <playerid>');
                return;
            }
            StatRoller.whisperHistory(args[1], who);
            return;
        }

        // ---- player subcommands --------------------------------------------
        if (sub === 'history') {
            StatRoller.whisperHistory(msg.playerid, who);
            return;
        }

        // ---- rolling -------------------------------------------------------
        let n = 1;
        if (sub !== '') {
            n = parseInt(sub);
            if (isNaN(n) || n < 1) {
                whisperBack('Usage: !rollstats [n|history' + (isGM ? '|menu|limit|clear|clearall' : '') + ']');
                return;
            }
        }
        n = Math.min(n, StatRoller.MAX_SETS_PER_CALL);

        const limit = state.StatRoller.limit;
        const rec = state.StatRoller.players[msg.playerid] || { who: who, sets: [] };
        rec.who = who;  // keep display name current for the GM menu

        const remaining = limit === 0 ? Infinity : limit - rec.sets.length;
        if (remaining <= 0) {
            whisperBack(`Attempt limit reached (${rec.sets.length}/${limit}). Ask your GM nicely.`);
            return;
        }
        const granted = Math.min(n, remaining);

        for (let i = 0; i < granted; i++) {
            const set = StatRoller.rollArray();
            rec.sets.push(set);
            StatRoller.arrayCard(who, set, rec.sets.length, limit).send('StatRoller');
        }
        state.StatRoller.players[msg.playerid] = rec;

        if (granted < n) {
            whisperBack(`Rolled ${granted} of the ${n} requested — attempt limit reached (${rec.sets.length}/${limit}).`);
        }
    });
});

/**
 * StatRoller namespace. Exposes what the chat handler needs; rolling and
 * rendering internals stay private.
 *
 * @namespace StatRoller
 * @property {number} MAX_SETS_PER_CALL - Spam cap on !rollstats <n>
 * @property {Function} rollArray - Rolls one full six-stat array
 * @property {Function} arrayCard - Renders one array as a tile-strip card
 * @property {Function} whisperHistory - Whispers a player's stored arrays
 * @property {Function} menuCard - Builds the GM config card
 */
const StatRoller = (() => {

    const MAX_SETS_PER_CALL = 10

    /** One stat: 4d6, drop the lowest. */
    const rollSet = () => {
        const dice = [0, 0, 0, 0].map(() => randomInteger(6));
        const sorted = [...dice].sort((a, b) => b - a);
        const total = sorted[0] + sorted[1] + sorted[2];
        return { dice, total };
    }

    /** One full array: six stats plus their grand total. */
    const rollArray = () => {
        const stats = [...Array(6)].map(rollSet);
        return { stats, sum: stats.reduce((a, s) => a + s.total, 0) };
    }

    // The four dice in rolled order, the dropped (lowest) one struck through.
    // Styled span rather than <s>: inline styles reliably survive Roll20's
    // chat sanitizer; bare tags aren't guaranteed to.
    const diceText = (dice) => {
        const dropIdx = dice.indexOf(Math.min(...dice));
        return dice
            .map((d, j) => j === dropIdx ? `<span style="text-decoration:line-through;opacity:0.5;">${d}</span>` : `${d}`)
            .join('&nbsp;')
    }

    /**
     * Renders one rolled array as a card. The title carries the attempt stamp
     * (e.g. "(2/3)") so every posted array shows which attempt it was.
     *
     * @param {string} who - Display name for the title.
     * @param {{stats: Array, sum: number}} set
     * @param {number} attempt - 1-based attempt number.
     * @param {number} limit - Current limit (0 = unlimited, no stamp).
     * @returns {ChatCards.Card}
     */
    const arrayCard = (who, set, attempt, limit) => {
        const stamp = limit > 0 ? ` (${attempt}/${limit})` : ''
        const card = new ChatCards.Card(`${who} — Ability Scores${stamp}`)
        card.addRow(ChatCards.Card.span(ChatCards.Card.tiles(
            set.stats.map((s, i) => ({ label: `Stat ${i + 1}`, value: s.total, sub: diceText(s.dice) }))
        ), 2))
        card.addRow("Total", ChatCards.Card.num(set.sum))
        return card
    }

    /**
     * Whispers every stored array for a player to `to` (the requester —
     * the player themselves, or the GM pulling someone's record).
     *
     * @param {string} playerid - Whose history.
     * @param {string} to - Display name to whisper to.
     */
    const whisperHistory = (playerid, to) => {
        const rec = state.StatRoller.players[playerid];
        if (!rec || !rec.sets.length) {
            sendChat('StatRoller', `/w "${to}" No stored rolls.`);
            return;
        }
        rec.sets.forEach((set, i) => {
            sendChat('StatRoller', `/w "${to}" ${arrayCard(rec.who, set, i + 1, state.StatRoller.limit).render()}`);
        });
    }

    /**
     * The GM config card: current limit with a set-limit button, then one row
     * per player with rolls — attempts used, History and Clear buttons carrying
     * the playerid (so nobody ever types one).
     *
     * @returns {ChatCards.Card}
     */
    const menuCard = () => {
        const limit = state.StatRoller.limit
        const card = new ChatCards.Card("StatRoller Config")
        card.addRow(
            `Attempt limit: <b>${limit === 0 ? 'unlimited' : limit}</b>`,
            ChatCards.Card.button('Set', '!rollstats limit ?{Attempts (0 = unlimited)|3}'),
            ChatCards.Card.button('Clear all', '!rollstats clearall')
        )
        const players = Object.entries(state.StatRoller.players)
        if (!players.length) {
            card.addRow(ChatCards.Card.span('No rolls stored yet.', 3, 'muted'))
        }
        for (const [pid, rec] of players) {
            card.addRow(
                `${rec.who} — ${rec.sets.length}${limit > 0 ? `/${limit}` : ''} attempts`,
                ChatCards.Card.button('History', `!rollstats history ${pid}`),
                ChatCards.Card.button('Clear', `!rollstats clear ${pid}`)
            )
        }
        return card
    }

    return { MAX_SETS_PER_CALL, rollArray, arrayCard, whisperHistory, menuCard }
})()
