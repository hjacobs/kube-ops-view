import { PRIMARY_COLOR, SECONDARY_COLOR } from './colors.js'
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
            fill: PRIMARY_COLOR,
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

        const arrowBoxWidth = 18

        // draw a triangle
        backArrow.beginFill(SECONDARY_COLOR, 1)
        backArrow.drawRect(-18, 0, arrowBoxWidth, 22)
        backArrow.lineStyle(1, PRIMARY_COLOR, 1)
        backArrow.beginFill(SECONDARY_COLOR, 1)
        backArrow.moveTo(-4, 5)
        backArrow.lineTo(-15, 11)
        backArrow.lineTo(-4, 17)
        backArrow.lineTo(-4, 5)
        backArrow.endFill()
        selectBox.addChild(backArrow)

        selectBox.lineStyle(1, PRIMARY_COLOR, 1)
        selectBox.beginFill(SECONDARY_COLOR, 0.5)
        selectBox.drawRect(4, 0, 100, 22)
        selectBox.endFill()

        forwardArrow.beginFill(SECONDARY_COLOR, 1)
        forwardArrow.drawRect(108, 0, arrowBoxWidth, 22)
        forwardArrow.lineStyle(1, PRIMARY_COLOR, 1)
        forwardArrow.beginFill(SECONDARY_COLOR, 1)
        forwardArrow.moveTo(111, 5)
        forwardArrow.lineTo(122, 11)
        forwardArrow.lineTo(111, 17)
        forwardArrow.lineTo(111, 5)
        forwardArrow.endFill()
        selectBox.addChild(forwardArrow)

        backArrow.on('mousedown', selectBox.onBackPressed.bind(this))
        backArrow.on('touchstart', selectBox.onBackPressed.bind(this))
        forwardArrow.on('mousedown', selectBox.onForwardPressed.bind(this))
        forwardArrow.on('touchstart', selectBox.onForwardPressed.bind(this))

        return selectBox
    }

}

