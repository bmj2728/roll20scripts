# PartyCheck — design plan

Working document for the PartyCheck branch. PassiveCheck reads the sheet; **PartyCheck asks the players.** Same party plumbing, but a human is now in the middle, so the script becomes a small state machine that waits.

Built for hexploration group checks (survival, stealth) where the table's method is *average the totals and compare to DC* — but the RAW method ships as the default so the script travels.

---

## 1. The insight that shapes everything

`<skill>_bonus` on the 2024 sheet is the **same number** for both scripts:

- PassiveCheck: `10 + bonus`
- PartyCheck: `d20 + bonus`

So one cached value serves both. That's the argument for `MemberSkills` living in PartyMan rather than either check script: it isn't passive vocabulary or active vocabulary, it's **party vocabulary**.

Consequence: PassiveCheck stops hitting the sheet entirely and reads the cache. Its per-check sheet reads go from *N members* to *zero*.

---

## 2. Phase 0 — PartyMan: skills into the sync

### `MemberSkills`

Mirrors `MemberAbilityScores` exactly — same shape, same lifecycle, folded into the same sync.

```js
class MemberSkills {
    constructor(charId)          // this.member, this.skills = {}
    async syncSkills()           // Promise.all over SKILLS, populates this.skills
    getMod(skill)                // 5
    getModText(skill)            // '+5'
    skillCells(span)             // optional: tile strip, if we ever want a skills card
}
```

`Member` gains `this.skills = new MemberSkills(this.id)`; `Party.syncParty()` awaits both syncs concurrently per member.

### Shared skill vocabulary

Move out of PassiveCheck's IIFE and into PartyMan's public surface:

| Export | Was |
|---|---|
| `PartyMan.SKILLS` | `PassiveCheck` private array of 18 |
| `PartyMan.normalizeSkill(input)` | `PassiveCheck.normalize` |
| `PartyMan.skillDisplayName(skill)` | `PassiveCheck.displayName` |

PassiveCheck then consumes them and drops its copies. One source of truth for "what is a skill."

### The honest cost

18 reads × N members on every `syncParty()`. A 5-member party is ~90 concurrent sheet reads at sandbox start (plus the 6 ability scores each). All concurrent, once per start/refresh — but **measure it before committing.** If startup lags noticeably:

- **Lazy per-skill:** cache on first request for that skill, so a table that only ever uses stealth/survival pays for two.
- **Config'd subset:** a `TRACKED_SKILLS` list defaulting to the handful a campaign actually uses.

Staleness is the known Beacon problem — sheet writes fire no event (see README conventions). Skills change on level-up, not mid-session, so `!pm refresh` is the honest escape hatch. Lower risk than ability scores, which a belt can change mid-fight.

---

## 3. State machine

One active check. `state.PartyCheck`:

```js
{
    config: {
        resolution:    'raw',   // 'raw' = half or more succeed | 'avg' = average vs DC
        roundUp:       true,    // avg mode: Math.ceil(sum / count)
        showDC:        false,   // reveal the DC on the public request card
        publicRolls:   true,    // show roll values as they land, vs. progress only
        offline:       'gm',    // 'gm' = GM rolls for them | 'skip' = leave them out
        scope:         'party', // 'party' = everyone inParty | 'onPage' = only those with a token on the player page
    },
    active: null,   // or the check object below
    last:   null,   // the most recently resolved check, so the GM can re-post it
}
```

The active check:

```js
{
    skill:     'stealth',
    dc:        15,            // null = no verdict, just report the numbers
    startedBy: playerid,
    members: {
        [charId]: {
            name, avatar,
            mod:        5,
            assignedTo: [playerid, ...] | ['gm'],
            status:     'pending' | 'rolled' | 'removed',
            roll: null | { mode: 'normal'|'adv'|'dis', dice: [14, 7], natural: 14, total: 19 }
        }
    }
}
```

Persisting in `state` is deliberate: humans are slow, and a sandbox restart mid-check must not eat the party's rolls. The whispered buttons are just chat commands, so they keep working across a restart.

---

## 4. Who gets the button

```
controllers = member.controlledBy.split(',').filter(id => id && id !== 'all')
online      = controllers.filter(isOnline)

online.length      → assign to ALL online controllers (first click wins)
controllers, none online → config.offline: 'gm' → GM | 'skip' → status 'removed'
no controllers     → GM
```

- **`'all'` is ignored** — it would hand every player the button.
- **Multiple online controllers all get whispered**, first click wins. This is the "someone else is running the familiar" case falling out for free.
- **The GM can always click any button**, regardless of assignment.
- **`!partycheck assign <charId> <playerid>`** tags a controller in for this check only — the fix when a player is offline but someone at the table is running their character.

Every accepted roll verifies `msg.playerid` against `assignedTo` (or GM). The button is a *claim*, not an authorization.

