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
        const bars = this;
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
            var s = '';
            var subText = '';
            s += 'CPU: \n';
            for (var subKey of Object.keys(bars.resources.cpu)) {
                subText += '\t\t' + subKey + ': ' + (bars.resources.cpu[subKey]).toFixed(2) + '\n'
            }
            s += subText;
            subText = '';
            s += '\nMemory: \n';
            for (var subKey of Object.keys(bars.resources.memory)) {
                subText += '\t\t' + subKey + ': ' + (bars.resources.memory[subKey] / FACTORS.Gi).toFixed(2) + 'GiB\n'
            }
            s += subText;
            subText = '';
            s += '\nPods: \n';
            for (var subKey of Object.keys(bars.resources.pods)) {
                subText += '\t\t' + subKey + ': ' + bars.resources.pods[subKey] + '\n'
            }
            s += subText;
            bars.tooltip.text.text = s;
            bars.tooltip.x = bars.toGlobal(new PIXI.Point(0, 0)).x;
            bars.tooltip.y = bars.toGlobal(new PIXI.Point(0, 0)).y;
            bars.tooltip.visible = true
        });
        bars.on('mouseout', function () {
            bars.tooltip.visible = false
        });

        return bars;
    }

}

