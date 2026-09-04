/*
***********SPELLS************
* Flexible spellcasting system
*
* Anatomy of a command:
* !spells action spell [level] [--args ...argsList]
* !spells - this lets the script identify api messages it needs to process
* action - this is the verb that tells the script what action to take. Typically, cast, dismiss, or trigger.
* spell - this tells the script what spell to cast. See spell for available actions and args
* [level] - optionally tells the script what level to cast the spell at; otherwise the default level is used
* [--args ...argsList] - optionally tells the script what additional arguments to pass to the spell
*
* Basic usage: !spells cast spiritual-weapon (casts at level 2)
* With a level: !spells cast spiritual-weapon 4 (casts at level 4)
* With args: !spells cast spiritual-weapon --args sword-red (casts at level 2 and sets the token to the red sword side)
* With args and level: !spells cast spiritual-weapon 4 --args morningstar green (casts at level 4 and sets the token to the green morningstar side)
*
*
* Each spell is responsible for handling its own logic for its actions, including any additional arguments passed to it.
* It's suggested to use consistent action names unless a spell calls for specific unique behavior.
*
* The script requires creating character objects for each spell to be used as a template.
* They, minimally, should be named as entered in the spells map and given an avatar image.
* It's recommended to create a default token for the `spell character` with appropriate settings
* The spell-as-a-character framework coupled with default tokens allows:
* - dynamically altering summons based on caster
* - creating macros on summons to trigger actions, dismissals, or effects
* - using marketplace items to create tokens for spells
* - having light effects visible immediately on spawn
*
* An example:
* Spiritual Weapon checks that the caster has a spell slot available at the level requested, then spawns in
* a token. I've set that character sheet up to use a multisided token with many weapons and colors as the default token.
* I've also given it a proficiency bonus to match the caster's level
*  and an attack that uses strength mod + pb for attack and 1d8 + strength mod
* When the token is spawned, we set the token's strength to the same mod as the caster's spellcasting ability.
* This automatically causes the spell character's attack action to use the correct modifiers.
* When it's dismissed, we drop it back to 10
* We also manage the slot use for the caster
*
* The framework allows for easy extensibility either through additional actions or arguments.
*
* For instance, you could check for overlapping tokens with the acid splash cantrip and roll their dex saves
*
*/

// Lookup for nicer text
const spellLevels = new Map([
    [0, "Cantrip"],
    [1, "1st Level"],
    [2, "2nd Level"],
    [3, "3rd Level"],
    [4, "4th Level"],
    [5, "5th Level"],
    [6, "6th Level"],
    [7, "7th Level"],
    [8, "8th Level"],
    [9, "9th Level"],
])

// The actual spells available, this map serves as a registry of spells
// name - string - the spell
// default_level - number - the default level of the spell
// template_width/template_height - number - the width/height of the spell template
const spells = new Map([
    ["acid-splash", {"name":"Acid Splash", "default_level": 0, "template_width": 140, "template_height": 140}],
    ["mage-hand", {"name":"Mage Hand", "default_level": 0, "template_width": 70, "template_height": 70}],
    ["spiritual-weapon", {"name":"Spiritual Weapon", "default_level": 2, "template_width": 70, "template_height": 70}],
]);

