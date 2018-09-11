import {FACTORS, getBarColor} from './utils'
import App from './app'

const PIXI = require('pixi.js')

export default class Bars extends PIXI.Graphics {
    constructor(entity, resources, tooltip) {
        super()
        this.entity = entity
        this.resources = resources
        this.tooltip = tooltip
    }

    draw() {
        const bars = this

        const barHeight = 92

        bars.beginFill(App.current.theme.primaryColor, 0.1)
        bars.drawRect(5, 110 - barHeight, 15, barHeight)
        bars.endFill()

        // CPU
        const cpuHeight = barHeight / bars.resources.cpu.capacity
        bars.interactive = true
        bars.lineStyle(0, 0xaaffaa, 1)
        bars.beginFill(getBarColor(bars.resources.cpu.requested, bars.resources.cpu.capacity - bars.resources.cpu.reserved), 1)
        bars.drawRect(5, 110 - (bars.resources.cpu.requested + bars.resources.cpu.reserved) * cpuHeight, 2.5, (bars.resources.cpu.requested + bars.resources.cpu.reserved) * cpuHeight)
        bars.beginFill(getBarColor(bars.resources.cpu.used, bars.resources.cpu.capacity), 1)
        bars.drawRect(7.5, 110 - bars.resources.cpu.used * cpuHeight, 2.5, bars.resources.cpu.used * cpuHeight)
        bars.endFill()
        bars.lineStyle(1, App.current.theme.primaryColor, 1)
        bars.drawRect(5, 110 - bars.resources.cpu.reserved * cpuHeight, 5, bars.resources.cpu.reserved * cpuHeight)
        bars.lineStyle(1, App.current.theme.primaryColor, 1)
        for (var i = 0; i < bars.resources.cpu.capacity; i++) {
            bars.drawRect(5, 110 - (i + 1) * cpuHeight, 5, cpuHeight)
        }

        // Memory
        const scale = bars.resources.memory.capacity / barHeight
        bars.lineStyle(0, 0xaaffaa, 1)
        bars.beginFill(getBarColor(bars.resources.memory.requested, bars.resources.memory.capacity - bars.resources.memory.reserved), 1)
        bars.drawRect(14, 110 - (bars.resources.memory.requested + bars.resources.memory.reserved) / scale, 2.5, (bars.resources.memory.requested + bars.resources.memory.reserved) / scale)
        bars.beginFill(getBarColor(bars.resources.memory.used, bars.resources.memory.capacity), 1)
        bars.drawRect(16.5, 110 - bars.resources.memory.used / scale, 2.5, bars.resources.memory.used / scale)
        bars.endFill()
        bars.lineStyle(1, App.current.theme.primaryColor, 1)
        bars.drawRect(14, 110 - bars.resources.memory.reserved / scale, 5, bars.resources.memory.reserved / scale)
        bars.drawRect(14, 110 - bars.resources.memory.capacity / scale, 5, bars.resources.memory.capacity / scale)

        // GPU
        if ('nvidia.com/gpu' in bars.resources) {
            const gpuHeight = barHeight / bars.resources['nvidia.com/gpu'].capacity
            bars.lineStyle(0, 0xaaffaa, 1)
            bars.beginFill(getBarColor(bars.resources['nvidia.com/gpu'].requested, bars.resources['nvidia.com/gpu'].capacity - bars.resources['nvidia.com/gpu'].reserved), 1)
            bars.drawRect(23, 110 - (bars.resources['nvidia.com/gpu'].requested + bars.resources['nvidia.com/gpu'].reserved) * gpuHeight, 2.5, (bars.resources['nvidia.com/gpu'].requested + bars.resources['nvidia.com/gpu'].reserved) * gpuHeight)
            bars.beginFill(getBarColor(bars.resources['nvidia.com/gpu'].used, bars.resources['nvidia.com/gpu'].capacity), 1)
            bars.drawRect(25.5, 110 - bars.resources['nvidia.com/gpu'].used * gpuHeight, 2.5, bars.resources['nvidia.com/gpu'].used * gpuHeight)
            bars.endFill()
            bars.lineStyle(1, App.current.theme.primaryColor, 1)
            bars.drawRect(23, 110 - bars.resources['nvidia.com/gpu'].reserved * gpuHeight, 5, bars.resources['nvidia.com/gpu'].reserved * gpuHeight)
            bars.lineStyle(1, App.current.theme.primaryColor, 1)
            for (i = 0; i < bars.resources['nvidia.com/gpu'].capacity; i++) {
                bars.drawRect(23, 110 - (i + 1) * gpuHeight, 5, gpuHeight)
            }
        }

        bars.on('mouseover', function () {
            let s = 'CPU: \n'
            const {capacity: cpuCap, reserved: cpuRes, requested: cpuReq, used: cpuUsed} = bars.resources.cpu
            s += '\t\t Capacity  : ' + cpuCap + '\n'
            s += '\t\t Reserved  : ' + cpuRes.toFixed(2) + '\n'
            s += '\t\t Requested : ' + cpuReq.toFixed(2) + '\n'
            s += '\t\t Used      : ' + cpuUsed.toFixed(2) + '\n'
            s += '\nMemory: \n'

            const {capacity: memCap, reserved: memRes, requested: memReq, used: memUsed} = bars.resources.memory
            s += '\t\t Capacity  : ' + (memCap / FACTORS.Gi).toFixed(2) + ' GiB\n'
            s += '\t\t Reserved  : ' + (memRes / FACTORS.Gi).toFixed(2) + ' GiB\n'
            s += '\t\t Requested : ' + (memReq / FACTORS.Gi).toFixed(2) + ' GiB\n'
            s += '\t\t Used      : ' + (memUsed / FACTORS.Gi).toFixed(2) + ' GiB\n'

            if ('nvidia.com/gpu' in bars.resources) {
                s += '\nGPU: \n'
                const {capacity: gpuCap, reserved: gpuRes, requested: gpuReq, used: gpuUsed} = bars.resources['nvidia.com/gpu']
                s += '\t\t Capacity  : ' + (gpuCap).toFixed(2) + '\n'
                s += '\t\t Reserved  : ' + (gpuRes).toFixed(2) + '\n'
                s += '\t\t Requested : ' + (gpuReq).toFixed(2) + '\n'
                s += '\t\t Used      : ' + (gpuUsed).toFixed(2) + '\n'
            }

            s += '\nPods: \n'
            const {capacity: podsCap, used: podsUsed} = bars.resources.pods
            s += '\t\t Capacity  : ' + podsCap + '\n'
            s += '\t\t Used      : ' + podsUsed + '\n'

            bars.tooltip.setText(s)
            bars.tooltip.position = bars.toGlobal(new PIXI.Point(22, 16))
            bars.tooltip.visible = true
        })
        bars.on('mouseout', function () {
            bars.tooltip.visible = false
        })

        return bars
    }

}

