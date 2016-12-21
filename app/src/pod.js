import { PodFill, PendingPodBorder, RunningPodBorder, CompletedPodBorder } from './colors.js'
import { parseResource, getBarColor } from './utils.js'
const PIXI = require('pixi.js')

export const ALL_PODS = {}

export class Pod extends PIXI.Graphics {

    constructor(pod, tooltip, register=true) {
        super()
        this.pod = pod
        this.tooltip = tooltip
        this.tick = null

        if (register) {
            ALL_PODS[pod.namespace + '/' + pod.name] = this
        }
    }

    static getOrCreate(pod, tooltip) {
        const existingPod = ALL_PODS[pod.namespace + '/' + pod.name]
        if (existingPod) {
            existingPod.pod = pod
            existingPod.clear()
            return existingPod
        } else {
            return new Pod(pod, tooltip)
        }
    }

    getResourceUsage() {
        const units = {
            cpu: 'm',
            memory: 'Mi'
        }

        const metric = (metric, type) =>
            metric ? (metric[type] ? parseInt(metric[type]) : 0) : 0

        const podResource = type => (containers, resource) =>
            containers
                .map(({resources}) => metric(resources[resource], type))
                .reduce((a, b) => a + b, 0)
                .toString().concat(units[type])

        const podCpu = podResource('cpu')
        const podMem = podResource('memory')

        const cpuLimits = parseResource(podCpu(this.pod.containers, 'limits'))
        const cpuUsage = parseResource(podCpu(this.pod.containers, 'usage'))
        const cpuRequests = parseResource(podCpu(this.pod.containers, 'requests'))

        const memLimits = parseResource(podMem(this.pod.containers, 'limits'))
        const memUsage = parseResource(podMem(this.pod.containers, 'usage'))
        const memRequests = parseResource(podMem(this.pod.containers, 'requests'))

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

    draw() {

        if (this.tick) {
            PIXI.ticker.shared.remove(this.tick)
        }

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
        })
        podBox.on('mouseout', function () {
            podBox.filters = []
            this.tooltip.visible = false
        })
        podBox.lineStyle(2, 0xaaaaaa, 1)
        var i = 0
        var w = 10 / this.pod.containers.length
        for (const container of this.pod.containers) {
            podBox.drawRect(i * w, 0, w, 10)
            i++
        }
        if (this.pod.status.phase == 'Succeeded') {
            // completed Job
            podBox.lineStyle(2, CompletedPodBorder, 1);
        } else if (this.pod.status.phase == 'Running' && allReady) {
            podBox.lineStyle(2, RunningPodBorder, 1);
        } else if (this.pod.status.phase == 'Running' && allRunning && !allReady) {
            // all containers running, but some not ready (readinessProbe)
            this.tick = function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.alpha = v
            })
            podBox.lineStyle(2, RunningPodBorder, 1);
        } else if (this.pod.status.phase == 'Pending') {
            this.tick = function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.alpha = v
            })
            podBox.lineStyle(2, PendingPodBorder, 1);
        } else {
            // CrashLoopBackOff, ImagePullBackOff or other unknown state

            this.tick = function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
                podBox.tint = PIXI.utils.rgb2hex([1, v, v])
            }
            podBox.lineStyle(2, 0xff9999, 1)
        }
        podBox.beginFill(PodFill, 0.5)
        podBox.drawRect(0, 0, 10, 10)
        if (this.pod.deleted) {
            podBox.lineStyle(2, 0x000000, 0.8)
            podBox.moveTo(0, 0)
            podBox.lineTo(10, 10)
            podBox.moveTo(10, 0)
            podBox.lineTo(0, 10)
            /*
            PIXI.ticker.shared.add(function (_) {
                const now = new Date().getTime() / 1000
                // TODO: better animation
                podBox.alpha = Math.min(0.8, Math.max(0.2, (podBox.pod.deleted - now)/30))
            })
            */
        }
        if (this.tick) {
            PIXI.ticker.shared.add(this.tick)
        }

        const resources = this.getResourceUsage()

        const cpuHeight = resources.cpu.limit !== 0 ? 8 / resources.cpu.limit : 0
        podBox.lineStyle(0, 0xaaffaa, 1)
        podBox.beginFill(getBarColor(resources.cpu.requested, resources.cpu.limit), 1)
        podBox.drawRect(1, 9 - resources.cpu.requested * cpuHeight, 1, resources.cpu.requested * cpuHeight)
        podBox.beginFill(getBarColor(resources.cpu.used, resources.cpu.limit), 1)
        podBox.drawRect(2, 9 - resources.cpu.used * cpuHeight, 1, resources.cpu.used * cpuHeight)
        podBox.endFill()
        podBox.lineStyle(1, 0xaaaaaa, 1)

        let limitExceeded = false
        if (resources.memory.used > resources.memory.limit) {
            resources.memory.limit = resources.memory.used
            limitExceeded = true
        }

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
