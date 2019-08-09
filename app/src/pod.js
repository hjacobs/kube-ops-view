const PIXI = require('pixi.js')
import App from './app.js'
import {FACTORS, getBarColor, podResource} from './utils.js'
import {BRIGHTNESS_FILTER} from './filters.js'

const ALL_PODS = {}

const sortByName = (a, b) => {
    // https://github.com/hjacobs/kube-ops-view/issues/103
    // *.name might be undefined
    return (a.name || '').localeCompare(b.name || '')
}

const sortByAge = (a, b) => {
    const dateA = new Date(a.startTime)
    const dateB = new Date(b.startTime)
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

const sortByStatus = (a, b) => {
    return (a.phase).localeCompare(b.phase)
}

const ALL_SORTS = [
    {
        text: 'SORT: NAME', value: sortByName
    },
    {
        text: 'SORT: AGE', value: sortByAge
    },
    {
        text: 'SORT: MEMORY', value: sortByMemory
    },
    {
        text: 'SORT: CPU', value: sortByCPU
    },
    {
        text: 'SORT: STATUS', value: sortByStatus
    }
]

export {ALL_PODS, ALL_SORTS}

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
            ALL_PODS[cluster.cluster.id + '/' + pod.namespace + '/' + pod.name] = this
        }
    }

    destroy() {
        if (this.tick) {
            PIXI.ticker.shared.remove(this.tick, this)
        }
        PIXI.ticker.shared.remove(this.animateMove, this)
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
        const existingPod = ALL_PODS[cluster.cluster.id + '/' + pod.namespace + '/' + pod.name]
        if (existingPod) {
            existingPod.pod = pod
            existingPod.clear()
            return existingPod
        } else {
            return new Pod(pod, cluster, tooltip)
        }
    }

    pulsate(_time) {
        const v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
        this.alpha = v * this._progress
    }

    crashing(_time) {
        const v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
        this.tint = PIXI.utils.rgb2hex([1, v, v])
    }

    terminating(_time) {
        const v = Math.sin(((1000 + PIXI.ticker.shared.lastTime) % 1000) / 1000. * Math.PI)
        this.cross.alpha = v
    }

    draw() {

        let ready = 0
        let running = 0
        let restarts = 0
        for (const container of this.pod.containers) {
            if (container.ready) {
                ready++
            }
            if (container.state && container.state.running) {
                running++
            }
            restarts += container.restartCount || 0
        }
        const allReady = ready >= this.pod.containers.length
        const allRunning = running >= this.pod.containers.length
        const resources = this.getResourceUsage()

        let newTick = null

        const podBox = this
        podBox.interactive = true
        podBox.on('mouseover', function () {
            podBox.filters = podBox.filters.filter(x => x != BRIGHTNESS_FILTER).concat([BRIGHTNESS_FILTER])
            let s = this.pod.name
            s += '\nNamespace : ' + this.pod.namespace
            s += '\nStatus    : ' + this.pod.phase + ' (' + ready + '/' + this.pod.containers.length + ' ready)'
            s += '\nStart Time: ' + this.pod.startTime
            s += '\nLabels    :'
            for (var key of Object.keys(this.pod.labels).sort()) {
                if (key !== 'pod-template-hash') {
                    s += '\n  ' + key + ': ' + this.pod.labels[key]
                }
            }
            s += '\nContainers:'
            for (const container of this.pod.containers) {
                s += '\n  ' + container.name + ': '
                if (container.state) {
                    const key = Object.keys(container.state)[0]
                    s += key
                    if (container.state[key].reason) {
                        // "CrashLoopBackOff"
                        s += ': ' + container.state[key].reason
                    }
                }
                if (container.restartCount) {
                    s += ' (' + container.restartCount + ' restarts)'
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
            podBox.filters = podBox.filters.filter(x => x != BRIGHTNESS_FILTER)
            this.tooltip.visible = false
        })
        if (App.current.config.podLinkUrlTemplate !== null) {
            podBox.buttonMode = true
            podBox.on('click', function() {
                location.href = App.current.config.podLinkUrlTemplate.replace('{cluster}', this.cluster.cluster.id).replace('{namespace}', this.pod.namespace).replace('{name}', this.pod.name)
            })
        }
        podBox.lineStyle(1, App.current.theme.primaryColor, 1)
        const w = 10 / this.pod.containers.length
        for (let i = 0; i < this.pod.containers.length; i++) {
            podBox.drawRect(i * w, 0, w, 10)
        }
        let color
        if (this.pod.phase == 'Succeeded') {
            // completed Job
            color = 0xaaaaff
        } else if (this.pod.phase == 'Running' && allReady) {
            color = 0xaaffaa
        } else if (this.pod.phase == 'Running' && allRunning && !allReady) {
            // all containers running, but some not ready (readinessProbe)
            newTick = this.pulsate
            color = 0xaaffaa
        } else if (this.pod.phase == 'Pending') {
            newTick = this.pulsate
            color = 0xffffaa
        } else {
            // CrashLoopBackOff, ImagePullBackOff or other unknown state
            newTick = this.crashing
            color = 0xffaaaa
        }
        podBox.lineStyle(2, color, 1)
        podBox.beginFill(color, 0.2)
        podBox.drawRect(0, 0, 10, 10)
        if (this.pod.deleted) {
            if (!this.cross) {
                const cross = new PIXI.Graphics()
                cross.lineStyle(3, 0xff0000, 1)
                cross.moveTo(0, 0)
                cross.lineTo(10, 10)
                cross.moveTo(10, 0)
                cross.lineTo(0, 10)
                cross.pivot.x = 5
                cross.pivot.y = 5
                cross.x = 5
                cross.y = 5
                cross.blendMode = PIXI.BLEND_MODES.ADD
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

        // CPU
        const scaleCpu = Math.max(resources.cpu.requested, resources.cpu.limit, resources.cpu.used) / 8
        const scaledCpuReq = resources.cpu.requested !== 0 && scaleCpu !== 0 ? resources.cpu.requested / scaleCpu : 0
        const scaledCpuUsed = resources.cpu.used !== 0 && scaleCpu !== 0 ? resources.cpu.used / scaleCpu : 0
        podBox.lineStyle()
        podBox.beginFill(getBarColor(resources.cpu.requested, resources.cpu.limit), 1)
        podBox.drawRect(1, 9 - scaledCpuReq, 1, scaledCpuReq)
        podBox.beginFill(getBarColor(resources.cpu.used, resources.cpu.limit), 1)
        podBox.drawRect(2, 9 - scaledCpuUsed, 1, scaledCpuUsed)
        podBox.endFill()

        // Memory
        const scale = Math.max(resources.memory.requested, resources.memory.limit, resources.memory.used) / 8
        const scaledMemReq = resources.memory.requested !== 0 && scale !== 0 ? resources.memory.requested / scale : 0
        const scaledMemUsed = resources.memory.used !== 0 && scale !== 0 ? resources.memory.used / scale : 0
        podBox.lineStyle()
        podBox.beginFill(getBarColor(resources.memory.requested, resources.memory.limit), 1)
        podBox.drawRect(3, 9 - scaledMemReq, 1, scaledMemReq)
        podBox.beginFill(getBarColor(resources.memory.used, resources.memory.limit), 1)
        podBox.drawRect(4, 9 - scaledMemUsed, 1, scaledMemUsed)
        podBox.endFill()

        return this
    }
}
