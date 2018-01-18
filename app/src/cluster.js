import Node from './node.js'
import { Pod } from './pod.js'
import App from './app.js'
const PIXI = require('pixi.js')

export default class Cluster extends PIXI.Graphics {
    constructor (cluster, status, tooltip) {
        super()
        this.cluster = cluster
        this.status = status
        this.tooltip = tooltip
    }

    destroy() {
        if (this.tick) {
            PIXI.ticker.shared.remove(this.tick, this)
        }
        super.destroy()
    }

    pulsate(_time) {
        const v = Math.sin((PIXI.ticker.shared.lastTime % 1000) / 1000. * Math.PI)
        this.alpha = 0.4 + (v * 0.6)
    }

    draw () {
        this.removeChildren()
        this.clear()
        const left = 10
        const top = 20
        const padding = 5
        let masterX = left
        let masterY = top
        let masterWidth = 0
        let masterHeight = 0
        let lbX = left
        let lbY = top
        let lbWidth = 0
        let lbHeight = 0
        let workerX = left
        let workerY = top
        let workerWidth = 0
        let workerHeight = 0
        const workerNodes = []
        const maxWidth = window.innerWidth - 130
        for (const nodeName of Object.keys(this.cluster.nodes).sort()) {
            const node = this.cluster.nodes[nodeName]
            var nodeBox = new Node(node, this, this.tooltip)
            nodeBox.draw()
            if (nodeBox.isMaster()) {
                if (masterX > maxWidth) {
                    masterWidth = masterX
                    masterX = left
                    masterY += nodeBox.height + padding
                    masterHeight += nodeBox.height + padding
                }
                if (masterHeight == 0) {
                    masterHeight = nodeBox.height + padding
                }
                nodeBox.x = masterX
                nodeBox.y = masterY
                masterX += nodeBox.width + padding
            } else if (nodeBox.isLB()) {
                if (lbX > maxWidth) {
                    lbWidth = lbX
                    lbX = masterX + 105 + padding
                    lbY += nodeBox.height + padding
                    lbHeight += masterHeight + nodeBox.height + padding
                }
                if (lbHeight == 0) {
                    lbHeight = masterHeight + nodeBox.height + padding
                }
                nodeBox.x = lbX
                nodeBox.y = lbY + masterHeight
                lbX += nodeBox.width + padding
            } else {
                if (workerX > maxWidth) {
                    workerWidth = workerX
                    workerX = left
                    workerY += nodeBox.height + padding
                    workerHeight += nodeBox.height + padding
                }
                workerNodes.push(nodeBox)
                if (workerHeight == 0) {
                    workerHeight = nodeBox.height + padding
                }
                nodeBox.x = workerX
                nodeBox.y = workerY
                workerX += nodeBox.width + padding
            }
            this.addChild(nodeBox)
        }
        for (const nodeBox of workerNodes) {
            nodeBox.y += lbHeight ? lbHeight : masterHeight
        }


        for (const pod of Object.values(this.cluster.unassigned_pods)) {
            var podBox = Pod.getOrCreate(pod, this, this.tooltip)
            podBox.x = masterX
            podBox.y = masterY
            podBox.draw()
            this.addChild(podBox)
            masterX += 20
        }
        masterWidth = Math.max(masterX, masterWidth)
        workerWidth = Math.max(workerX, workerWidth)

        this.lineStyle(2, App.current.theme.primaryColor, 1)
        const width = Math.max(masterWidth, lbWidth, workerWidth)
        this.drawRect(0, 0, width, top + (lbHeight ? lbHeight : masterHeight) + workerHeight)

        const topHandle = this.topHandle = new PIXI.Graphics()
        topHandle.beginFill(App.current.theme.primaryColor, 1)
        topHandle.drawRect(0, 0, width, 15)
        topHandle.endFill()
        topHandle.interactive = true
        topHandle.buttonMode = true
        const that = this
        topHandle.on('click', function(_event) {
            App.current.toggleCluster(that.cluster.id)
        })
        const text = new PIXI.Text(this.cluster.api_server_url, {fontFamily: 'ShareTechMono', fontSize: 10, fill: 0x000000})
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        this.addChild(topHandle)

        let newTick = null
        const nowSeconds = Date.now() / 1000
        if (this.status && this.status.last_query_time < nowSeconds - 20) {
            newTick = this.pulsate
        }

        if (newTick && newTick != this.tick) {
            this.tick = newTick
            // important: only register new listener if it does not exist yet!
            // (otherwise we leak listeners)
            PIXI.ticker.shared.add(this.tick, this)
        } else if (!newTick && this.tick) {
            PIXI.ticker.shared.remove(this.tick, this)
            this.tick = null
            this.alpha = 1
            this.tint = 0xffffff
        }
    }

}
