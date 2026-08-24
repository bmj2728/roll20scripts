# roll20scripts

A collection of Roll20 API (Mod) scripts for game management. Paste the contents of a file into a new script in your game's **Mod (API) Scripts** page and save. All commands are chat commands; some operate on the currently selected token(s), others on the party.

> **Note:** API scripts require a Roll20 subscription tier that includes API access (Pro, or a game owned by a Pro user).

## Scripts at a glance

| Script | Command | Depends on |
|---|---|---|
| [chatCards.js](#chatcardsjs--chatcards) | *(library — no commands)* | — |
| [conditions.js](#conditionsjs--cond) | `!cond` | — |
| [hp.js](#hpjs--hp) | `!hp` | — |
| [partyman.js](#partymanjs--pm) | `!pm` | `chatCards.js` |
| [passiveCheck.js](#passivecheckjs--pcheck) | `!pcheck` | `chatCards.js`, `partyman.js` |
| [statRoller.js](#statrollerjs--rollstats) | `!rollstats` | — |
| [whimsy.js](#whimsyjs--whimsy) | `!whimsy` | — |

Roll20 evaluates every script into one shared sandbox namespace, so the shared code is organized into IIFE namespaces (`ChatCards`, `PartyMan`, `PassiveCheck`) that each expose a single global and keep their helpers private. Cross-namespace references happen inside function bodies, at call time — so **script load order does not matter**.

---

## chatCards.js — `ChatCards`

A dependency-free library for the styled chat cards the other scripts share: a title bar over a table of rows. It has no chat commands of its own — install it because something else needs it, or to build your own output on it.

Keeping the styling in one theme object means every tool built on it stays visually consistent, and a palette change lands everywhere at once.

### `ChatCards.THEME`

| Key | Applies to |
|---|---|
| `card` | The outer card container |
| `header` | The title bar |
| `table` | The row table |
| `cell` | A default cell |
| `cellNum` | A right-aligned bold cell (scores, totals) |
| `avatarCell` / `avatar` | The narrow avatar cell and the `<img>` in it (small, for data rows) |
| `avatarCellLg` / `avatarLg` | Larger avatar variant, for rows acting as section headers |
| `name` / `nameLg` | Name cell in the matching sizes (`nameLg` is bigger and bold) |
| `good` / `bad` | Semantic verdict cells — green/red bold (pass/fail, gain/loss) |
| `muted` | De-emphasized footnote text |
| `button` | Chat buttons (`<a>` styled as a button) |
| `tileRow`, `tile`, `tileLabel`, `tileValue`, `tileMod` | The stat-tile strip (see `Card.tiles`) |

Scripts building on ChatCards should speak in THEME keys rather than literal style strings.

### `ChatCards.Card`

| Member | What it does |
|---|---|
| `new ChatCards.Card(title, [theme])` | Starts a card; pass a theme object to override the shared `THEME` |
| `.addRow(...cells)` | Appends a row — chainable |
| `ChatCards.Card.num(value)` | *(static)* Wraps a value as a right-aligned bold cell |
| `ChatCards.Card.span(content, span, [style])` | *(static)* Wraps content as a cell spanning `span` columns — for full-width rows inside a wider table |
| `ChatCards.Card.tiles(tiles, [theme])` | *(static)* Renders a strip of stat tiles: `[{label, value, sub?}]`, label over value over optional sub-line, equal widths |
| `.render()` | Returns the card's HTML |
| `.whisperGM([from])` | Whispers the rendered card to the GM |
| `.send([from])` | Sends the rendered card to public chat |

A cell is either a plain value (rendered with `THEME.cell`) or an object `{ content, style, span? }`, where `style` is a THEME key such as `'cellNum'` or a raw CSS string.

### Example

```js
const card = new ChatCards.Card("Treasure Split")
card.addRow("Ohi Saiweau", ChatCards.Card.num("120 gp"))
    .addRow("Rondez the Green Mage", ChatCards.Card.num("120 gp"))
card.whisperGM("PartyFund")
```

A tile strip under a two-column row (this is how the Party Roster draws ability scores):

```js
card.addRow(ChatCards.Card.span(ChatCards.Card.tiles([
    { label: "STR", value: 16, sub: "+3" },
    { label: "DEX", value: 13, sub: "+1" },
    // ...
]), 2))
```

> **Roll20 rendering note:** the tile strip is an inner `<table>`, not flexbox — Roll20's chat sanitizer strips `display:flex`, which collapses flex tiles into stacked full-width rows. Table cells survive the sanitizer, and `table-layout:fixed` keeps them equal-width all the way down to the narrowest chat pane. Keep this in mind for any custom layout you build on ChatCards.

---

## conditions.js — `!cond`

A CondSync-safe condition handler that adds or removes status markers on selected tokens without clobbering markers set by other means.

### Usage

Select one or more tokens, then:

| Command | Effect |
|---|---|
| `!cond +<marker>` | Add a status marker to the selected token(s) |
| `!cond -<marker>` | Remove a status marker from the selected token(s) |
| `!cond clear` | Remove **all** status markers from the selected token(s) |

`<marker>` is the marker's internal name (e.g. `sheet-blinded`, `red`, `dead`). Adding a marker that's already present is a no-op, as is removing one that isn't there. Feedback for errors (no tokens selected) is whispered to the GM.

### Examples

```
!cond +sheet-blinded
!cond -sheet-blinded
!cond clear
```

### Suggested macros

Create token-action macros for the conditions you use most:

```
Blind:      !cond +sheet-blinded
Unblind:    !cond -sheet-blinded
ClearCond:  !cond clear
```

This example uses the D&D 2024 sheet's marker set:

```
!cond ?{Condition|Blinded,+sheet-blinded|Charmed,+sheet-charmed|Deafened,+sheet-deafened|Exhausted,+sheet-exhausted|Frightened,+sheet-frightened|Grappled,+sheet-grappled|Incapacitated,+sheet-incapacitated|Invisible,+sheet-invisible|Paralyzed,+sheet-paralyzed|Petrified,+sheet-petrified|Poisoned,+sheet-poisoned|Prone,+sheet-prone|Restrained,+sheet-restrained|Stunned,+sheet-stunned|Unconscious,+sheet-unconscious|— CLEAR ALL —,clear}
```

---

## hp.js — `!hp`

A minimal, promise-based HP writer for **D&D 2024 sheets**. Writes to the character sheet's `hp` attribute via `getSheetItem` / `setSheetItem`, so it works with the modern sheetworker-backed sheets rather than raw token bars.

### Usage

Select one or more tokens (each must represent a character), then:

| Command | Effect |
|---|---|
| `!hp +7` | Heal 7 (relative change) |
| `!hp -5` | Damage 5 (relative change) |
| `!hp 25` | Set HP to exactly 25 (absolute) |

Results (or failures) are whispered to the GM per token, e.g. `Goblin: hp → 18`.

### Examples

```
!hp -?{Damage|1}
!hp +?{Healing|1}
!hp ?{Set HP to|10}
```

### Suggested macros

Token-action macros for quick combat bookkeeping:

```
Damage:  !hp -?{Amount}
Heal:    !hp +?{Amount}
SetHP:   !hp ?{New HP}
```

### Planned / TODO

- Consume temp HP (bar2) before applying damage to the real pool
- Keep token bars in sync
- Clamp to 0
- Whisper early-return reasons for better error visibility
- Targeting: `!hp --target <token_id> -5` for a specific token instead of the selection
- Possibly render results as a `ChatCards.Card` (would add a dependency to an otherwise standalone script)

(The file also contains a commented-out temp-HP example from the Roll20 API docs for reference.)

---

## partyman.js — `!pm`

**PartyMan** — the party data layer. Originally planned as a pile of heuristics to identify party members, but the character object now carries an `inParty` flag, so it simply queries that. Other scripts (Passive Check, and anything else party-shaped) build on it.

The flagship view is the Party Roster: each member as a header row (large avatar + name) over a strip of ability-score tiles, character-sheet style.

![Party Roster card](assets/pm-roster.png)

> **Requires:** `chatCards.js`.

### `PartyMan` namespace

| Member | What it does |
|---|---|
| `getParty()` | Returns the raw character objects flagged `inParty: true` |
| `getMembers()` | Wraps each party character in a `Member` — the cheap path when you don't need token or score syncs |
| `Member` | Snapshot of one party character: `id`, `characterName`, `characterSheet`, `controlledBy`, `avatar`, `defaultToken`, `abilityScores`, plus `syncDefaultToken()` and `syncAbilityScores()` |
| `MemberAbilityScores` | One member's six scores; `syncScores()` loads them from the sheet concurrently, `getAbilityMod()` / `getAbilityModText()` derive modifiers, `abilityScoreCells(span)` renders the tile strip |
| `Party` | Builds the member list and kicks off a default-token sync for each member; `syncParty()` refreshes the list and loads every member's scores (concurrently across the whole party) |
| `memberCells(member, [size])` | Returns the avatar + name cells for a `ChatCards.Card` row — `'sm'` (default) for dense data rows, `'lg'` for section-header rows like the roster |

`Member.syncDefaultToken()` returns a Promise, since Roll20 only exposes `_defaulttoken` through a callback. Sync methods await their sheet reads properly, so `await party.syncParty()` guarantees populated scores afterwards.

`memberCells` is the seam between the party data and the card renderer: spread it into a row, then append whatever the calling script needs.

```js
const card = new ChatCards.Card("Passive Check — Insight")
for (const member of PartyMan.getMembers()) {
    card.addRow(...PartyMan.memberCells(member), ChatCards.Card.num(score))
}
card.whisperGM("Passive Check")
```

On sandbox start PartyMan syncs the party once and caches it, so `!pm party` responds instantly; `!pm refresh` re-syncs after the roster or sheets change.

### Usage

| Command | Effect |
|---|---|
| `!pm party` | Post the Party Roster card (from the startup cache) |
| `!pm refresh` | Re-sync the cached party — run after adding/removing members or editing ability scores |

No token selection required — membership comes from the characters' `inParty` flag. On sandbox start PartyMan also posts a Party Man card with a Display Party button.

### Suggested macros

```
Party:        !pm party
PartyRefresh: !pm refresh
```

Or just click the button PartyMan posts to chat when the sandbox spins up.

---

## passiveCheck.js — `!pcheck`

**Passive Check** — reads the party's passive score for **any of the 18 skills** from their **D&D 2024 sheets** (the sheet's `<skill>_bonus` attribute plus a base 10) and whispers the results to the GM as a card. No token selection needed — the party comes from PartyMan — so it's ideal for quietly checking whether anyone notices the ambush, or for a group passive Stealth against the guards' passive Perception.

Pass an optional DC to get a Success/Failure verdict per member (score ≥ DC succeeds), colored green/red via the ChatCards `good`/`bad` theme keys — color for the glance, word for certainty. Without a DC you get the raw scores.

![Passive Check output — raw scores](assets/pcheck-perception.png)

![Passive Check output — with DC](assets/pcheck-dc.png)

> **Requires:** `chatCards.js` and `partyman.js`.

### Usage

| Command | Effect |
|---|---|
| `!pcheck <skill>` | Whisper each party member's passive score for that skill to the GM |
| `!pcheck <skill> <dc>` | Same, plus Success/Failure per member vs the DC (e.g. `!pcheck insight 12`) |
| `!pcheck help` | Whisper the help card back to whoever asked |

`<skill>` is any of the 18 skills:

```
acrobatics        deception       intimidation    nature          religion
animal handling   history         investigation   perception      sleight of hand
arcana            insight         medicine        performance     stealth
athletics                                                         survival
```

Skill names are forgiving: case-insensitive, and spaces, underscores, or hyphens all work — `Sleight of Hand`, `sleight_of_hand`, and `sleight-of-hand` are the same check, so `?{...}` macro labels can stay readable. Multi-word skills parse correctly alongside a DC (`!pcheck sleight of hand 12`).

Results always go to the GM; help and error messages are whispered back to the sender, so a player's typo doesn't broadcast the GM's toolkit to the table. An unparseable DC (e.g. `!pcheck insight potato`) whispers a warning and falls back to the raw-score card. If the sheet has no usable value for a skill, that member's score shows as `—` rather than `NaN`.

### Examples

```
!pcheck perception
!pcheck insight 12
!pcheck sleight of hand 15
```

### Suggested macros

All 18 skills in one prompted macro:

```
Passives: !pcheck ?{Check Type|Acrobatics, acrobatics|Animal Handling, animal_handling|Arcana, arcana|Athletics, athletics|Deception, deception|History, history|Insight, insight|Intimidation, intimidation|Investigation, investigation|Medicine, medicine|Nature, nature|Perception, perception|Performance, performance|Persuasion, persuasion|Religion, religion|Sleight of Hand, sleight_of_hand|Stealth, stealth|Survival, survival} ?{DC}
```

Enter a number at the DC prompt for pass/fail; leaving it blank falls back to the raw-score card (possibly with an "Invalid DC" nudge, depending on how chat trims the blank).

If a full dropdown is more than you want at the table, the three you'll reach for most:

```
Passives: !pcheck ?{Check Type|Perception, perception|Insight, insight|Investigation, investigation} ?{DC}
```

Or skip the prompt entirely for a check you run often — a group sneak against the guards, say:

```
GroupStealth: !pcheck stealth ?{Enemy passive Perception|10}
```

### How the lookup works

Supported skills are one list inside the `PassiveCheck` namespace, and the sheet attribute is derived from it rather than mapped:

```js
const SKILLS = ['acrobatics', 'animal_handling', 'arcana', /* ... */ 'stealth', 'survival']

const bonus = await getSheetItem(charId, `${skill}_bonus`)
```

The type guard, the help card, and the sheet read all come from that one list, so there's nothing per-skill to maintain. This relies on the 2024 sheet naming every skill bonus as `<skill>_bonus` — verified against the sheet, including the multi-word ones.

---

## statRoller.js — `!rollstats`

Rolls a full set of six ability scores using the classic **4d6 drop lowest** method and posts the results to chat in a roll template, attributed to whoever ran the command.

### Usage

| Command | Effect |
|---|---|
| `!rollstats` | Roll 6 ability scores (4d6 drop lowest each) and post them |

No token selection required. Output shows each stat's total, the four dice rolled (the dropped low die shown struck through), and the grand total of all six scores — handy for comparing arrays at session zero.

### Suggested macros

```
RollStats: !rollstats
```

Make it visible to all players so everyone rolls in the open.

---

## whimsy.js — `!whimsy`

**WhimsyName** — prefixes selected tokens with a unique random adjective drawn from a ~900-word pool ("The Corpus"). Great for telling apart a pile of identical goblins: *Soggy Goblin*, *Majestic Goblin*, *Sniveling Goblin*.

Adjectives are never repeated while in play: each one in use is held out of the pool (tracked in persistent `state`, so it survives sandbox restarts). Whimsying an already-whimsied token **rerolls** it — the new adjective replaces the old one (never stacks), and the old adjective goes back in the pool. Deleting a whimsied token returns its adjective too, so The Corpus only ever holds out adjectives that are actually on the table.

### Usage

| Command | Effect |
|---|---|
| `!whimsy` | Prefix each selected token with a unique adjective (or reroll it) |
| `!whimsy token` | Same, but base the name on the token's nameplate instead of the sheet |
| `!whimsy reset` | Return all adjectives to the pool |
| `!whimsy count` | Whisper to the GM how many adjectives remain |

If the pool runs dry, the script whispers `The Corpus is exhausted` and suggests a reset.

### Where the base name comes from

Per token, in order: the name WhimsyName recorded the first time it touched this token (this is what makes rerolls clean); with `token`, the current nameplate; otherwise the represented character's sheet name — compendium drops always set `represents`, so a rerolled goblin stays a *Goblin* even after three adjectives have come and gone; and finally the nameplate, for tokens with no (or a dangling) `represents`.

> **Disguise caveat:** the default path reads the *sheet* name. A token deliberately nameplated differently from its character — a disguised PC — should get `!whimsy token`, or the reveal is on you.

### Examples

Select a group of freshly dropped mook tokens, then:

```
!whimsy
```

Don't like what the dice gave your boss goblin? Select just that token and run it again — *Soggy* goes back in the pool and something new comes out.

### Suggested macros

```
Whimsy:      !whimsy ?{Name from|Sheet,|Token,token}
WhimsyReset: !whimsy reset
WhimsyCount: !whimsy count
```

`Whimsy` works well as a token action so you can name mobs the moment you place them — the prompt collapses to the normal sheet path unless you pick Token.

---

## Installation

1. In your Roll20 game (as the creator, with API access), go to **Settings → Mod (API) Scripts**.
2. Click **New Script**, name it after the file (e.g. `whimsy.js`), and paste the file's contents.
3. **Save Script**. The sandbox restarts and the command is live in chat.
4. Repeat for any script the one you want depends on — see the dependency column in [Scripts at a glance](#scripts-at-a-glance).

Tab order doesn't matter: everything runs inside `on('ready')` or resolves its dependencies at call time.

## Conventions

A few habits that keep these playing nicely in Roll20's shared sandbox:

- **One global per script.** Shared code is wrapped in an IIFE that returns a namespace object (`ChatCards`, `PartyMan`, `PassiveCheck`); helpers that aren't part of the public surface stay private. Bare constants that must live at top level get a script prefix instead (`WHIMSY_ADJECTIVES`, `PASSIVES_HELP_TEXT`).
- **Styling is data.** Card styles live in `ChatCards.THEME`, not in the functions that build the markup — including semantic keys (`good`/`bad`) so meaning and color stay decoupled.
- **Reference across namespaces at call time**, never at evaluation time — that's what keeps load order irrelevant.
- **Whisper by audience.** Results the GM shouldn't share go to the GM; help and error text goes back to the person who typed the command.
- **Layout with tables, not flex.** Roll20's chat sanitizer strips `display:flex`; inner tables with `table-layout:fixed` are what actually survive, at every chat width.
- **Fetch only what the command needs.** Passive Check builds its member list with `getMembers()` rather than `new Party()`, skipping default-token fetches it would never use.
