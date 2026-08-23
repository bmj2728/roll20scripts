// usage: !pcheck perception 12 (with success/fail) / !pcheck insight (returns passive insight scores)

// TODO: actual help text
const PASSIVES_HELP_TEXT = "Fancy html help text"
const PASSIVES_BASE_VALUE = 10

const isPassiveSuccess = (score, dc) => {
    if (score >= dc) {
        return 'Success'
    } else {
        return 'Failure'
    }
}

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
    return {charId: charId, passive: mod}
}

const toTitleCase = str => str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());


const genHeaderRow = (checkType) => {
    let titleType = toTitleCase(checkType)
    return `<div style="background:#2b2b3a;color:#fff;padding:4px 8px;font-weight:bold;">
            Passive Check — ${titleType}
            </div>`
}

const genCheckHeaderRow = (checkType, dc) => {
    let titleType = toTitleCase(checkType)
    return `<div style="background:#2b2b3a;color:#fff;padding:4px 8px;font-weight:bold;">
            Passive Check - ${titleType} - DC: ${dc} 
            </div>`
}

const genSimpleRow = (pm, score) => {
    return `<tr>
                <td style="width:28px;padding:2px;"><img src="${pm.avatar}" style="width:24px;height:24px;border-radius:4px;" alt="visual of output"></td>
                <td style="padding:2px 6px;">${pm.characterName}</td>
                <td style="padding:2px 6px;text-align:right;font-weight:bold;">${score}</td>
            </tr>`;
}
const genSimpleTable = async (party, checkType) => {

    const tableStart = `<table style="width:100%;border-collapse:collapse;">`
    const tableEnd = `</table>`
    let tableRows = ``
    for (const pm of party.members) {
        let passive_score = (await getPassive(pm.id, checkType)).passive + PASSIVES_BASE_VALUE
        let pmRow = genSimpleRow(pm, passive_score)
        tableRows = tableRows + pmRow
    }
    return tableStart + tableRows + tableEnd
}

const genCheckRow = (pm, score, dc) => {
    let isSuccess = isPassiveSuccess(score, dc)
    return `<tr>
                <td style="width:28px;padding:2px;"><img src="${pm.avatar}" style="width:24px;height:24px;border-radius:4px;" alt="visual of output"></td>
                <td style="padding:2px 6px;">${pm.characterName}</td>
                <td style="padding:2px 6px;text-align:right;font-weight:bold;">${score}</td>
                <td style="padding:2px 6px;">${isSuccess}</td>
            </tr>`;
}

const genCheckTable = async (party, checkType, dc) => {

    const tableStart = `<table style="width:100%;border-collapse:collapse;">`
    const tableEnd = `</table>`
    let tableRows = ``
    for (const pm of party.members) {
        let passive_score = (await getPassive(pm.id, checkType)).passive + PASSIVES_BASE_VALUE
        let pmRow = genCheckRow(pm, passive_score, dc)
        tableRows = tableRows + pmRow
    }
    return tableStart + tableRows + tableEnd
}

const genSimpleMessage = async (party, checkType) => {
    const simpleMessageStart = `<div style="border:1px solid #444;border-radius:6px;overflow:hidden;font-size:12px;">`
    const simpleMessageEnd = `</div>`
    const simpleMessageHeader = genHeaderRow(checkType)
    const simpleMessageTable = await genSimpleTable(party, checkType)

    return simpleMessageStart + simpleMessageHeader + simpleMessageTable + simpleMessageEnd
}

const genCheckMessage = async (party, checkType, dc) => {
    const checkMessageStart = `<div style="border:1px solid #444;border-radius:6px;overflow:hidden;font-size:12px;">`
    const checkMessageEnd = `</div>`
    const checkMessageHeader = genCheckHeaderRow(checkType, dc)
    const checkMessageTable = await genCheckTable(party, checkType, dc)

    return checkMessageStart + checkMessageHeader + checkMessageTable + checkMessageEnd
}

on('ready', () => {
    on('chat:message', async msg => {
        // process chat
        // start of line w/ word bound
        if (msg.type !== 'api' || !/^!pcheck\b/i.test(msg.content)) return;
        //split message on whitespace
        const [, checkType, dc] = msg.content.split(/\s+/);
        // type guards
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

        let party = new Party()
        //party guard
        if (party === undefined || party.members.length < 1) {
            sendChat("Passive Checks", "Party not found")
        }

        if (dc === undefined) {
            let simpleMsg = await genSimpleMessage(party, checkType)
            sendChat("Passive Check", `/w gm ${simpleMsg}`)
            return
        }

        const parsedDC = parseInt(dc)
        if (isNaN(parsedDC)) {
            let simpleMsg = await genSimpleMessage(party, checkType)
            sendChat("Passive Check", `/w gm \nInvalid DC: ${dc}`)
            sendChat("Passive Check", `/w gm ${simpleMsg}`)
            return
        }

        let checkMsg = await genCheckMessage(party, checkType, parsedDC)
        sendChat("Passive Check", `/w gm ${checkMsg}`)
    });
});
