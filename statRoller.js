on('ready', () => {
    on('chat:message', (msg) => {
        if (msg.type !== 'api' || !msg.content.startsWith('!rollstats')) return;

        const who = msg.who.replace(/ \(GM\)$/, '');
        const rollSet = () => {
            const dice = [0, 0, 0, 0].map(() => randomInteger(6));
            const sorted = [...dice].sort((a, b) => b - a);
            const total = sorted[0] + sorted[1] + sorted[2];
            return { dice, total };
        };

        const stats = [...Array(6)].map(rollSet);
        const sum = stats.reduce((a, s) => a + s.total, 0);

        const rows = stats.map((s, i) => {
            const shown = s.dice
                .map((d, j) => {
                    // mark one instance of the lowest die as dropped
                    const dropIdx = s.dice.indexOf(Math.min(...s.dice));
                    return j === dropIdx ? `~${d}~` : `**${d}**`;
                })
                .join(' ');
            return `{{Stat ${i + 1} = **${s.total}**  (${shown})}}`;
        }).join(' ');

        sendChat('StatRoller',
            `&{template:default} {{name=${who} — Ability Scores}} ${rows} {{Total = **${sum}**}}`
        );
    });
});