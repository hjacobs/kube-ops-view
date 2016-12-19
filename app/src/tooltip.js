const PIXI = require('pixi.js')

export default class Tooltip extends PIXI.Graphics {
    constructor () {
        super()
    }

    draw () {
        var tooltip = this
        tooltip.lineStyle(1, 0x000000, 1)
        tooltip.beginFill(0x666666, 0.8)
        tooltip.drawRect(0, 0, 200, 400)
        tooltip.endFill()
        var text = new PIXI.Text('', {fontSize: 12, fill: 0xffffff})
        text.x = 2
        text.y = 2
        tooltip.addChild(text)
        tooltip.text = text
        tooltip.visible = false
    }
}