on('ready', async () => {

    on('chat:message', async msg => {
        // if it isn't for us we don't care
        if (msg.type !== 'api' || !/^!spells\b/i.test(msg.content)) return;

        // some response helpers
        const who = msg.who.replace(/ \(GM\)$/, '')
        const whisperBack = (text) => sendChat("Spells", `/w "${who}" ${text}`)
        const whisperGM = (text) => sendChat("Spells", `/w "gm" ${text}`)

        // we only act on the caster or the spawned spell token/template
        if (!msg.selected || !msg.selected.length || msg.selected.length > 1) {
            whisperBack(`Spells requires a single selected token. Please select only the caster or the spell template.`)
            return;
        }

        // split the message into parts into the command and args
        const [command, args] = msg.content.trim().split("--args ");

        // we parse the message into parts and validate/enrich
        const [, action, spell, level] = command.trim().split(/\s+/);

        // validate a spell was passed in and it's in the spell book
        if (spell === undefined || !spells.has(spell.toLowerCase())) {
            whisperBack(`Invalid spell: ${spell}`)
            return;
        }
        // grab spell data for use
        const spellData = spells.get(spell.toLowerCase())

        // validate a command was passed in
        if (action === undefined) {
            whisperBack(`No command included`)
            return;
        }

        // handle default spell level
        const castAtLevel = level === undefined ? spellData.default_level : parseInt(level)
        // validate level is a valid number and in spell level range
        if (isNaN(castAtLevel) || castAtLevel < 0 || castAtLevel > 9) {
            whisperBack(`Invalid spell level - ${castAtLevel}`)
            return
        }
        // can't cast a spell below the default level
        if (castAtLevel < spellData.default_level) {
            whisperBack(`${spellData.name} must be cast at ${spellLevels.get(castAtLevel)} or higher.`)
            return
        }
        // cantrips don't require spell slots so we let the user know
        if (spellData.default_level === 0 && castAtLevel !== 0) {
            whisperBack(`${spellData.name} is a cantrip and does not require a spell slot!`)
        }
        // some helper text outputting `Cantrip` or `Nth Level Spell` (2nd Level Spell)
        const castAtLevelText = castAtLevel === 0 ? `${spellLevels.get(castAtLevel)}` : `${spellLevels.get(castAtLevel)} spell`

        /*
        **********************CASTER/SPELL TEMPLATE INFO****************************
         */

        // caster info (or the spell token for spell actions/dismissal)
        const casterToken = getObj('graphic', msg.selected[0]._id)
        // who is it
        const casterCharacter = casterToken.get("represents")
        // where it is
        const pageId = casterToken.get("pageid")
        const layer = casterToken.get("layer")
        // center of the caster
        const x = casterToken.get("left")
        const y = casterToken.get("top")
        //caster edges
        const casterLeft = x - (casterToken.get("width") / 2)
        const casterRight = x + (casterToken.get("width") / 2)
        const casterTop = y - (casterToken.get("height") / 2)
        const casterBottom = y + (casterToken.get("height") / 2)
        // helper for sending chats as the character - format character|character_id outputs the character's name + avatar by default
        const casterSendAs = `character|${casterCharacter}`

        /*
        ***************************HELPER FUNCTIONS*********************************************************************
         */

        // helper to locate a spell's character object
        const findSpellCharacter = () => {
            let objs = findObjs({ _type: "character", name: spellData.name})
            if (objs === undefined || !objs.length) {
                whisperGM('Spells', `/w gm Unable to locate a character for ${spellData.name}`)
                return;
            }
            return objs[0]
        }

        const checkCasterSlots = async () => {
            const casterSlots = await getSheetItem(casterToken.get("represents"), `lvl${castAtLevel}_slots_total`)
            const casterSlotsExpended = await getSheetItem(casterToken.get("represents"), `lvl${castAtLevel}_slots_expended`)
            if (casterSlotsExpended >= casterSlots) {
                whisperBack(`You have no ${castAtLevelText} slots available to cast ${spells.get(spell.toLowerCase()).name}.`)
                return {"hasSlots": false, "total": casterSlots, "expended": casterSlotsExpended};
            }
            return {"hasSlots": true, "total": casterSlots, "expended": casterSlotsExpended};
        }

        // basic spawn helper - simply pops the character's default token or a token using their avatar near the caster
        const spawnBasic = (obj,pageid,layer,x,y)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'},(token)=>{
                    token.toFront()
                    token.set("disableSnapping", true)
                    token.set("disableTokenMenu", true)
                });
            }
        };

        // spawn helper for a token representing a spiritual weapon
        // in addition to the basic spawn helper, this function also sets the strength of the token to 10 + (mod * 2)
        // mod is the spellcasting ability modifier of the caster
        // this allows an attack to be added to the token's sheet that dynamically updates based on caster
        const spawnSpiritualWeapon = (obj,pageid,layer,x,y,mod, side)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'}, async (token) => {
                    token.toFront()
                    token.set("currentSide", side)
                    token.set("disableSnapping", true)
                    token.set("disableTokenMenu", true)
                    let newStrength = 10 + (mod * 2)
                    await setSheetItem(token.get("represents"), "strength", newStrength)
                });
            }
        };

        const basicCast = (casterSendAs,spellData,castAtLevel,spellCharacter,pageId,layer,x,y, fx = "none")=>{
            sendChat(casterSendAs, `Casting ${spellData.name} as a ${castAtLevelText}.`)
            if(fx !== "none"){
                spawnFx(x, y, fx)
            }
            spawnBasic(spellCharacter, pageId, layer, x, y)
        }

        const basicCastAtLevel = async (casterSendAs,spellData,castAtLevel,spellCharacter,pageId,layer,x,y, fx = "none")=>{
            const hasSpellSlot = await checkCasterSlots()
            if (!hasSpellSlot.hasSlots) return;
            basicCast(casterSendAs,spellData,castAtLevel,spellCharacter,pageId,layer,x,y, fx)
            await setSheetItem(casterToken.get("represents"), `lvl${castAtLevel}_slots_expended`, hasSpellSlot.expended + 1)
        }

        const basicDismiss = (spellCharacter, fx = "none")=>{
            if (casterToken === undefined) {
                whisperBack("No token selected")
                return;
            }
            if (spellCharacter.get("_id") !== casterToken.get("represents")) {
                whisperBack(`Selected token does not represent ${spellCharacter.get("name")}`)
                return;
            }
            if (fx !== "none") {
                spawnFx(casterToken.get("left"), casterToken.get("top"), fx)
            }
            casterToken.remove()
        }

        const spiritualWeaponCast = async (casterSendAs,spellData,castAtLevel,spellCharacter,pageId,layer,x,y,side) => {
            const hasSpellSlot = await checkCasterSlots()
            if (!hasSpellSlot.hasSlots) return;
            // to dynamically update the weapon
            const casterSpellcastingAbility = await getSheetItem(casterToken.get("represents"), "spellcasting_ability")
            const casterSpellcastingMod = parseInt(casterSpellcastingAbility.slice(0,-1))
            // casting
            sendChat(casterSendAs, `Casting ${spellData.name} as a ${castAtLevelText}.`)
            spawnFx(x, y, "glow-holy")
            spawnSpiritualWeapon(spellCharacter, pageId, layer, x, y, casterSpellcastingMod, side)
            // mark the slot
            await setSheetItem(casterToken.get("represents"), `lvl${castAtLevel}_slots_expended`, hasSpellSlot.expended + 1)
        }

        const spiritualWeaponDismiss = async (spellCharacter) => {
            basicDismiss(spellCharacter, "nova-holy")
            await setSheetItem(casterToken.get("represents"), "strength", 10)
        }

        /*
        ***********************************SPELL LOGIC*********************************************
        */


        switch (spell) {
            /***********************************************************************************************************
             *************************************************Acid Splash**************************************************
             ***********************************************************************************************************/
            case 'acid-splash':
                // the find function notifies the gm on failure so we can just return if nothing is found
                const acid = findSpellCharacter()
                if (acid === undefined) return;

                let posX = casterRight + (spells.get(spell).template_width / 2)
                let posY = casterTop - (spells.get(spell).template_height / 2)

                //Acid Splash uses cast and trigger, leveraging the basic cast and dismiss functions
                switch (action) {
                    //sends a chat as caster and spawns in a mage hand token with fx
                    case 'cast':
                        basicCast(casterSendAs,spellData,castAtLevel,acid,pageId,layer,posX,posY)
                        return;
                    // the mage hand
                    case 'trigger':
                        basicDismiss(acid, 'burst-acid')
                        return;
                    default:
                        whisperBack(`Invalid command for ${spell}`)
                        return;
                }

            /***********************************************************************************************************
             *************************************************MAGE HAND**************************************************
             ***********************************************************************************************************/
            case 'mage-hand':
                // the find function notifies the gm on failure so we can just return if nothing is found
                const mh = findSpellCharacter()
                if (mh === undefined) return;

                //Mage Hand uses cast and dismiss, leveraging the basic cast and dismiss functions
                switch (action) {
                    //sends a chat as caster and spawns in a mage hand token with fx
                    case 'cast':
                        basicCast(casterSendAs,spellData,castAtLevel,mh,pageId,layer,x,y, 'glow-magic')
                        return;
                    // the mage hand
                    case 'dismiss':
                        basicDismiss(mh, 'nova-magic')
                        return;
                    default:
                        whisperBack(`Invalid command for ${spell}`)
                        return;
                }

            /***********************************************************************************************************
             *****************************************Spiritual Weapon**************************************************
             **********************************************************************************************************/
            case 'spiritual-weapon':

                // this map could be globalized if needed - e.g., oops all clerics
                // otherwise we can scope it to the spell
                const spiritualWeaponSides = new Map([
                    ["axe-blue", 0],
                    ["axe-green", 1],
                    ["axe-red", 2],
                    ["hammer-blue", 3],
                    ["hammer-green", 4],
                    ["hammer-red", 5],
                    ["morningstar-blue", 6],
                    ["morningstar-green", 7],
                    ["morningstar-red", 8],
                    ["sword-blue", 9],
                    ["sword-green", 10],
                    ["sword-red", 11],
                ])

                // make sure we have a character set up to spawn in
                const sw = findSpellCharacter()
                if (sw === undefined) return;

                let side = 0
                if (args !== undefined) {
                    const [sideName,] = args.split(/\s+/)
                    if (spiritualWeaponSides.get(sideName.trim()) !== undefined) {
                        side = spiritualWeaponSides.get(sideName.trim())
                    }
                }

                switch (action) {
                    // the cast here will spawn in the spiritual weapon
                    // the spiritual weapon sheet should be leveled when characters increase proficiency bonus
                    case 'cast':
                        // confirm the caster has the slot available
                        await spiritualWeaponCast(casterSendAs,spellData,castAtLevel,sw,pageId,layer,x,y, side)
                        return;

                    case 'dismiss':
                        await spiritualWeaponDismiss(sw)
                        return;

                    default:
                        sendChat('Spells', `/w gm Invalid command`)
                        return;

                }
            // another guard against missing spells
            default:
                sendChat('Spells', `/w ${msg.who} Unable to locate spell`)
                return;
        }
    });
});