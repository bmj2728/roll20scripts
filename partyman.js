const getParty = () => {
    return findObjs({ _type: "character", inParty: true })
}

on('ready', () => {
    log("Starting PartyMan")

    // Define button styling inside the HTML string

    let command = "!pm party"
    let commandName = "Display Party"

    let style = "background-color: #7e22ce; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; font-weight: bold;";

    let htmlButton = `<a style="${style}" href="${command}">${commandName}</a>`;

    sendChat('PartyMan', "PartyMan HTML:\n" + htmlButton)

    let markdownButton = `[${commandName}](${command})`

    sendChat('PartyMan', "PartyMan MD:\n" + markdownButton)

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