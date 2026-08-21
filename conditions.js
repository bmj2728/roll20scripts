// CondSync-safe condition handler: !cond +sheet-blinded | !cond -sheet-blinded | !cond clear
on('ready', () => {
    on('chat:message', msg => {
        if (msg.type !== 'api' || !/^!cond\b/i.test(msg.content)) return;
        if (!msg.selected || !msg.selected.length) {
            sendChat('Cond', '/w gm No tokens selected.');
            return;
        }

        const arg = msg.content.split(/\s+/)[1] || '';
        if (!arg) return;

        msg.selected
            .filter(s => s._type === 'graphic')
            .map(s => getObj('graphic', s._id))
            .filter(t => t !== undefined)
            .forEach(t => {
                if (arg.toLowerCase() === 'clear') {
                    t.set('statusmarkers', '');
                    return;
                }
                const markers = t.get('statusmarkers').split(',').filter(m => m !== '');
                const name = arg.slice(1);
                if (arg[0] === '+' && !markers.includes(name)) {
                    markers.push(name);
                } else if (arg[0] === '-') {
                    const i = markers.indexOf(name);
                    if (i > -1) markers.splice(i, 1);
                }
                t.set('statusmarkers', markers.join(','));
            });
    });
});