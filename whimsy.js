// WhimsyName - unique random adjective prefixes from The Corpus
// !whimsy        -> prefix all selected tokens (no repeats, ever, until reset)
// !whimsy reset  -> return all adjectives to the pool
// !whimsy count  -> how many adjectives remain
const WHIMSY_ADJECTIVES = [
    'Abandoned','Able','Absolute','Adorable','Adventurous','Academic','Acceptable','Acclaimed',
    'Accomplished','Accurate','Aching','Acidic','Acrobatic','Active','Actual','Adept','Admirable',
    'Admired','Adolescent','Adored','Advanced','Afraid','Affectionate','Aged','Aggravating',
    'Aggressive','Agile','Agitated','Agonizing','Agreeable','Ajar','Alarmed','Alarming','Alert',
    'Alienated','Alive','Altruistic','Amazing','Ambitious','Ample','Amused','Amusing','Anchored',
    'Ancient','Angelic','Angry','Anguished','Animated','Antique','Anxious','Apprehensive',
    'Appropriate','Apt','Arctic','Arid','Aromatic','Artistic','Ashamed','Assured','Astonishing',
    'Athletic','Attached','Attentive','Attractive','Austere','Authentic','Authorized','Automatic',
    'Avaricious','Average','Aware','Awesome','Awful','Awkward','Babyish','Bad','Baggy','Bare',
    'Barren','Basic','Beautiful','Beloved','Beneficial','Bewitched','Big','Big-hearted',
    'Biodegradable','Bite-sized','Bitter','Black','Black-and-white','Bland','Blank','Blaring',
    'Bleak','Blind','Blissful','Blond','Blue','Blushing','Bogus','Boiling','Bold','Bony','Boring',
    'Bossy','Bouncy','Bountiful','Bowed','Brave','Breakable','Brief','Bright','Brilliant','Brisk',
    'Broken','Bronze','Brown','Bruised','Bubbly','Bulky','Bumpy','Buoyant','Burdensome','Burly',
    'Bustling','Busy','Buttery','Buzzing','Calculating','Calm','Candid','Canine','Capital',
    'Carefree','Careful','Careless','Caring','Cautious','Cavernous','Celebrated','Charming','Cheap',
    'Cheerful','Cheery','Chilly','Chubby','Circular','Classic','Clean','Clear','Clear-cut','Clever',
    'Close','Closed','Cloudy','Clueless','Clumsy','Cluttered','Coarse','Cold','Colorful',
    'Colorless','Colossal','Comfortable','Common','Compassionate','Competent','Complex',
    'Complicated','Composed','Concerned','Concrete','Confused','Conscious','Considerate','Constant',
    'Content','Conventional','Cooked','Cool','Cooperative','Coordinated','Corny','Corrupt','Costly',
    'Courageous','Courteous','Crafty','Crazy','Creamy','Creative','Creepy','Criminal','Crisp',
    'Critical','Crooked','Crowded','Cruel','Crushing','Cuddly','Cultivated','Cultured','Cumbersome',
    'Curly','Curvy','Cute','Cylindrical','Damaged','Damp','Dangerous','Dapper','Daring','Darling',
    'Dark','Dazzling','Dead','Deadly','Deafening','Dear','Dearest','Decent','Decimal','Decisive',
    'Deep','Defenseless','Defensive','Defiant','Deficient','Definite','Definitive','Delectable',
    'Delicious','Delightful','Delirious','Demanding','Dense','Dental','Dependable','Dependent',
    'Descriptive','Deserted','Detailed','Determined','Devoted','Different','Difficult','Digital',
    'Diligent','Dim','Dimpled','Dimwitted','Direct','Disastrous','Discrete','Disfigured',
    'Disgusting','Disloyal','Dismal','Distant','Dreary','Dirty','Disguised','Dishonest','Distinct',
    'Distorted','Dizzy','Dopey','Doting','Drab','Drafty','Dramatic','Droopy','Dry','Dull','Dutiful',
    'Eager','Earnest','Easy','Easy-going','Ecstatic','Edible','Educated','Elaborate','Elastic',
    'Elated','Elderly','Electric','Elegant','Elementary','Elliptical','Embarrassed','Embellished',
    'Eminent','Emotional','Empty','Enchanted','Enchanting','Energetic','Enlightened','Enormous',
    'Enraged','Envious','Equal','Equatorial','Essential','Esteemed','Ethical','Euphoric','Even',
    'Evergreen','Everlasting','Evil','Exalted','Excellent','Exemplary','Exhausted','Excitable',
    'Excited','Exciting','Exotic','Expensive','Experienced','Expert','Extraneous','Extroverted',
    'Fabulous','Failing','Faint','Fair','Faithful','Fake','False','Familiar','Famous','Fancy',
    'Fantastic','Far','Faraway','Far-flung','Far-off','Fast','Fat','Fatal','Fatherly','Favorable',
    'Favorite','Fearful','Fearless','Feisty','Feline','Female','Feminine','Fickle','Filthy','Fine',
    'Finished','Firm','Fitting','Fixed','Flaky','Flamboyant','Flashy','Flat','Flawed','Flawless',
    'Flickering','Flimsy','Flippant','Flowery','Fluffy','Fluid','Flustered','Focused','Fond',
    'Foolhardy','Foolish','Forceful','Forked','Formal','Forsaken','Forthright','Fortunate',
    'Fragrant','Frail','Frank','Frayed','Free','French','Fresh','Friendly','Frightened',
    'Frightening','Frigid','Frilly','Frizzy','Frivolous','Frosty','Frozen','Frugal','Fruitful',
    'Full','Fumbling','Functional','Funny','Fussy','Fuzzy','Gargantuan','Gaseous','Generous',
    'Gentle','Genuine','Giant','Giddy','Gigantic','Gifted','Giving','Glamorous','Glaring','Glass',
    'Gleaming','Gleeful','Glistening','Glittering','Gloomy','Glorious','Glossy','Glum','Golden',
    'Good','Good-natured','Gorgeous','Graceful','Gracious','Grand','Grandiose','Granular',
    'Grateful','Grave','Gray','Great','Greedy','Green','Gregarious','Grim','Grimy','Gripping',
    'Grizzled','Gross','Grotesque','Grouchy','Grounded','Growing','Growling','Grown','Grubby',
    'Gruesome','Grumpy','Guilty','Gullible','Gummy','Hairy','Handmade','Handsome','Handy','Happy',
    'Happy-go-lucky','Hard','Hard-to-find','Harmful','Harmless','Harmonious','Harsh','Hasty',
    'Hateful','Haunting','Healthy','Heartfelt','Hearty','Heavenly','Heavy','Hefty','Helpful',
    'Helpless','Hidden','Hideous','High','High-level','Hilarious','Hoarse','Hollow','Homely',
    'Honest','Honorable','Honored','Hopeful','Horrible','Hospitable','Hot','Huge','Humble',
    'Humiliating','Humming','Humongous','Hungry','Hurtful','Husky','Icky','Icy','Ideal',
    'Idealistic','Identical','Idle','Idiotic','Idolized','Ignorant','Ill','Illegal','Ill-fated',
    'Ill-informed','Illiterate','Illustrious','Imaginary','Imaginative','Immaculate','Immaterial',
    'Immense','Impassioned','Impeccable','Impartial','Imperfect','Imperturbable','Impish',
    'Impolite','Important','Impractical','Impressionable','Impressive','Impure','Inborn',
    'Incomparable','Incompatible','Incomplete','Inconsequential','Incredible','Indelible',
    'Inexperienced','Indolent','Infamous','Infantile','Infatuated','Inferior','Infinite','Informal',
    'Innocent','Insecure','Insidious','Insignificant','Insistent','Instructive','Insubstantial',
    'Intelligent','Intent','Intentional','Interesting','Internal','International','Intrepid',
    'Ironclad','Irresponsible','Irritating','Itchy','Jaded','Jagged','Jam-packed','Jaunty',
    'Jealous','Jittery','Jolly','Jovial','Joyful','Joyous','Jubilant','Judicious','Juicy','Jumbo',
    'Junior','Jumpy','Juvenile','Kaleidoscopic','Keen','Kind','Kindhearted','Kindly','Klutzy',
    'Knobby','Knotty','Knowledgeable','Knowing','Known','Kooky','Kosher','Lame','Lanky','Large',
    'Lasting','Lavish','Lawful','Lazy','Leading','Lean','Leafy','Legal','Legitimate','Light',
    'Lighthearted','Likable','Limp','Limping','Linear','Lined','Liquid','Little','Live','Lively',
    'Livid','Loathsome','Lone','Lonely','Long','Loose','Lopsided','Lost','Loud','Lovable','Lovely',
    'Loving','Low','Loyal','Lucky','Lumbering','Luminous','Lumpy','Lustrous','Luxurious','Mad',
    'Made-up','Magnificent','Majestic','Male','Mammoth','Married','Marvelous','Masculine','Massive',
    'Mature','Meager','Mealy','Mean','Measly','Meaty','Medical','Mediocre','Meek','Mellow',
    'Melodic','Memorable','Menacing','Merry','Messy','Metallic','Mild','Milky','Mindless',
    'Miniature','Minty','Miserable','Miserly','Misguided','Misty','Mixed','Modern','Modest','Moist',
    'Monstrous','Monumental','Moral','Mortified','Motherly','Motionless','Mountainous','Muddy',
    'Muffled','Multicolored','Mundane','Murky','Mushy','Musty','Muted','Mysterious','Naive',
    'Narrow','Nasty','Natural','Naughty','Nautical','Near','Neat','Needy','Negative','Neglected',
    'Negligible','Neighboring','Nervous','New','Nice','Nifty','Nimble','Nippy','Nocturnal','Noisy',
    'Normal','Notable','Noted','Noteworthy','Novel','Noxious','Numb','Nutritious','Nutty',
    'Obedient','Obese','Oblong','Oily','Obvious','Odd','Oddball','Offbeat','Offensive','Official',
    'Old','Old-fashioned','Open','Optimal','Optimistic','Opulent','Orange','Orderly','Organic',
    'Ornate','Ornery','Ordinary','Original','Outlying','Outgoing','Outlandish','Outrageous',
    'Outstanding','Oval','Overcooked','Overjoyed','Overlooked','Palatable','Pale','Paltry',
    'Parallel','Parched','Passionate','Pastel','Peaceful','Peppery','Perfect','Perfumed','Perky',
    'Personal','Pertinent','Pesky','Pessimistic','Petty','Phony','Physical','Piercing','Pink',
    'Pitiful','Plain','Plaintive','Plastic','Playful','Pleasant','Pleased','Pleasing','Plump',
    'Plush','Polished','Polite','Political','Pointed','Pointless','Poised','Poor','Popular',
    'Portly','Posh','Positive','Potable','Powerful','Powerless','Practical','Precious',
    'Prestigious','Pretty','Pricey','Prickly','Primary','Prime','Pristine','Private','Prize',
    'Productive','Profitable','Profuse','Proper','Proud','Prudent','Punctual','Pungent','Puny',
    'Pure','Purple','Pushy','Putrid','Puzzled','Puzzling','Quaint','Qualified','Quarrelsome',
    'Queasy','Querulous','Questionable','Quick','Quick-witted','Quiet','Quintessential','Quirky',
    'Quixotic','Quizzical','Radiant','Ragged','Rapid','Rare','Rash','Raw','Reckless','Rectangular',
    'Ready','Real','Realistic','Reasonable','Red','Reflecting','Regal','Regular','Reliable',
    'Relieved','Remarkable','Remorseful','Remote','Repentant','Respectful','Responsible',
    'Repulsive','Revolving','Rewarding','Rich','Rigid','Ringed','Ripe','Roasted','Robust','Rosy',
    'Rotating','Rotten','Rough','Round','Rowdy','Royal','Rubbery','Rundown','Ruddy','Rude','Runny',
    'Rural','Rusty','Sad','Safe','Salty','Sandy','Sane','Sarcastic','Sardonic','Satisfied','Scaly',
    'Scarce','Scared','Scary','Scented','Scholarly','Scientific','Scornful','Scratchy','Scrawny',
    'Secondary','Secret','Self-assured','Self-reliant','Selfish','Sentimental','Separate','Serene',
    'Serious','Serpentine','Severe','Shabby','Shadowy','Shady','Shallow','Shameful','Shameless',
    'Sharp','Shimmering','Shiny','Shocked','Shocking','Shoddy','Short','Showy','Shrill','Shy',
    'Sick','Silent','Silky','Silly','Silver','Similar','Simple','Simplistic','Sinful','Sizzling',
    'Skeletal','Skinny','Sleepy','Slight','Slim','Slimy','Slippery','Slow','Slushy','Small','Smart',
    'Smoggy','Smooth','Smug','Snappy','Snarling','Sneaky','Sniveling','Snoopy','Sociable','Soft',
    'Soggy','Solid','Somber','Spherical','Sophisticated','Sore','Sorrowful','Soulful','Soupy',
    'Sour','Spanish','Sparkling','Sparse','Spectacular','Speedy','Spicy','Spiffy','Spirited',
    'Spiteful','Splendid','Spotless','Spotted','Spry','Square','Squeaky','Squiggly','Stable',
    'Staid','Stained','Stale','Standard','Starchy','Stark','Starry','Steep','Sticky','Stiff',
    'Stimulating','Stingy','Stormy','Straight','Strange','Steel','Strict','Strident','Striking',
    'Striped','Strong','Studious','Stunning','Stupendous','Stupid','Sturdy','Stylish','Subdued',
    'Submissive','Substantial','Subtle','Suburban','Sugary','Sunny','Super','Superb','Superficial',
    'Superior','Supportive','Sure-footed','Surprised','Suspicious','Svelte','Sweaty','Sweet',
    'Sweltering','Swift','Sympathetic','Tall','Talkative','Tame','Tan','Tangible','Tart','Tasty',
    'Tattered','Taut','Tedious','Teeming','Tempting','Tender','Tense','Tepid','Terrible','Terrific',
    'Testy','Thankful','Thick','Thin','Thirsty','Thorough','Thorny','Thoughtful','Threadbare',
    'Thrifty','Thunderous','Tidy','Tight','Tinted','Tiny','Tired','Torn','Tough','Traumatic',
    'Treasured','Tremendous','Tragic','Trained','Triangular','Tricky','Trifling','Trim','Trivial',
    'Troubled','True','Trusting','Trustworthy','Trusty','Truthful','Tubby','Turbulent','Twin',
    'Ugly','Ultimate','Unacceptable','Unaware','Uncomfortable','Uncommon','Unconscious',
    'Understated','Unequaled','Uneven','Unfinished','Unfit','Unfolded','Unfortunate','Unhappy',
    'Unhealthy','Uniform','Unimportant','Unique','United','Unkempt','Unknown','Unlawful','Unlined',
    'Unlucky','Unnatural','Unpleasant','Unrealistic','Unripe','Unruly','Unselfish','Unsightly',
    'Unsteady','Unsung','Untidy','Untried','Untrue','Unusual','Unwelcome','Unwieldy','Unwilling',
    'Unwitting','Unwritten','Upbeat','Upright','Upset','Urban','Useful','Useless','Vacant','Vague',
    'Vain','Valuable','Vapid','Vast','Velvety','Venerated','Vengeful','Vibrant','Vicious',
    'Victorious','Vigilant','Vigorous','Villainous','Violet','Violent','Virtual','Virtuous',
    'Visible','Vital','Vivacious','Vivid','Voluminous','Wan','Warlike','Warm','Warmhearted',
    'Warped','Wary','Wasteful','Watchful','Waterlogged','Watery','Wavy','Wealthy','Weak','Weary',
    'Webbed','Wee','Weepy','Weighty','Weird','Welcome','Well-groomed','Well-informed','Well-lit',
    'Well-made','Well-off','Well-to-do','Well-worn','Wet','Whimsical','Whirlwind','Whispered',
    'White','Whopping','Wicked','Wide','Wide-eyed','Wiggly','Wild','Willing','Wilted','Winding',
    'Windy','Winged','Wiry','Wise','Witty','Wobbly','Woeful','Wonderful','Wooden','Woozy','Wordy',
    'Worldly','Worn','Worried','Worrisome','Worthless','Worthwhile','Worthy','Wrathful','Wretched',
    'Writhing','Wrong','Wry','Yawning','Yellow','Yellowish','Young','Youthful','Yummy','Zany',
    'Zealous','Zesty','Zigzag'
];

