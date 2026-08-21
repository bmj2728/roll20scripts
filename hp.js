// HP - minimal promise-based HP writer for 2024 sheets
// !hp +7   (relative)   !hp 25   (absolute)
//TODO:
// 1.) check temp HP (bar2) before applying damage and use tmp pool first
// 2.) manage bars as well
// 3.) whisper early returns for visibility into issues
// 4.) add target function !hp +7 for selected token(s) !hp --target abcd123 -5 for specific targeted token
on('ready', () => {
    on('chat:message', async msg => {
        if (msg.type !== 'api' || !/^!hp\b/i.test(msg.content)) return;
        if (!msg.selected || !msg.selected.length) return;

        const [, raw] = msg.content.split(/\s+/);
        if (raw === undefined) return;

        const item = 'hp';

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

                sendChat('HP', `/w gm ${tok.get('name')}: ${item} → ${value}`);
            } catch (err) {
                sendChat('HP', `/w gm ${tok.get('name')}: failed (${err.message || err})`);
            }
        }
    });
});

// Example from api docs
// * Automatically removes temp HP if they exist.
// *
// * When a token has its HP reduced the script checks to see if there are any
// * temp HP available. If it does those are removed first and the real HP is
// * updated to reflect the temp HP absorbing the hit.
// *
// * TEMP_BAR_ID - The bar used to track temp HP [1, 2, 3]
// * HP_BAR_ID - The bar used top track real HP [1, 2, 3]
// *
// var TEMP_BAR_ID = 2;
// var HP_BAR_ID = 1;
//
// on("change:token", function(obj, prev) {
//     var prevHpValStr = prev["bar" + HP_BAR_ID + "_value"];
//     var prevHpVal = parseInt(prevHpValStr);
//     if (isNaN(prevHpVal)) {
//         log("WARN: Previous bar " + HP_BAR_ID + " does not contain a number: '" + prevHpValStr + "'");
//         return;
//     }
//
//     var hpValStr = obj.get("bar" + HP_BAR_ID + "_value");
//     var hpVal = parseInt(hpValStr);
//     if (isNaN(hpVal)) {
//         log("WARN: Bar " + HP_BAR_ID + " does not contain a number: '" + hpValStr + "'");
//         return;
//     }
//
//     if (prevHpVal > hpVal) {
//         var tmpHpVal = parseInt(obj.get("bar" + TEMP_BAR_ID + "_value"));
//         log(prevHpVal + " - " + hpVal + " - " + tmpHpVal);
//         if (!isNaN(tmpHpVal)) {
//             var hpChange = prevHpVal - hpVal;
//             var remainingTmp = tmpHpVal - hpChange;
//             if (remainingTmp > 0) {
//                 obj.set("bar" + TEMP_BAR_ID + "_value", remainingTmp);
//                 obj.set("bar" + HP_BAR_ID + "_value", prevHpVal);
//             }
//             else {
//                 var remainingHp = prevHpVal + remainingTmp;
//                 obj.set("bar" + TEMP_BAR_ID + "_value", 0);
//                 obj.set("bar" + HP_BAR_ID + "_value", remainingHp);
//             }
//         }
//     }
// });