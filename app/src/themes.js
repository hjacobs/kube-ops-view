const PIXI = require('pixi.js')
import {CRTFilter} from '@pixi/filter-crt'

export const ALL_THEMES = {}

export class Theme {
    constructor() {
    }

    static get(name) {
        return ALL_THEMES[name] || ALL_THEMES['default']
    }
}

class DefaultTheme {
    constructor() {
        this.name = 'default'
        this.primaryColor = 0xaaaaff
        this.secondaryColor = 0x222233
    }
    apply(stage) {
        stage.filters = []
    }
    register() {
        ALL_THEMES[this.name] = this
    }
}
new DefaultTheme().register()

class GreenTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'green'
        this.primaryColor = 0xaaffaa
        this.secondaryColor = 0x223322
    }
}
new GreenTheme().register()

class GreyTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'grey'
        this.primaryColor = 0xeeeeee
        this.secondaryColor = 0x333333
    }
}
new GreyTheme().register()

class BlackAndWhiteTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'blackandwhite'
        this.primaryColor = 0xffffff
        this.secondaryColor = 0x000000
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.blackAndWhite()
        stage.filters = [filter]
    }
}
new BlackAndWhiteTheme().register()

class SepiaTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'sepia'
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.sepia()
        stage.filters = [filter]
    }
}
new SepiaTheme().register()

class PolaroidTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'polaroid'
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.polaroid()
        stage.filters = [filter]
    }
}
new PolaroidTheme().register()

class HighContrastTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'highcontrast'
        this.primaryColor = 0xffffff
        this.secondaryColor = 0x000000
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.saturate(3)
        stage.filters = [filter]
    }
}
new HighContrastTheme().register()

class CRTTheme extends DefaultTheme {
    constructor() {
        super()
        this.name = 'crt'
        this.primaryColor = 0xaaaaff
        this.secondaryColor = 0x222233
    }
    apply(stage) {
        const filter = new CRTFilter({time: 0.5})

        stage.filters = [filter]
        this.filter = filter
        PIXI.ticker.shared.add(this.animate, this)
    }

    animate(_delta) {
        this.filter.seed = Math.random()
        this.filter.time += 0.5
    }
}
new CRTTheme().register()
