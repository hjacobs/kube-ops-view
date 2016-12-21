const PIXI = require('pixi.js')

export default class Tooltip extends PIXI.Graphics {
    constructor () {
        super()
        this.text = new PIXI.Text('', {fontFamily: 'ShareTechMono', fontSize: 12, fill: 0xffffff})
        this.text.x = 4
        this.text.y = 4
        this.addChild(this.text)
        this.visible = false
    }

    setText(text) {
        this.text.text = text
        this.draw()
    }

    draw () {
        this.clear()
        this.lineStyle(2, 0x333333, 0.8)
        this.beginFill(0x333333, 0.8)
        this.drawRect(0, 0, this.text.width + 8, this.text.height + 8)
        this.endFill()
    }
}