on('ready', () => {
    if (!state.WhimsyName) state.WhimsyName = { used: {} };

    on('chat:message', msg => {
        if (msg.type !== 'api' || !/^!whimsy\b/i.test(msg.content)) return;

        const arg = (msg.content.split(/\s+/)[1] || '').toLowerCase();

        if (arg === 'reset') {
            state.WhimsyName.used = {};
            sendChat('Whimsy', '/w gm Adjective pool fully restored.');
            return;
        }
        if (arg === 'count') {
            const left = WHIMSY_ADJECTIVES.filter(a => !state.WhimsyName.used[a]).length;
            sendChat('Whimsy', `/w gm ${left} of ${WHIMSY_ADJECTIVES.length} adjectives remain.`);
            return;
        }

        if (!msg.selected || !msg.selected.length) {
            sendChat('Whimsy', '/w gm No tokens selected.');
            return;
        }

        msg.selected
            .filter(s => s._type === 'graphic')
            .map(s => getObj('graphic', s._id))
            .filter(t => t !== undefined)
            .forEach(t => {
                const pool = WHIMSY_ADJECTIVES.filter(a => !state.WhimsyName.used[a]);
                if (!pool.length) {
                    sendChat('Whimsy', '/w gm The Corpus is exhausted. !whimsy reset to replenish.');
                    return;
                }
                const adj = pool[randomInteger(pool.length) - 1];
                state.WhimsyName.used[adj] = true;
                t.set('name', `${adj} ${t.get('name')}`);
            });
    });
});