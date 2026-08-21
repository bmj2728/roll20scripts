// PoH - minimal promise-based HP writer for 2024 sheets
// !poh hp +7   (relative)   !poh hp 25   (absolute)
on('ready', () => {
    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!poh\b/i.test(msg.content)) return;
        if (!msg.selected || !msg.selected.length) return;

        const [, item, raw] = msg.content.split(/\s+/);
        if (!item || raw === undefined) return;

        for (const s of msg.selected.filter(x => x._type === 'graphic')) {
            const tok = getObj('graphic', s._id);
            const charId = tok && tok.get('represents');
            if (!charId) continue;

            try {
                let value;
                if (/^[+-]/.test(raw)) {
                    const cur = await getSheetItem(charId, item);
                    value = Number(cur) + Number(raw);
                } else {
                    value = Number(raw);
                }
                await setSheetItem(charId, item, value);

                sendChat('Potion of Healing', `/w gm ${tok.get('name')}: ${item} → ${value}`);
            } catch (err) {
                sendChat('Potion of Healing', `/w gm ${tok.get('name')}: failed (${err.message || err})`);
            }
        }
    });
});
