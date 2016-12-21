import {Pod} from './pod.js'
import Bars from './bars.js'
import {parseResource} from './utils.js'
const PIXI = require('pixi.js')

export default class Node extends PIXI.Graphics {
    constructor(node, tooltip) {
        super()
        this.node = node
        this.tooltip = tooltip
    }

    isMaster() {
        return this.node.labels.master == 'true'
    }

    getResourceUsage() {
        const resources = {}
        for (const key of Object.keys(this.node.status.capacity)) {
            resources[key] = {
                'capacity': parseResource(this.node.status.capacity[key]),
                'requested': 0,
                'used': 0
            }
        }
        if (this.node.usage) {
            for (const key of Object.keys(this.node.usage)) {
                resources[key]['used'] = parseResource(this.node.usage[key])
            }
        }
        for (const pod of this.node.pods) {
            for (const container of pod.containers) {
                if (container.resources && container.resources.requests) {
                    for (const key of Object.keys(container.resources.requests)) {
                        resources[key].requested += parseResource(container.resources.requests[key])
                    }
                }
            }
        }
        resources['pods'].requested = this.node.pods.length
        resources['pods'].used = this.node.pods.length
        return resources
    }

    draw () {
        var nodeBox = this
        var topHandle = new PIXI.Graphics()
        topHandle.beginFill(0xaaaaff, 1)
        topHandle.drawRect(0, 0, 105, 15)
        topHandle.endFill()
        const ellipsizedNodeName = this.node.name.substring(0, 20).concat('...')
        const text = new PIXI.Text(ellipsizedNodeName, {fontSize: 10, fill: 0x000000})
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        nodeBox.addChild(topHandle)
        nodeBox.lineStyle(2, 0xaaaaff, 1)
        nodeBox.beginFill(0x999999, 0.5)
        nodeBox.drawRect(0, 0, 105, 115)
        nodeBox.endFill()
        nodeBox.lineStyle(2, 0xaaaaaa, 1)
        topHandle.interactive = true
        topHandle.on('mouseover', function () {
            var s = nodeBox.node.name
            for (var key of Object.keys(nodeBox.node.labels)) {
                s += '\n' + key + ': ' + nodeBox.node.labels[key]
            }
            nodeBox.tooltip.text.text = s
            nodeBox.tooltip.x = nodeBox.toGlobal(new PIXI.Point(0, 0)).x
            nodeBox.tooltip.y = nodeBox.toGlobal(new PIXI.Point(0, 0)).y
            nodeBox.tooltip.visible = true
        })
        topHandle.on('mouseout', function () {
            nodeBox.tooltip.visible = false
        })
        const resources = this.getResourceUsage()
        const bars = new Bars(nodeBox, resources, nodeBox.tooltip)
        bars.x = 0
        bars.y = 1
        nodeBox.addChild(bars.draw())

        var px = 24
        var py = 20
        for (const pod of this.node.pods) {
            if (pod.namespace != 'kube-system') {
                const podBox = Pod.getOrCreate(pod, this.tooltip) //new Pod(pod, this.tooltip)
                podBox.x = px
                podBox.y = py
                nodeBox.addChild(podBox.draw())
                px += 13
                if (px > 90) {
                    px = 24
                    py += 13
                }
            }

        }
        px = 24
        py = 100
        for (const pod of this.node.pods) {
            if (pod.namespace == 'kube-system') {
                const podBox = Pod.getOrCreate(pod, this.tooltip) //new Pod(pod, this.tooltip)
                podBox.x = px
                podBox.y = py
                nodeBox.addChild(podBox.draw())
                px += 13
                if (px > 90) {
                    px = 24
                    py -= 13
                }
            }

        }
        return nodeBox
    }

}
