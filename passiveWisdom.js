// usage: !pcheck perception 12 (with success/fail) / !pcheck insight (returns passive insight scores)

// TODO: actual help text
const PASSIVES_HELP_TEXT = "Fancy html help text"
const PASSIVES_BASE_VALUE = 10

const getPassive = async (charId, passiveType) => {
    let mod = -99;
    switch (passiveType) {
        case 'perception':
            mod = await getSheetItem(charId, "perception_bonus");
            break;
        case 'insight':
            mod = await getSheetItem(charId, "insight_bonus");
            break;
        case 'investigation':
            mod = await getSheetItem(charId, "investigation_bonus");
            break;
        default:
            return {charId: charId}
    }
    log(mod)
    return {charId: charId, passive: mod}
}

on('ready', () => {
    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!pcheck\b/i.test(msg.content)) return;
        const [, checkType, dc] = msg.content.split(/\s+/);
        if (checkType === undefined) {
            sendChat("Passive Checks", "Missing check type:\n" + PASSIVES_HELP_TEXT)
            return;
        }
        if (checkType === 'help') {
            sendChat("Passive Checks", PASSIVES_HELP_TEXT)
            return;
        }
        if (checkType !== 'perception' && checkType !== 'insight' && checkType !== 'investigation') {
            sendChat("Passive Checks", "invalid check type:\n" + PASSIVES_HELP_TEXT)
            return;
        }
        let party = getParty()
        if (party === undefined || party.length < 1) {
            sendChat("Passive Checks", "Party not found")
        }
        for (const c of party) {
            passive_score = (await getPassive(c.get("_id"), checkType)).passive + PASSIVES_BASE_VALUE
            sendChat('Passive', `Party Member: ${c.get("name")} score: ${passive_score}`)
        }
    });
});