on('ready', async () => {

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
    const spells = new Map([
        ["acid-splash", {"name":"Acid Splash", "default_level": 0}],
        ["mage-hand", {"name":"Mage Hand", "default_level": 0}],
        ["spiritual-weapon", {"name":"Spiritual Weapon", "default_level": 2}],
    ]);

    on('chat:message', async msg => {
        // if it isn't for us we don't care and neither does anyone else
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

        // we parse the message into parts and validate/enrich
        const [, cmd, spell, level] = msg.content.split(/\s+/);

        // validate a spell was passed in and it's in the spell book
        if (spell === undefined || !spells.has(spell.toLowerCase())) {
            whisperBack(`Invalid spell: ${spell}`)
            return;
        }
        // grab spell data for use
        const spellData = spells.get(spell.toLowerCase())

        // validate a command was passed in
        if (cmd === undefined) {
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

        // caster info (or the spell token)
        const casterToken = getObj('graphic', msg.selected[0]._id)
        // where it is
        const pageId = casterToken.get("pageid")
        const layer = casterToken.get("layer")
        // center of the caster
        const x = casterToken.get("left")
        const y = casterToken.get("top")
        // helper for sending chats as the character - format character|character_id outputs the character's name + avatar by default
        const casterSendAs = `character|${casterToken.get("represents")}`

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
                });
            }
        };

        // spawn helper for a token representing a spiritual weapon
        // in addition to the basic spawn helper, this function also sets the strength of the token to 10 + (mod * 2)
        // mod is the spellcasting ability modifier of the caster
        // this allows an attack to be added to the token's sheet that dynamically updates based on caster
        const spawnSpiritualWeapon = (obj,pageid,layer,x,y,mod)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'}, async (token) => {
                    token.toFront()
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

        const spiritualWeaponCast = async (casterSendAs,spellData,castAtLevel,spellCharacter,pageId,layer,x,y, fx = "none") => {
            const hasSpellSlot = await checkCasterSlots()
            if (!hasSpellSlot.hasSlots) return;
            // to dynamically update the weapon
            const casterSpellcastingAbility = await getSheetItem(casterToken.get("represents"), "spellcasting_ability")
            const casterSpellcastingMod = parseInt(casterSpellcastingAbility.slice(0,-1))
            // casting
            sendChat(casterSendAs, `Casting ${spells.get(spell.toLowerCase()).name} as a ${castAtLevelText}`)
            spawnFx(x, y, fx)
            spawnSpiritualWeapon(spellCharacter, pageId, layer, x, y, casterSpellcastingMod)
            // mark the slot
            await setSheetItem(casterToken.get("represents"), `lvl${castAtLevel}_slots_expended`, hasSpellSlot.expended + 1)
        }

        const spiritualWeaponDismiss = async (spellCharacter, fx = none) => {
            basicDismiss(spellCharacter, fx)
            await setSheetItem(casterToken.get("represents"), "strength", 10)
        }

        /* spells and their commands
            suggested to use shared vocabulary where possible:
            cast for initial casting
            dismiss for removing the spell from the battlefield
            trigger for simulating the effect of the spell (or program it, I'm not your dad)
         */
        switch (spell) {
            /***********************************************************************************************************
             *************************************************Acid Splash**************************************************
             ***********************************************************************************************************/
            case 'acid-splash':
                // the find function notifies the gm on failure so we can just return if nothing is found
                const acid = findSpellCharacter()
                if (acid === undefined) return;

                //Mage Hand uses cast and dismiss, leveraging the basic cast and dismiss functions
                switch (cmd) {
                    //sends a chat as caster and spawns in a mage hand token with fx
                    case 'cast':
                        basicCast(casterSendAs,spellData,castAtLevel,acid,pageId,layer,x,y)
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
                switch (cmd) {
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
                // make sure we have a character set up to spawn in
                const sw = findSpellCharacter()
                if (sw === undefined) return;

                switch (cmd) {
                    // the cast here will spawn in the spiritual weapon
                    // the spiritual weapon sheet should be leveled when characters increase proficiency bonus
                    case 'cast':
                        // confirm the caster has the slot available
                        await spiritualWeaponCast(casterSendAs,spellData,castAtLevel,sw,pageId,layer,x,y, "glow-holy")
                        return;

                    case 'dismiss':
                        spiritualWeaponDismiss(sw, "nova-holy")
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