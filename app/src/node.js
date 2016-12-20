import Pod from "./pod.js";
import Bars from './bars.js'
const PIXI = require('pixi.js');

// see https://github.com/kubernetes/kubernetes/blob/master/docs/design/resources.md
const FACTORS = {
    'm': 1 / 1000,
    'K': 1000,
    'M': Math.pow(1000, 2),
    'G': Math.pow(1000, 3),
    'T': Math.pow(1000, 4),
    'P': Math.pow(1000, 5),
    'E': Math.pow(1000, 6),
    'Ki': 1024,
    'Mi': Math.pow(1024, 2),
    'Gi': Math.pow(1024, 3),
    'Ti': Math.pow(1024, 4),
    'Pi': Math.pow(1024, 5),
    'Ei': Math.pow(1024, 6)
};

export default class Node extends PIXI.Graphics {
    constructor(node, tooltip) {
        super();
        this.node = node;
        this.tooltip = tooltip;
    }

    isMaster() {
        return this.node.labels.master == 'true'
    }

    parseResource(v) {
        const match = v.match(/^(\d*)(\D*)$/);
        const factor = FACTORS[match[2]] || 1;
        return parseInt(match[1]) * factor
    }

    hsvToRgb(h, s, v) {
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
            case 1:
                r = q;
                g = v;
                b = p;
                break;
            case 2:
                r = p;
                g = v;
                b = t;
                break;
            case 3:
                r = p;
                g = q;
                b = v;
                break;
            case 4:
                r = t;
                g = p;
                b = v;
                break;
            case 5:
                r = v;
                g = p;
                b = q;
                break;
        }
        return PIXI.utils.rgb2hex([r, g, b])
    }

    getBarColor(usage, capacity) {
        return this.hsvToRgb(0.4 - (0.4 * (usage / capacity)), 0.6, 1)
    }

    getResourceUsage() {
        const resources = {};
        for (var key of Object.keys(this.node.status.capacity)) {
            resources[key] = {
                'capacity': this.parseResource(this.node.status.capacity[key]),
                'requested': 0,
                'used': 0
            }
        }
        if (this.node.usage) {
            for (var key of Object.keys(this.node.usage)) {
                resources[key]['used'] = this.parseResource(this.node.usage[key])
            }
        }
        for (var pod of this.node.pods) {
            for (var container of pod.containers) {
                if (container.resources && container.resources.requests) {
                    for (var key of Object.keys(container.resources.requests)) {
                        resources[key].requested += this.parseResource(container.resources.requests[key])
                    }
                }
            }
        }
        resources['pods'].requested = this.node.pods.length;
        return resources
    }


    draw() {
        var nodeBox = this;
        var topHandle = new PIXI.Graphics();
        topHandle.beginFill(0xaaaaff, 1);
        topHandle.drawRect(0, 0, 105, 15);
        topHandle.endFill();
        var text = new PIXI.Text(this.node.name, {fontSize: 10, fill: 0x000000});
        text.cacheAsBitmap = true;
        var mask = new PIXI.Graphics();
        mask.beginFill(0x0);
        mask.drawRect(0, 0, 100, 15);
        mask.endFill();
        text.mask = mask;
        text.x = 2;
        text.y = 2;
        topHandle.addChild(text);
        nodeBox.addChild(topHandle);
        nodeBox.lineStyle(2, 0xaaaaff, 1);
        nodeBox.beginFill(0x999999, 0.5);
        nodeBox.drawRect(0, 0, 105, 115);
        nodeBox.endFill();
        nodeBox.lineStyle(2, 0xaaaaaa, 1);
        topHandle.interactive = true;
        topHandle.on('mouseover', function () {
            var s = nodeBox.node.name;
            for (var key of Object.keys(nodeBox.node.labels)) {
                s += '\n' + key + ': ' + nodeBox.node.labels[key]
            }
            nodeBox.tooltip.text.text = s;
            nodeBox.tooltip.x = nodeBox.toGlobal(new PIXI.Point(0, 0)).x;
            nodeBox.tooltip.y = nodeBox.toGlobal(new PIXI.Point(0, 0)).y;
            nodeBox.tooltip.visible = true
        });
        topHandle.on('mouseout', function () {
            nodeBox.tooltip.visible = false
        });

        const resources = this.getResourceUsage();
        const cpuHeight = 80 / resources.cpu.capacity;
        var bars = new Bars(nodeBox, resources, nodeBox.tooltip);
        bars.x = 0
        bars.y = 1
        nodeBox.addChild(bars.draw());
        var text = new PIXI.Text('', {fontSize: 10, fill: 0xffffff});
        nodeBox.addChild(text);

        var px = 24;
        var py = 20;
        for (var pod of this.node.pods) {
            if (pod.namespace != 'kube-system') {
                var podBox = new Pod(pod, this.tooltip);
                podBox.x = px;
                podBox.y = py;
                nodeBox.addChild(podBox.draw());
                px += 13;
                if (px > 90) {
                    px = 24;
                    py += 13
                }
            }

        }
        var px = 24;
        var py = 100;
        for (var pod of this.node.pods) {
            if (pod.namespace == 'kube-system') {
                var podBox = new Pod(pod, this.tooltip);
                podBox.x = px;
                podBox.y = py;
                nodeBox.addChild(podBox.draw());
                px += 13;
                if (px > 90) {
                    px = 24;
                    py -= 13
                }
            }

        }
        return nodeBox
    }

}
