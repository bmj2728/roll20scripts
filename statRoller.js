// StatRoller - rolls a full ability-score array (4d6 drop lowest, six times)
// and posts it as a ChatCards tile strip, attributed to whoever ran it.
// !rollstats -> roll and post to public chat
// Requires ChatCards (Card, THEME).
on('ready', () => {
    on('chat:message', (msg) => {
        if (msg.type !== 'api' || !/^!rollstats\b/i.test(msg.content)) return;

        const who = msg.who.replace(/ \(GM\)$/, '');

        const rollSet = () => {
            const dice = [0, 0, 0, 0].map(() => randomInteger(6));
            const sorted = [...dice].sort((a, b) => b - a);
            const total = sorted[0] + sorted[1] + sorted[2];
            return { dice, total };
        };

        const stats = [...Array(6)].map(rollSet);
        const sum = stats.reduce((a, s) => a + s.total, 0);

        // The four dice in rolled order, the dropped (lowest) one struck through.
        // Styled span rather than <s>: inline styles reliably survive Roll20's
        // chat sanitizer; bare tags aren't guaranteed to.
        const diceText = (dice) => {
            const dropIdx = dice.indexOf(Math.min(...dice));
            return dice
                .map((d, j) => j === dropIdx ? `<span style="text-decoration:line-through;opacity:0.5;">${d}</span>` : `${d}`)
                .join('&nbsp;')
        };

        const card = new ChatCards.Card(`${who} — Ability Scores`)
        card.addRow(ChatCards.Card.span(ChatCards.Card.tiles(
            stats.map((s, i) => ({ label: `Stat ${i + 1}`, value: s.total, sub: diceText(s.dice) }))
        ), 2))
        card.addRow("Total", ChatCards.Card.num(sum))
        card.send('StatRoller')
    });
});
