import { PRIMARY_VIOLET } from './colors.js'
import App from './app'

const PIXI = require('pixi.js')

export default class SelectBox extends PIXI.Graphics {
    constructor(items) {
        super()
        this.items = items
        this.count = 0
        this.text = new PIXI.Text(this.items[this.count].text, {
            fontFamily: 'ShareTechMono',
            fontSize: 14,
            fill: 0x000000,
            align: 'center'
        })
        this.text.x = 10
        this.text.y = 5
        this.addChild(this.text)
    }

    onForwardPressed() {
        const selectBox = this
        selectBox.count++
        if (selectBox.count >= this.items.length) {
            selectBox.count = 0
        }
        selectBox.text.text = selectBox.items[selectBox.count].text
        App.sorterFn = selectBox.items[selectBox.count].sorterFn
    }

    onBackPressed() {
        const selectBox = this
        selectBox.count--
        if (selectBox.count < 0) {
            selectBox.count = selectBox.items.length - 1
        }
        selectBox.text.text = selectBox.items[selectBox.count].text
        App.sorterFn = selectBox.items[selectBox.count].sorterFn
    }

    draw() {
        const selectBox = this

        const backArrow = new PIXI.Graphics()
        const forwardArrow = new PIXI.Graphics()
        backArrow.interactive = true
        forwardArrow.interactive = true
        selectBox.interactive = true

        // draw a triangle
        backArrow.lineStyle(1.5, 0x000000, 1)
        backArrow.beginFill(PRIMARY_VIOLET, 0.9)
        backArrow.drawRect(-22, 0, 22, 22)
        backArrow.moveTo(-7, 6)
        backArrow.lineTo(-16, 11)
        backArrow.lineTo(-7, 16)
        backArrow.lineTo(-7, 6)
        backArrow.endFill()
        selectBox.addChild(backArrow)

        selectBox.lineStyle(1.5, 0x000000, 1)
        selectBox.beginFill(PRIMARY_VIOLET, 0.5)
        selectBox.drawRect(4, 0, 100, 22)
        selectBox.endFill()

        forwardArrow.lineStyle(1.5, 0x000000, 1)
        forwardArrow.beginFill(PRIMARY_VIOLET, 0.9)
        forwardArrow.drawRect(108, 0, 22, 22)
        forwardArrow.moveTo(115, 6)
        forwardArrow.lineTo(124, 11)
        forwardArrow.lineTo(115, 16)
        forwardArrow.lineTo(115, 6)
        forwardArrow.endFill()
        selectBox.addChild(forwardArrow)

        backArrow.on('mousedown', selectBox.onBackPressed.bind(this))
        backArrow.on('touchstart', selectBox.onBackPressed.bind(this))
        forwardArrow.on('mousedown', selectBox.onForwardPressed.bind(this))
        forwardArrow.on('touchstart', selectBox.onForwardPressed.bind(this))

        return selectBox
    }

}