---

## 5. Rolling

The whisper card is the agency moment: it shows the character, the skill, and **their mod**, then three buttons.

```
┌─────────────────────────────────────┐
│ Group Stealth — Kekha               │
│ Your Stealth: +5      [DC 15]       │   ← DC only if config.showDC
│  [ Roll ]  [ Advantage ]  [ Disadv ]│
└─────────────────────────────────────┘
```

Three buttons rather than a `?{}` query — one click, and the mode is visible rather than buried in a dropdown. Adv/dis rolls two d20 and keeps high/low; the result card shows **both dice with the dropped one struck through**, reusing statRoller's exact idiom so the whole toolkit reads the same.

Rules: first click is the roll — no take-backs (that's the commitment half of agency). Rolling into a closed check gets a polite "that check is already resolved." Group checks don't crit, so nat 20/1 get no special handling.

---

## 6. Flow

1. **`!partycheck start stealth 15`** — GM kicks off. Builds members from the party (per `config.scope`), resolves assignees, whispers buttons, posts the public request card listing who we're waiting on.
2. **Rolls land.** Each posts a compact public line — the value if `config.publicRolls`, otherwise just progress (`3 of 5 in`). Roll20 can't edit a sent message, so re-posting the whole card per roll would spam chat; the one-liner is the compromise.
3. **Auto-resolve** fires when the last pending member rolls.
4. **Or the GM calls it** — resolving with whoever is in, which is the "only 2 of 4 are sneaking" case. Everyone still pending is simply excluded from the math.

The running **sum** is available at any point; the **division waits** for resolution — that's the rule that makes partial resolve meaningful rather than a moving target.

### Result card

Per member: avatar, name, mod, dice detail, total — plus a `good`/`bad` verdict cell in RAW mode.

Footer by mode:

- **RAW:** `4 of 5 succeeded — Success` (half or more clears it)
- **Average:** `Sum 67 · Avg 14 · DC 13 — Success` (ceil per `config.roundUp`)

---

## 7. Commands

**Players** (button-driven; nobody types these)

| Command | Effect |
|---|---|
| `!partycheck roll <charId> <mode>` | Roll for a character you control |

**GM**

| Command | Effect |
|---|---|
| `!partycheck start <skill> [dc]` | Begin a check; no DC = report numbers, no verdict |
| `!partycheck call` | Resolve now with whoever has rolled |
| `!partycheck cancel` | Abandon, no result |
| `!partycheck nudge` | Re-whisper buttons to everyone still pending |
| `!partycheck reset <charId>` | Clear one member's roll so they roll again |
| `!partycheck remove <charId>` | Drop a member from this check |
| `!partycheck add <charId>` | Put a removed member back |
| `!partycheck assign <charId> <playerid>` | Tag a controller in for this check |
| `!partycheck menu` | Control panel |
| `!partycheck config <key> <value>` | Set a config value (menu buttons wrap this) |
| `!partycheck last` | Re-post the most recent result |

### The GM menu

Two states, one card:

- **Check live:** each member as a row — status, roll if in, with Reset / Remove / Assign buttons — plus Call It / Cancel / Nudge at the top.
- **No check live:** the config panel — one row per setting with a toggle or Set button, and a Start button carrying a skill+DC query.

**Resolve button naming.** "Resolve" is engineer-speak. Candidates: **Call It** (GM parlance, my pick), *Settle It*, *That's Enough*, *Lock It In*. Command stays `!partycheck call`.

---

## 8. Build order

| Phase | Scope | Done when |
|---|---|---|
| **0** | `MemberSkills` + skill vocabulary in PartyMan; PassiveCheck refactored onto the cache | `!pcheck` works with zero sheet reads per check |
| **1** | Core loop: start → whisper buttons → roll (incl. adv/dis) → auto-resolve → result card; both resolution modes | A full party check runs end to end |
| **2** | GM controls: call, cancel, nudge, reset, remove, add, assign | Partial resolve works at the table |
| **3** | Menu + config surface, `last`, polish | GM never types a charId |

Phase 0 ships independently and improves PassiveCheck on its own — worth merging before PartyCheck depends on it, so the cache is proven first.

---

## 9. Open questions

1. **Startup cost** — measure `syncParty()` with skills folded in before committing to eager caching.
2. **`config.scope: 'onPage'`** — needs `findObjs({_type:'graphic', _pageid: Campaign().get('playerpageid'), represents: charId})`. Worth it, or does `remove` cover it well enough by hand?
3. **Hidden DC + public rolls** — if the DC is hidden but rolls are public, players can still infer. Fine, or should hidden DC force quiet mode?
4. **Familiars in a group stealth** — Owliver has a stealth bonus and *should* probably count. Any case where a party member should be auto-excluded from checks generally?
5. **`last` retention** — keep just the previous check, or a short history like statRoller's?
