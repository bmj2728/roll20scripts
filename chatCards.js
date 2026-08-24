//ChatCards - generic styled chat-card generation for Roll20 VTT. No dependencies.

/**
 * ChatCards namespace. Generic chat-card rendering with a shared theme — no party
 * (or any other domain) knowledge. Scripts with domain-specific rows provide
 * their own cell helpers (e.g. PartyMan.memberCells).
 *
 * @namespace ChatCards
 * @property {Object} THEME - Shared chat styling constants
 * @property {Class} Card - Chat-card builder
 */
const ChatCards = (() => {

    /*
    ***********************************************************************************
    ******************************Theme************************************************
    ***********************************************************************************
    */

    /**
     * Shared styling for chat output. All card styling lives here — scripts
     * building on ChatCards should speak in THEME keys, never literal styles.
     */
    const THEME = {
        card:       "border:1px solid #444;border-radius:6px;overflow:hidden;font-size:12px;",
        header:     "background:#2b2b3a;color:#fff;padding:4px 8px;font-weight:bold;",
        table:      "width:100%;border-collapse:collapse;",
        cell:       "padding:2px 6px;",
        cellNum:    "padding:2px 6px;text-align:right;font-weight:bold;",
        avatarCell: "width:28px;padding:2px;",
        avatar:     "width:24px;height:24px;border-radius:4px;",
        avatarCellLg: "width:40px;padding:3px;",
        avatarLg:   "width:34px;height:34px;border-radius:5px;",
        name:       "padding:2px 6px;",
        nameLg:     "padding:4px 6px;font-size:14px;font-weight:bold;",
        muted:      "color:#aaa;",
        // Semantic verdict cells: pass/fail, up/down, gain/loss
        good:       "padding:2px 6px;color:#46a758;font-weight:bold;",
        bad:        "padding:2px 6px;color:#e5484d;font-weight:bold;",
        button:     "background-color:#7e22ce;color:white;padding:5px 10px;border-radius:4px;text-decoration:none;font-weight:bold;",
        // Stat tiles: a strip of small labeled values (ability scores, saves, coin).
        // Laid out as an inner table, NOT flex — Roll20's chat sanitizer strips
        // display:flex, which collapses flex tiles into full-width stacked rows.
        tileRow:    "width:100%;table-layout:fixed;border-collapse:separate;border-spacing:3px 2px;",
        tile:       "text-align:center;background:rgba(128,128,128,0.12);border:1px solid rgba(128,128,128,0.25);border-radius:4px;padding:3px 2px;",
        tileLabel:  "font-size:9px;letter-spacing:0.5px;color:#999;text-transform:uppercase;",
        tileValue:  "font-size:14px;font-weight:bold;line-height:1.2;",
        tileMod:    "font-size:10px;color:#999;"
    }

    /*
    ***********************************************************************************
    ******************************Card Generation**************************************
    ***********************************************************************************
    */

    /**
     * Builder for styled chat cards: a title bar followed by one table row per
     * entry.
     *
     * A cell is either a plain value (rendered with THEME.cell) or an object
     * `{ content, style }`, where `style` is a THEME key (e.g. 'cellNum') or
     * a raw CSS string.
     *
     * @example
     * const card = new ChatCards.Card("Passive Check — Insight")
     * for (const pm of party.members) {
     *     card.addRow(...PartyMan.memberCells(pm), ChatCards.Card.num(score))
     * }
     * card.whisperGM("Passive Check")
     */
    class Card {
        /**
         * @param {string} title - Text for the card's title bar.
         * @param {Object} [theme=THEME] - Style overrides; defaults to the shared THEME.
         */
        constructor(title, theme = THEME) {
            this.title = title
            this.theme = theme
            this.rows = []
        }

        /**
         * Appends one table row.
         *
         * @param {...(string|number|{content: *, style: string})} cells
         * @returns {Card} this, for chaining.
         */
        addRow(...cells) {
            this.rows.push(cells)
            return this
        }

        /**
         * Wraps a value as a right-aligned bold cell (scores, totals, gp).
         *
         * @param {*} content
         * @returns {{content: *, style: string}}
         */
        static num(content) {
            return { content, style: "cellNum" }
        }

        /**
         * Wraps content as a cell spanning multiple columns. Use for full-width
         * rows (a tile strip, a note) inside a table whose other rows have
         * more cells — mismatched column counts misalign the table otherwise.
         *
         * @param {*} content
         * @param {number} span - Number of columns to span.
         * @param {string} [style] - THEME key or raw CSS; defaults to THEME.cell.
         * @returns {{content: *, style: string, span: number}}
         */
        static span(content, span, style) {
            return { content, style, span }
        }

        /**
         * Renders a strip of stat tiles — small labeled values with an optional
         * sub-line (label over value over sub), sharing the row evenly. Wrap it
         * with Card.span to sit under a wider row:
         *
         *     card.addRow(ChatCards.Card.span(ChatCards.Card.tiles(stats), 2))
         *
         * Rendered as an inner single-row table rather than flexbox: Roll20's
         * chat sanitizer strips display:flex, which would stack the tiles
         * full-width. table-layout:fixed keeps the cells equal-width.
         *
         * @param {Array<{label: string, value: *, sub: *=}>} tiles
         * @param {Object} [theme=THEME]
         * @returns {string} HTML for the tile strip.
         */
        static tiles(tiles, theme = THEME) {
            const tds = tiles.map(t =>
                `<td style="${theme.tile}">` +
                `<div style="${theme.tileLabel}">${t.label}</div>` +
                `<div style="${theme.tileValue}">${t.value}</div>` +
                (t.sub !== undefined ? `<div style="${theme.tileMod}">${t.sub}</div>` : ``) +
                `</td>`
            ).join("")
            return `<table style="${theme.tileRow}"><tr>${tds}</tr></table>`
        }

        /**
         * Resolves a cell's style: undefined -> THEME.cell, a THEME key -> that
         * entry, anything else is treated as raw CSS.
         */
        resolveCellStyle(style) {
            if (style === undefined) return this.theme.cell
            return this.theme[style] !== undefined ? this.theme[style] : style
        }

        /**
         * Renders the card to an HTML string.
         *
         * @returns {string}
         */
        render() {
            const rows = this.rows.map(cells => {
                const tds = cells.map(cell => {
                    const isObj = cell !== null && typeof cell === "object"
                    const content = isObj ? cell.content : cell
                    const style = this.resolveCellStyle(isObj ? cell.style : undefined)
                    const span = (isObj && cell.span > 1) ? ` colspan="${cell.span}"` : ``
                    return `<td${span} style="${style}">${content}</td>`
                }).join("")
                return `<tr>${tds}</tr>`
            }).join("")

            return `<div style="${this.theme.card}">` +
                `<div style="${this.theme.header}">${this.title}</div>` +
                `<table style="${this.theme.table}">${rows}</table>` +
                `</div>`
        }

        /**
         * Whispers the rendered card to the GM.
         *
         * @param {string} [from='ChatCards'] - Chat sender name.
         */
        whisperGM(from = "ChatCards") {
            sendChat(from, `/w gm ${this.render()}`)
        }

        /**
         * Sends the rendered card to public chat.
         *
         * @param {string} [from='ChatCards'] - Chat sender name.
         */
        send(from = "ChatCards") {
            sendChat(from, this.render())
        }
    }

    return { THEME, Card }
})()
