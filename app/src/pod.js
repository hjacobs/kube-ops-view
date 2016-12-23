const PIXI = require('pixi.js')
import {FACTORS, getBarColor, podResource} from './utils.js'

const ALL_PODS = {}

const sortByName = (a, b) => {
    return a.name.localeCompare(b.name)
}

const sortByAge = (a, b) => {
    const dateA = new Date(a.status.startTime)
    const dateB = new Date(b.status.startTime)
    if (dateA.getTime() < dateB.getTime()) {
        return -1
    } else if (dateA.getTime() === dateB.getTime())
        return 0
    else
        return 1
}

const sortByMemory = (a, b) => {
    const aMem = podResource('memory')(a.containers, 'usage')
    const bMem = podResource('memory')(b.containers, 'usage')
    return bMem - aMem
}

const sortByCPU = (a, b) => {
    const aCpu = podResource('cpu')(a.containers, 'usage')
    const bCpu = podResource('cpu')(b.containers, 'usage')
    return bCpu - aCpu
}

export {ALL_PODS, sortByAge, sortByCPU, sortByMemory, sortByName}

export class Pod extends PIXI.Graphics {

    constructor(pod, cluster, tooltip) {
        super()
        this.pod = pod
        this.cluster = cluster
        this.tooltip = tooltip
        this.tick = null
        this._progress = 1
        this._targetPosition = null

        if (cluster) {
            ALL_PODS[cluster.cluster.api_server_url + '/' + pod.namespace + '/' + pod.name] = this
        }
    }

    destroy() {
        if (this.tick) {
            PIXI.ticker.shared.remove(this.tick, this)
        }
        super.destroy()
    }

