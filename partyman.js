const getParty = () => {
    return findObjs({ _type: "character", inParty: true })
}

on('ready', () => {
    log("starting PartyMan")
    getParty().forEach(c => {
        sendChat('PartyMan', `Party Member: ${c.get("name")}`)
    })

    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!pm\b/i.test(msg.content)) return;

        const [, cmd] = msg.content.split(/\s+/);
        if (cmd === undefined) {
            sendChat('PartyMan', "Invalid command")
            return
        };

        if (cmd === 'party') {
            getParty().forEach(c => {
                sendChat('PartyMan', `Party Member: ${c.get("name")}`)
            })
        }
    });
});