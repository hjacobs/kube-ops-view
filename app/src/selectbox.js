const PIXI = require('pixi.js')

export default class SelectBox extends PIXI.Graphics {
    constructor(items) {
        super()
        this.items = items
        this.count = 0
        this.text = new PIXI.Text(this.items[this.count].text, {
            fontFamily: 'ShareTechMono',
            fontSize: 14,
            fill: 0xaaaaff,
            align: 'center'
        })
        this.text.x = 10
        this.text.y = 10
        this.addChild(this.text)
    }

    onForwardPressed() {
        const selectBox = this
        if (selectBox.count + 1 < this.items.length) {
            selectBox.count++
        } else {
            selectBox.count = 0
        }
        selectBox.text.text = selectBox.items[selectBox.count].text
    }

    onBackPressed() {
        const selectBox = this
        if (selectBox.count - 1 > 0) {
            selectBox.count--
        } else {
            selectBox.count = selectBox.items.length - 1
        }
        selectBox.text.text = selectBox.items[selectBox.count].text
    }

    draw() {
        const selectBox = this

        const backArrow = new PIXI.Graphics()
        const forwardArrow = new PIXI.Graphics()
        backArrow.interactive = true
        forwardArrow.interactive = true
        selectBox.interactive = true
        // set a fill and line style

        // draw a triangle
        backArrow.lineStyle(2, 0x000000, 1)
        backArrow.beginFill(0x1b7c87, 0.5)
        backArrow.moveTo(0, 2)
        backArrow.lineTo(-20, 15)
        backArrow.lineTo(0, 28)
        backArrow.lineTo(0, 2)
        backArrow.endFill()
        selectBox.addChild(backArrow)
        selectBox.lineStyle(2, 0x000000, 1)
        selectBox.beginFill(0x1b7c87, 0.5)
        selectBox.drawRoundedRect(4, 0, 100, 30, 10)
        selectBox.endFill()

        forwardArrow.lineStyle(2, 0x000000, 1)
        forwardArrow.beginFill(0x1b7c87, 0.5)
        forwardArrow.moveTo(108, 2)
        forwardArrow.lineTo(128, 15)
        forwardArrow.lineTo(108, 28)
        forwardArrow.lineTo(108, 2)
        forwardArrow.endFill()
        selectBox.addChild(forwardArrow)

        backArrow.on('mousedown', selectBox.onBackPressed.bind(this))
        backArrow.on('touchstart', selectBox.onBackPressed.bind(this))
        forwardArrow.on('mousedown', selectBox.onForwardPressed.bind(this))
        forwardArrow.on('touchstart', selectBox.onForwardPressed.bind(this))

        return selectBox
    }

}

