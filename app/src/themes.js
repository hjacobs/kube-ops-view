const PIXI = require('pixi.js')

export class Theme {
    constructor() {
    }

    static get(name) {
        switch (name) {
        case 'default':
            return new DefaultTheme()
        case 'green':
            return new GreenTheme()
        case 'grey':
            return new GreyTheme()
        case 'black-and-white':
            return new BlackAndWhiteTheme()
        case 'sepia':
            return new SepiaTheme()
        case 'polaroid':
            return new PolaroidTheme()
        case 'high-contrast':
            return new HighContrastTheme()
        default:
            return new DefaultTheme()
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
}

class GreenTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xaaffaa
        this.secondaryColor = 0x223322
    }
}

class GreyTheme extends DefaultTheme {
    constructor() {
        super()
        this.primaryColor = 0xeeeeee
        this.secondaryColor = 0x333333
    }
}

class BlackAndWhiteTheme extends DefaultTheme {
    constructor() {
        super()
    }
    apply(stage) {
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.blackAndWhite()
        stage.filters = [filter]
    }
}

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
