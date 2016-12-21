import {FACTORS, getBarColor} from './utils';

const PIXI = require('pixi.js');

export default class Bars extends PIXI.Graphics {
    constructor(entity, resources, tooltip) {
        super();
        this.entity = entity;
        this.resources = resources;
        this.tooltip = tooltip;
    }

    draw() {
        const bars = this

        bars.lineStyle(0, 0xaaffaa, 1)
        bars.beginFill(0xaaffaa, 0.1)
        bars.drawRect(5, 30, 15, 80)
        bars.endFill()
        const cpuHeight = 80 / bars.resources.cpu.capacity;
        bars.interactive = true;
        bars.lineStyle(0, 0xaaffaa, 1);
        bars.beginFill(getBarColor(bars.resources.cpu.requested, bars.resources.cpu.capacity), 1);
        bars.drawRect(5, 110 - bars.resources.cpu.requested * cpuHeight, 2.5, bars.resources.cpu.requested * cpuHeight);
        bars.beginFill(getBarColor(bars.resources.cpu.used, bars.resources.cpu.capacity), 1);
        bars.drawRect(7.5, 110 - bars.resources.cpu.used * cpuHeight, 2.5, bars.resources.cpu.used * cpuHeight);
        bars.endFill();
        bars.lineStyle(1, 0xaaaaaa, 1);
        for (var i = 0; i < bars.resources.cpu.capacity; i++) {
            bars.drawRect(5, 110 - (i + 1) * cpuHeight, 5, cpuHeight)
        }

        const scale = bars.resources.memory.capacity / 80;
        bars.drawRect(14, 110 - bars.resources.memory.capacity / scale, 5, bars.resources.memory.capacity / scale);
        bars.lineStyle(0, 0xaaffaa, 1);
        bars.beginFill(getBarColor(bars.resources.memory.requested, bars.resources.memory.capacity), 1);
        bars.drawRect(14, 110 - bars.resources.memory.requested / scale, 2.5, bars.resources.memory.requested / scale);
        bars.beginFill(getBarColor(bars.resources.memory.used, bars.resources.memory.capacity), 1);
        bars.drawRect(16.5, 110 - bars.resources.memory.used / scale, 2.5, bars.resources.memory.used / scale);
        bars.endFill();
        bars.on('mouseover', function () {
            let s = 'CPU: \n'
            const {capacity: cpuCap, requested: cpuReq, used: cpuUsed} = bars.resources.cpu
            s += '\t\t Capactiy  : ' + cpuCap + '\n'
            s += '\t\t Requested : ' + cpuReq.toFixed(2) + '\n'
            s += '\t\t Used      : ' + cpuUsed.toFixed(2) + '\n'
            s += '\nMemory: \n'

            const {capacity: memCap, requested: memReq, used: memUsed} = bars.resources.memory
            s += '\t\t Capactiy  : ' + (memCap / FACTORS.Gi).toFixed(2) + ' GiB\n'
            s += '\t\t Requested : ' + (memReq / FACTORS.Gi).toFixed(2) + ' GiB\n'
            s += '\t\t Used      : ' + (memUsed / FACTORS.Gi).toFixed(2) + ' GiB\n'

            s += '\nPods: \n'
            const {capacity: podsCap, used: podsUsed} = bars.resources.pods
            s += '\t\t Capactiy  : ' + podsCap + '\n'
            s += '\t\t Used      : ' + podsUsed + '\n'

            bars.tooltip.text.text = s
            bars.tooltip.x = bars.toGlobal(new PIXI.Point(0, 0)).x
            bars.tooltip.y = bars.toGlobal(new PIXI.Point(0, 0)).y
            bars.tooltip.visible = true
        });
        bars.on('mouseout', function () {
            bars.tooltip.visible = false
        });

        return bars
    }

}

