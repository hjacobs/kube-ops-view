const PIXI = require('pixi.js')

export default class Pod extends PIXI.Graphics {
    constructor (pod, tooltip) {
        super()
        this.pod = pod
        this.tooltip = tooltip
    }

    draw() {
        // pod.status.containerStatuses might be undefined!
        const containerStatuses = this.pod.status.containerStatuses || []
        var ready = 0
        var running = 0
        for (const containerStatus of containerStatuses) {
            if (containerStatus.ready) {
                ready++
            }
            if (containerStatus.state.running) {
                running++
            }
        }
        const allReady = ready >= containerStatuses.length
        const allRunning = running >= containerStatuses.length

        const podBox = this
        podBox.interactive = true
        podBox.on('mouseover', function() {
            const filter = new PIXI.filters.ColorMatrixFilter()
            filter.brightness(1.3)
            podBox.filters = [filter]
            let s = this.pod.name
            for (var key of Object.keys(this.pod.labels)) {
                if (key !== 'pod-template-hash') {
                    s += '\n' + key + ': ' + this.pod.labels[key]
                }
            }
            s += '\nStatus: ' + this.pod.status.phase
            s += '\nReady: ' + ready + '/' + containerStatuses.length
            for (const containerStatus of containerStatuses) {
                const key = Object.keys(containerStatus.state)[0]
                s += '\n' + key
                if (containerStatus.state[key].reason) {
                    // "CrashLoopBackOff"
                    s += ': ' + containerStatus.state[key].reason
                }
            }
            this.tooltip.text.text = s
            this.tooltip.x = this.toGlobal(new PIXI.Point(10, 10)).x
            this.tooltip.y = this.toGlobal(new PIXI.Point(10, 10)).y
            this.tooltip.visible = true
            // console.log(this.pod)
        })
        podBox.on('mouseout', function() {
            podBox.filters = []
            this.tooltip.visible = false
        })
        podBox.lineStyle(2, 0xaaaaaa, 1);
        var i = 0
        var w = 10 / this.pod.containers.length
        for (const container of this.pod.containers) {
            podBox.drawRect(0 + i * w, 0, w, 10)
            i++
        }
        if (this.pod.status.phase == 'Succeeded') {
            // completed Job
            podBox.lineStyle(2, 0xaaaaff, 1);
        } else if (this.pod.status.phase == 'Running' && allReady) {
            podBox.lineStyle(2, 0xaaffaa, 1);
        } else if (this.pod.status.phase == 'Running' && allRunning && !allReady) {
            // all containers running, but some not ready (readinessProbe)
            PIXI.ticker.shared.add(function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.alpha = v
            })
            podBox.lineStyle(2, 0xaaffaa, 1);
        } else if (this.pod.status.phase == 'Pending') {
            PIXI.ticker.shared.add(function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.alpha = v
            })
            podBox.lineStyle(2, 0xffffaa, 1);
        } else {
            // CrashLoopBackOff, ImagePullBackOff or other unknown state

            PIXI.ticker.shared.add(function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.tint = PIXI.utils.rgb2hex([1, v, v])
            })
            podBox.lineStyle(2, 0xff9999, 1);
        }
        podBox.beginFill(0x999999, 0.5)
        podBox.drawRect(0, 0, 10, 10)
        return this
    }
}
