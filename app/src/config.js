const TRUTHY_VALUES = new Set(['1', 'true'])

export default class Config {

    constructor() {
        this.dashboardMode = false
        this.reloadIntervalSeconds = 0
        this.initialScale = 1.0
        this.renderer = 'auto'
    }

    static fromParams(params) {
        const config = new Config()
        config.dashboardMode = TRUTHY_VALUES.has(params.get('dashboard'))
        config.reloadIntervalSeconds = parseInt(params.get('reload')) || 0
        config.initialScale = parseFloat(params.get('scale')) || 1.0
        config.renderer = params.get('renderer') || 'auto'
        return config
    }


}
