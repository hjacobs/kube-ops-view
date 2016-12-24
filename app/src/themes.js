const PIXI = require('pixi.js')

export const ALL_THEMES = {}

export class Theme {
    constructor() {
    }

    static get(name) {
        const clazz = ALL_THEMES[name]
        if (clazz) {
            return new clazz()
        } else {
            return DefaultTheme()
        }
    }
}

class DefaultTheme {
    constructor() {
        this.primaryColor = 0xaaaaff
        this.secondaryColor = 0x222233
    }
    apply(stage) {
        stage.filters = []
    }
    get name() {
        return DefaultTheme.getThemeName(this.constructor.name)
    }
    static getThemeName(name) {
        const className = name || this.name
        return className.substring(0, className.length - 5).toLowerCase()
    }
    static register() {
        ALL_THEMES[this.getThemeName()] = this
    }
}
DefaultTheme.register()

class GreenTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xaaffaa
        this.secondaryColor = 0x223322
    }
}
GreenTheme.register()

class GreyTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xeeeeee
        this.secondaryColor = 0x333333
    }
}
GreyTheme.register()

class BlackAndWhiteTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xffffff
        this.secondaryColor = 0x000000
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.blackAndWhite()
        stage.filters = [filter]
    }
}
BlackAndWhiteTheme.register()

class SepiaTheme extends DefaultTheme {
    constructor() {
        super()
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.sepia()
        stage.filters = [filter]
    }
}
SepiaTheme.register()

class PolaroidTheme extends DefaultTheme {
    constructor() {
        super()
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.polaroid()
        stage.filters = [filter]
    }
}
PolaroidTheme.register()

class HighContrastTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xffffff
        this.secondaryColor = 0x000000
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.saturate(3)
        stage.filters = [filter]
    }
}
HighContrastTheme.register()
