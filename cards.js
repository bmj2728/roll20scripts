//Cards - generic styled chat-card generation for Roll20 VTT. No dependencies.

/**
 * Cards namespace. Generic chat-card rendering with a shared theme — no party
 * (or any other domain) knowledge. Scripts with domain-specific rows provide
 * their own cell helpers (e.g. PartyMan.memberCells).
 *
 * @namespace Cards
 * @property {Object} THEME - Shared chat styling constants
 * @property {Class} Card - Chat-card builder
 */
const Cards = (() => {

    /*
    ***********************************************************************************
    ******************************Theme************************************************
    ***********************************************************************************
    */

    /**
     * Shared styling for chat output. All card styling lives here — scripts
     * building on Cards should speak in THEME keys, never literal styles.
     */
    const THEME = {
        card:       "border:1px solid #444;border-radius:6px;overflow:hidden;font-size:12px;",
        header:     "background:#2b2b3a;color:#fff;padding:4px 8px;font-weight:bold;",
        table:      "width:100%;border-collapse:collapse;",
        cell:       "padding:2px 6px;",
        cellNum:    "padding:2px 6px;text-align:right;font-weight:bold;",
        avatarCell: "width:28px;padding:2px;",
        avatar:     "width:24px;height:24px;border-radius:4px;",
        muted:      "color:#aaa;",
        button:     "background-color:#7e22ce;color:white;padding:5px 10px;border-radius:4px;text-decoration:none;font-weight:bold;"
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
     * const card = new Cards.Card("Passive Check — Insight")
     * for (const pm of party.members) {
     *     card.addRow(...PartyMan.memberCells(pm), Cards.Card.num(score))
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
                    return `<td style="${style}">${content}</td>`
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
         * @param {string} [from='Cards'] - Chat sender name.
         */
        whisperGM(from = "Cards") {
            sendChat(from, `/w gm ${this.render()}`)
        }

        /**
         * Sends the rendered card to public chat.
         *
         * @param {string} [from='Cards'] - Chat sender name.
         */
        send(from = "Cards") {
            sendChat(from, this.render())
        }
    }

    return { THEME, Card }
})()
