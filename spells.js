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
*
* The framework allows for easy extensibility either through additional actions or arguments.
*
* For instance, you could check for overlapping tokens with the acid splash cantrip and roll their dex saves
*
*/


// The actual spells available, this map serves as a registry of spells
// name - string - the spell
// template_width/template_height - number - the width/height of the spell template
const spells = new Map([
    /*
    **************************************CANTRIPS********************************************
     */
    ["acid-splash", {"name":"Acid Splash", "template_width": 140, "template_height": 140}],
    ["mage-hand", {"name":"Mage Hand", "template_width": 70, "template_height": 70}],
    ["create-bonfire", {"name":"Create Bonfire", "template_width": 70, "template_height": 70}],

    /*
    **************************************2nd Level********************************************
     */
    ["spiritual-weapon", {"name":"Spiritual Weapon", "template_width": 70, "template_height": 70}],

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
        const [, action, spell] = command.trim().split(/\s+/);

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

        /*
        **********************CASTER/SPELL TEMPLATE INFO****************************
         */

        // caster info (or the spell token for spell actions/dismissal)
        const casterToken = getObj('graphic', msg.selected[0]._id)
        const casterTokenId = casterToken.get("_id")
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

        const setupToken = (token, disableSnapping=true) => {
            token.toFront()
            token.set("disableSnapping", disableSnapping)
            token.set("disableTokenMenu", true)
            token.set("tooltip", casterToken.get("name"))
            token.set("show_tooltip", true)
            token.set("bar1_value", casterTokenId)
            token.set("bar1_num_permission", "hidden")
            token.set("bar2_value", casterCharacter)
            token.set("bar2_num_permission", "hidden")
        }

        // basic spawn helper - simply pops the character's default token or a token using their avatar near the caster
        const spawnBasic = (obj,pageid,layer,x,y, disableSnapping=false)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'},(token)=>{
                    setupToken(token, disableSnapping)
                });
            }
        };

        // spawn helper for a token representing a spiritual weapon
        // in addition to the basic spawn helper, this function also sets the strength of the token to 10 + (mod * 2)
        // mod is the spellcasting ability modifier of the caster
        // this allows an attack to be added to the token's sheet that dynamically updates based on caster
        const spawnSpiritualWeapon = (obj,pageid,layer,x,y,mod,pb,side,disableSnapping=false)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'}, async (token) => {
                    token.set("currentSide", side)
                    setupToken(token, disableSnapping)
                    let newStrength = 10 + ((mod+pb) * 2)
                    let newDexterity = 10 + (mod * 2)
                    await setSheetItem(token.get("represents"), "strength", newStrength)
                    await setSheetItem(token.get("represents"), "dexterity", newDexterity)
                });
            }
        };

        const spawnCreateBonfire = (obj,pageid,layer,x,y,mod, disableSnapping=false)=>{
            if(obj?.type === 'character'){
                obj.createToken({pageid,layer,left:x,top:y},{multisided:'ensure'}, async (token) => {
                    setupToken(token, disableSnapping)
                    let newStrength = 10 + (mod * 2)
                    await setSheetItem(token.get("represents"), "strength", newStrength)
                });
            }
        };

        const basicCast = (spellCharacter,pageId,layer,x,y, fx = "none", disableSnapping=false)=>{
            if(fx !== "none"){
                spawnFx(x, y, fx)
            }
            spawnBasic(spellCharacter, pageId, layer, x, y, disableSnapping)
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

        const spiritualWeaponCast = async (spellCharacter,pageId,layer,x,y,side, disableSnapping=false) => {
            // to dynamically update the weapon
            const casterSpellcastingAbility = await getSheetItem(casterToken.get("represents"), "spellcasting_ability")
            const casterSpellcastingMod = parseInt(casterSpellcastingAbility.slice(0,-1))
            const casterProficiency = await getSheetItem(casterToken.get("represents"), "pb")
            const casterPB = parseInt(casterProficiency)
            spawnFx(x, y, "glow-holy")
            spawnSpiritualWeapon(spellCharacter, pageId, layer, x, y, casterSpellcastingMod, casterPB, side, disableSnapping)
        }

        const spiritualWeaponDismiss = async (spellCharacter) => {
            basicDismiss(spellCharacter, "nova-holy")
            await setSheetItem(casterToken.get("represents"), "strength", 10)
            await setSheetItem(casterToken.get("represents"), "dexterity", 10)
        }

        const castCreateBonfire = async (cb,pageId,layer,cbX,cbY) => {
            const casterSpellcastingAbility = await getSheetItem(casterToken.get("represents"), "spellcasting_ability")
            const casterSpellcastingMod = parseInt(casterSpellcastingAbility.slice(0,-1))
            const casterProficiency = await getSheetItem(casterToken.get("represents"), "pb")
            const casterPB = parseInt(casterProficiency)
            let mod = casterSpellcastingMod + casterPB
            spawnFx(cbX,cbY,'burn-fire')
            spawnCreateBonfire(cb,pageId,layer,cbX,cbY,mod)
        }

        const dismissCreateBonfire = async (spellCharacter) => {
            basicDismiss(spellCharacter, "explode-smoke")
            await setSheetItem(casterToken.get("represents"), "strength", 10)
        }


        /*
        ***********************************SPELL LOGIC*********************************************
        */


        switch (spell) {

            /*
            ***********************************CANTRIPS*********************************************
            */

            /*
            **********************************************************************************************************
            *************************************************Acid Splash**********************************************
            **********************************************************************************************************
            */
            case 'acid-splash':
                // the find function notifies the gm on failure so we can just return if nothing is found
                const acid = findSpellCharacter()
                if (acid === undefined) return;

                let acidX = casterRight + (spells.get(spell).template_width / 2)
                let acidY = casterTop - (spells.get(spell).template_height / 2)

                //Acid Splash uses cast and trigger, leveraging the basic cast and dismiss functions
                switch (action) {
                    //sends a chat as caster and spawns in a mage hand token with fx
                    case 'cast':
                        basicCast(acid,pageId,layer,acidX,acidY, "none", true)
                        return;
                    // trigger the actual ability
                    case 'trigger':
                        let owner = casterToken.get("bar2_value")
                        let ability = findObjs({ _type: 'ability', _characterid: owner, name:"Acid_Splash"})[0]
                        if(!ability){
                            whisperBack(`Acid Splash ability not found for ${casterToken.get("name")}`)
                        } else {
                            sendChat(casterSendAs, `${ability.get("action")}`)
                        }
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
                        basicCast(mh,pageId,layer,x,y, 'glow-magic')
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
             *************************************************CREATE BONFIRE********************************************
             ***********************************************************************************************************/
            case 'create-bonfire':

                let cbX = casterRight + (spells.get(spell).template_width / 2)
                let cbY = y

                const cb = findSpellCharacter()
                if (cb === undefined) return;

                switch (action) {
                    case 'cast':
                        await castCreateBonfire(cb,pageId,layer,cbX,cbY)
                        return;
                    case 'trigger':
                        spawnFx(x,y,'burn-fire')
                        sendChat(casterSendAs,`%{${cb.get('name')}|Bonfire}`)
                        return;
                    case 'dismiss':
                        basicDismiss(cb, 'explode-smoke')
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
                        await spiritualWeaponCast(sw,pageId,layer,x,y,side)
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

