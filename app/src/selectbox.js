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
        this.text.y = 8
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
        App.sorterFn = selectBox.items[selectBox.count].sorterFn
    }

    onBackPressed() {
        const selectBox = this
        if (selectBox.count - 1 > 0) {
            selectBox.count--
        } else {
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
        backArrow.lineStyle(2, 0x000000, 1)
        backArrow.beginFill(PRIMARY_VIOLET, 0.5)
        backArrow.moveTo(0, 2)
        backArrow.lineTo(-20, 14)
        backArrow.lineTo(0, 26)
        backArrow.lineTo(0, 2)
        backArrow.endFill()
        selectBox.addChild(backArrow)

        selectBox.lineStyle(2, 0x000000, 1)
        selectBox.beginFill(PRIMARY_VIOLET, 0.5)
        selectBox.drawRoundedRect(4, 0, 100, 28, 5)
        selectBox.endFill()

        forwardArrow.lineStyle(2, 0x000000, 1)
        forwardArrow.beginFill(PRIMARY_VIOLET, 0.5)
        forwardArrow.moveTo(108, 2)
        forwardArrow.lineTo(128, 14)
        forwardArrow.lineTo(108, 26)
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