    animateMove(time) {
        const deltaX = this._targetPosition.x - this.position.x
        const deltaY = this._targetPosition.y - this.position.y
        if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) {
            this.position = this._targetPosition
            PIXI.ticker.shared.remove(this.animateMove, this)
        } else {
            if (Math.abs(deltaX) > time) {
                this.position.x += time * Math.sign(deltaX)
            }
            if (Math.abs(deltaY) > time) {
                this.position.y += time * Math.sign(deltaY)
            }
        }
    }

    movePodTo(targetPosition) {
        if (!this._targetPosition) {
            // just set coords
            this.position = this._targetPosition = targetPosition
        } else if (!this._targetPosition.equals(targetPosition)) {
            // animate moving to new position
            this._targetPosition = targetPosition
            PIXI.ticker.shared.add(this.animateMove, this)
        }
    }

    getResourceUsage() {

        const podCpu = podResource('cpu')
        const podMem = podResource('memory')

        const cpuLimits = podCpu(this.pod.containers, 'limits')
        const cpuUsage = podCpu(this.pod.containers, 'usage')
        const cpuRequests = podCpu(this.pod.containers, 'requests')

        const memLimits = podMem(this.pod.containers, 'limits')
        const memUsage = podMem(this.pod.containers, 'usage')
        const memRequests = podMem(this.pod.containers, 'requests')

        return {
            memory: {
                limit: memLimits,
                requested: memRequests,
                used: memUsage
            },
            cpu: {
                limit: cpuLimits,
                requested: cpuRequests,
                used: cpuUsage
            }
        }
    }

    static getOrCreate(pod, cluster, tooltip) {
        const existingPod = ALL_PODS[cluster.cluster.api_server_url + '/' + pod.namespace + '/' + pod.name]
        if (existingPod) {
            existingPod.pod = pod
            existingPod.clear()
            return existingPod
        } else {
            return new Pod(pod, cluster, tooltip)
        }
    }

    pulsate(time) {
        const v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
        this.alpha = v * this._progress
    }

    crashing(time) {
        const v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
        this.tint = PIXI.utils.rgb2hex([1, v, v])
    }

    terminating(time) {
        const v = Math.sin(((1000 + PIXI.ticker.shared.lastTime) % 1000) / 1000. * Math.PI)
        this.cross.alpha = v
    }

    draw() {

        // pod.status.containerStatuses might be undefined!
        const containerStatuses = this.pod.status.containerStatuses || []
        let ready = 0
        let running = 0
        let restarts = 0
        for (const containerStatus of containerStatuses) {
            if (containerStatus.ready) {
                ready++
            }
            if (containerStatus.state.running) {
                running++
            }
            restarts += containerStatus.restartCount || 0
        }
        const allReady = ready >= containerStatuses.length
        const allRunning = running >= containerStatuses.length
        const resources = this.getResourceUsage()

        let newTick = null

        const podBox = this
        podBox.interactive = true
        podBox.on('mouseover', function () {
            const filter = new PIXI.filters.ColorMatrixFilter()
            filter.brightness(1.3)
            podBox.filters = [filter]
            let s = this.pod.name
            s += '\nStatus    : ' + this.pod.status.phase + ' (' + ready + '/' + containerStatuses.length + ' ready)'
            s += '\nStart Time: ' + this.pod.status.startTime
            s += '\nLabels    :'
            for (var key of Object.keys(this.pod.labels)) {
                if (key !== 'pod-template-hash') {
                    s += '\n  ' + key + ': ' + this.pod.labels[key]
                }
            }
            s += '\nContainers:'
            for (const containerStatus of containerStatuses) {
                const key = Object.keys(containerStatus.state)[0]
                s += '\n  ' + containerStatus.name + ': ' + key
                if (containerStatus.state[key].reason) {
                    // "CrashLoopBackOff"
                    s += ': ' + containerStatus.state[key].reason
                }
                if (containerStatus.restartCount) {
                    s += ' (' + containerStatus.restartCount + ' restarts)'
                }
            }
            s += '\nCPU:'
            s += '\n  Requested: ' + (resources.cpu.requested / FACTORS.m).toFixed(0) + ' m'
            s += '\n  Limit:     ' + (resources.cpu.limit / FACTORS.m).toFixed(0) + ' m'
            s += '\n  Used:      ' + (resources.cpu.used / FACTORS.m).toFixed(0) + ' m'
            s += '\nMemory:'
            s += '\n  Requested: ' + (resources.memory.requested / FACTORS.Mi).toFixed(0) + ' MiB'
            s += '\n  Limit:     ' + (resources.memory.limit / FACTORS.Mi).toFixed(0) + ' MiB'
            s += '\n  Used:      ' + (resources.memory.used / FACTORS.Mi).toFixed(0) + ' MiB'

            this.tooltip.setText(s)
            this.tooltip.position = this.toGlobal(new PIXI.Point(10, 10))
            this.tooltip.visible = true
        })
        podBox.on('mouseout', function () {
            podBox.filters = []
            this.tooltip.visible = false
        })
        podBox.lineStyle(2, 0xaaaaaa, 1)
        let i = 0
        const w = 10 / this.pod.containers.length
        for (const container of this.pod.containers) {
            podBox.drawRect(i * w, 0, w, 10)
            i++
        }
        if (this.pod.status.phase == 'Succeeded') {
            // completed Job
            podBox.lineStyle(2, 0xaaaaff, 1)
        } else if (this.pod.status.phase == 'Running' && allReady) {
            podBox.lineStyle(2, 0xaaffaa, 1)
        } else if (this.pod.status.phase == 'Running' && allRunning && !allReady) {
            // all containers running, but some not ready (readinessProbe)
            newTick = this.pulsate
            podBox.lineStyle(2, 0xaaffaa, 1)
        } else if (this.pod.status.phase == 'Pending') {
            newTick = this.pulsate
            podBox.lineStyle(2, 0xffffaa, 1)
        } else {
            // CrashLoopBackOff, ImagePullBackOff or other unknown state
            newTick = this.crashing
            podBox.lineStyle(2, 0xff9999, 1)
        }
        podBox.beginFill(0x999999, 0.5)
        podBox.drawRect(0, 0, 10, 10)
        if (this.pod.deleted) {
            if (!this.cross) {
                const cross = new PIXI.Graphics()
                cross.lineStyle(3, 0xff6666, 1)
                cross.moveTo(0, 0)
                cross.lineTo(10, 10)
                cross.moveTo(10, 0)
                cross.lineTo(0, 10)
                cross.pivot.x = 5
                cross.pivot.y = 5
                cross.x = 5
                cross.y = 5
                this.addChild(cross)
                this.cross = cross
            }
            newTick = this.terminating
        }


        if (restarts) {
            this.lineStyle(2, 0xff9999, 1)
            for (let i = 0; i < Math.min(restarts, 4); i++) {
                this.moveTo(10, i * 3 - 1)
                this.lineTo(10, i * 3 + 1)
            }
        }

        if (newTick && newTick != this.tick) {
            this.tick = newTick
            // important: only register new listener if it does not exist yet!
            // (otherwise we leak listeners)
            PIXI.ticker.shared.add(this.tick, this)
        } else if (!newTick && this.tick) {
            PIXI.ticker.shared.remove(this.tick, this)
            this.tick = null
            this.alpha = this._progress
            this.tint = 0xffffff
        }

        const cpuHeight = resources.cpu.limit !== 0 ? 8 / resources.cpu.limit : 0
        podBox.lineStyle(0, 0xaaffaa, 1)
        podBox.beginFill(getBarColor(resources.cpu.requested, resources.cpu.limit), 1)
        podBox.drawRect(1, 9 - resources.cpu.requested * cpuHeight, 1, resources.cpu.requested * cpuHeight)
        podBox.beginFill(getBarColor(resources.cpu.used, resources.cpu.limit), 1)
        podBox.drawRect(2, 9 - resources.cpu.used * cpuHeight, 1, resources.cpu.used * cpuHeight)
        podBox.endFill()
        podBox.lineStyle(1, 0xaaaaaa, 1)

        const scale = resources.memory.limit / 8
        const scaledMemReq = resources.memory.requested !== 0 && scale !== 0 ? resources.memory.requested / scale : 0
        const scaledMemUsed = resources.memory.used !== 0 && scale !== 0 ? resources.memory.used / scale : 0
        podBox.lineStyle(0, 0xaaffaa, 1)
        podBox.beginFill(getBarColor(resources.memory.requested, resources.memory.limit), 1)
        podBox.drawRect(3, 9 - scaledMemReq, 1, scaledMemReq)
        podBox.beginFill(getBarColor(resources.memory.used, resources.memory.limit), 1)
        podBox.drawRect(4, 9 - scaledMemUsed, 1, scaledMemUsed)
        podBox.endFill()

        return this
    }
}
