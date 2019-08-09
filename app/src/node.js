import {Pod} from './pod.js'
import Bars from './bars.js'
import {parseResource} from './utils.js'
import App from './app'
const PIXI = require('pixi.js')


export const isMaster = (labels) => {
    for (var key in labels) {
        if (key == 'node-role.kubernetes.io/master' ||
            key == 'kubernetes.io/role' && labels[key] == 'master' ||
            key == 'master' && labels[key] == 'true' ) {
            return true
        }
    }
}

export class Node extends PIXI.Graphics {
    constructor(node, cluster, tooltip, podsPerRow, widthOfNodePx, heightOfNodePx) {
        super()
        this.node = node
        this.cluster = cluster
        this.tooltip = tooltip
        this.podsPerRow = podsPerRow
        this.widthOfNodePx = widthOfNodePx
        this.heightOfNodePx = heightOfNodePx
    }

    getResourceUsage() {
        const resources = {}
        for (const key of Object.keys(this.node.status.capacity)) {
            resources[key] = {
                'capacity': parseResource(this.node.status.capacity[key]),
                'reserved': 0,
                'requested': 0,
                'used': 0
            }
            const allocatable = this.node.status.allocatable[key]
            if (allocatable) {
                resources[key]['reserved'] = resources[key]['capacity'] - parseResource(allocatable)
            }
        }
        if (this.node.usage) {
            for (const key of Object.keys(this.node.usage)) {
                resources[key]['used'] = parseResource(this.node.usage[key])
            }
        }
        let numberOfPods = 0
        for (const pod of Object.values(this.node.pods)) {
            numberOfPods++
            // do not account for completed jobs
            if (pod.phase != 'Succeeded') {
                for (const container of pod.containers) {
                    if (container.resources && container.resources.requests) {
                        for (const key of Object.keys(container.resources.requests)) {
                            resources[key].requested += parseResource(container.resources.requests[key])
                        }
                    }
                }
            }
        }
        resources['pods'].requested = numberOfPods
        resources['pods'].used = numberOfPods
        return resources
    }

    draw() {
        const nodeBox = this
        const topHandle = new PIXI.Graphics()
        topHandle.beginFill(App.current.theme.primaryColor, 1)
        topHandle.drawRect(0, 0, this.widthOfNodePx, App.current.heightOfTopHandlePx)
        topHandle.endFill()

        // there is about 2.83 letters per pod
        const roomForText = Math.floor(2.83 * this.podsPerRow)
        const ellipsizedNodeName = this.node.name.length > roomForText ? this.node.name.substring(0, roomForText).concat('…') : this.node.name
        const text = new PIXI.Text(ellipsizedNodeName, {fontFamily: 'ShareTechMono', fontSize: 10, fill: 0x000000})
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        nodeBox.addChild(topHandle)
        nodeBox.lineStyle(2, App.current.theme.primaryColor, 1)
        nodeBox.beginFill(App.current.theme.secondaryColor, 1)
        nodeBox.drawRect(0, 0, this.widthOfNodePx, this.heightOfNodePx)
        nodeBox.endFill()
        nodeBox.lineStyle(2, 0xaaaaaa, 1)
        topHandle.interactive = true
        topHandle.on('mouseover', function () {
            let s = nodeBox.node.name
            s += '\nLabels:'
            for (const key of Object.keys(nodeBox.node.labels).sort()) {
                s += '\n  ' + key + ': ' + nodeBox.node.labels[key]
            }
            nodeBox.tooltip.setText(s)
            nodeBox.tooltip.position = nodeBox.toGlobal(new PIXI.Point(0, App.current.heightOfTopHandlePx))
            nodeBox.tooltip.visible = true
        })
        topHandle.on('mouseout', function () {
            nodeBox.tooltip.visible = false
        })
        if (App.current.config.nodeLinkUrlTemplate !== null) {
            topHandle.buttonMode = true
            topHandle.on('click', function() {
                location.href = App.current.config.nodeLinkUrlTemplate.replace('{cluster}', nodeBox.cluster.cluster.id).replace('{name}', nodeBox.node.name)
            })
        }
        const resources = this.getResourceUsage()
        const bars = new Bars(nodeBox, resources, nodeBox.tooltip)
        bars.x = 0
        bars.y = 1
        nodeBox.addChild(bars.draw())

        nodeBox.addPods(App.current.sorterFn)
        return nodeBox
    }

    addPods(sorterFn) {
        const nodeBox = this
        const px = App.current.startDrawingPodsAt
        const py = App.current.heightOfTopHandlePx + 5
        let podsCounter = 0
        let podsKubeSystemCounter = 0
        const pods = Object.values(this.node.pods).sort(sorterFn)
        for (const pod of pods) {
            if (pod.namespace != 'kube-system') {
                const podBox = Pod.getOrCreate(pod, this.cluster, this.tooltip)
                podBox.movePodTo(
                    new PIXI.Point(
                        // we have a room for this.cluster.podsPerRow pods
                        px + (App.current.sizeOfPodPx * (podsCounter % this.podsPerRow)),
                        // we just count when to get to another row
                        py + (App.current.sizeOfPodPx * Math.floor(podsCounter / this.podsPerRow))
                    )
                )
                nodeBox.addChild(podBox.draw())
                podsCounter++
            } else {
                // kube-system pods
                const podBox = Pod.getOrCreate(pod, this.cluster, this.tooltip)
                podBox.movePodTo(
                    new PIXI.Point(
                        // we have a room for this.cluster.podsPerRow pods
                        px + (App.current.sizeOfPodPx * (podsKubeSystemCounter % this.podsPerRow)),
                        // like above (for not kube-system pods), but we count from the bottom
                        this.heightOfNodePx - App.current.sizeOfPodPx - 2 - (App.current.sizeOfPodPx * Math.floor(podsKubeSystemCounter / this.podsPerRow))
                    )
                )
                nodeBox.addChild(podBox.draw())
                podsKubeSystemCounter++
            }
        }
    }
}
