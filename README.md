# roll20scripts

A small collection of Roll20 API (Mod) scripts for game management. Each script is standalone — paste the contents of the file into a new script in your game's **Mod (API) Scripts** page and save. All commands are chat commands and most operate on the currently selected token(s).

> **Note:** API scripts require a Roll20 subscription tier that includes API access (Pro, or a game owned by a Pro user).

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
- Whisper early-return reasons for better error visibility
- Targeting: `!hp --target <token_id> -5` for a specific token instead of the selection

(The file also contains a commented-out temp-HP example from the Roll20 API docs for reference.)

---

## partyman.js — `!pm`

**PartyMan** — party membership utilities. Originally planned as a pile of heuristics to identify party members, but the character object now carries an `inParty` flag, so it simply queries that. Right now it's mostly the home of the `getParty()` helper, which other scripts (like Passive Check) build on:

```js
const getParty = () => findObjs({ _type: "character", inParty: true });
```

On sandbox start it also posts example HTML- and Markdown-styled chat buttons that run `!pm party`.

### Usage

| Command | Effect |
|---|---|
| `!pm party` | List the current party members in chat |

No token selection required — membership comes from the characters' `inParty` flag.

### Suggested macros

```
Party: !pm party
```

Or just click one of the buttons PartyMan posts to chat when the sandbox spins up.

---

## passiveWisdom.js — `!pcheck`

**Passive Check** — reads the party's passive Perception, Insight, or Investigation from their **D&D 2024 sheets** (via `getSheetItem` on the relevant `*_bonus`, plus the base 10). Uses PartyMan's `getParty()` to find the party, so no token selection is needed — perfect for secretly checking whether anyone notices that ambush.

> **Requires:** `partyman.js` must also be installed (it provides `getParty()`).

### Usage

| Command | Effect |
|---|---|
| `!pcheck perception` | Post each party member's passive Perception |
| `!pcheck insight` | Post each party member's passive Insight |
| `!pcheck investigation` | Post each party member's passive Investigation |
| `!pcheck help` | Show help text |

### Examples

```
!pcheck perception
!pcheck ?{Passive|perception|insight|investigation}
```

### Suggested macros

```
Passives: !pcheck ?{Check|perception|insight|investigation}
```

### Planned / TODO

- Optional DC argument returning pass/fail per member: `!pcheck insight 16`
- Real (HTML) help text

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

Adjectives are never repeated: each one used is removed from the pool (tracked in persistent `state`, so it survives sandbox restarts) until you reset it.

### Usage

| Command | Effect |
|---|---|
| `!whimsy` | Prefix each selected token's name with a unique random adjective |
| `!whimsy reset` | Return all adjectives to the pool |
| `!whimsy count` | Whisper to the GM how many adjectives remain |

If the pool runs dry, the script whispers `The Corpus is exhausted` and suggests a reset.

### Examples

Select a group of freshly dropped mook tokens, then:

```
!whimsy
```

### Suggested macros

```
Whimsy:      !whimsy
WhimsyReset: !whimsy reset
WhimsyCount: !whimsy count
```

`Whimsy` works well as a token action so you can name mobs the moment you place them.

---

## Installation

1. In your Roll20 game (as the creator, with API access), go to **Settings → Mod (API) Scripts**.
2. Click **New Script**, name it after the file (e.g. `whimsy.js`), and paste the file's contents.
3. **Save Script**. The sandbox restarts and the command is live in chat.

Scripts are independent — install only the ones you want — except `passiveWisdom.js`, which needs `partyman.js` alongside it.
