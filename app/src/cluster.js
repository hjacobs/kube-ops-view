import Node from './node.js'
import { Pod } from './pod.js'
import App from './app.js'
const PIXI = require('pixi.js')

export default class Cluster extends PIXI.Graphics {
    constructor (cluster, tooltip) {
        super()
        this.cluster = cluster
        this.tooltip = tooltip
    }

    draw () {
        const left = 10
        const top = 20
        const padding = 5
        let masterX = left
        let masterY = top
        let masterWidth = 0
        let masterHeight = 0
        let workerX = left
        let workerY = top
        let workerWidth = 0
        let workerHeight = 0
        const workerNodes = []
        const maxWidth = window.innerWidth - 130
        for (const node of this.cluster.nodes) {
            var nodeBox = new Node(node, this, this.tooltip)
            nodeBox.draw()
            if (nodeBox.isMaster()) {
                if (masterHeight == 0) {
                    masterHeight = nodeBox.height + padding
                }
                nodeBox.x = masterX
                nodeBox.y = masterY
                masterX += nodeBox.width + padding
                if (masterX > maxWidth) {
                    masterWidth = masterX
                    masterX = left
                    masterY += nodeBox.height + padding
                    masterHeight += nodeBox.height + padding
                }
            } else {
                workerNodes.push(nodeBox)
                if (workerHeight == 0) {
                    workerHeight = nodeBox.height + padding
                }
                nodeBox.x = workerX
                nodeBox.y = workerY
                workerX += nodeBox.width + padding
                if (workerX > maxWidth) {
                    workerWidth = workerX
                    workerX = left
                    workerY += nodeBox.height + padding
                    workerHeight += nodeBox.height + padding
                }
            }
            this.addChild(nodeBox)
        }
        for (const nodeBox of workerNodes) {
            nodeBox.y += masterHeight
        }


        for (const pod of this.cluster.unassigned_pods) {
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
        const width = Math.max(masterWidth, workerWidth)
        this.drawRect(0, 0, width, top + masterHeight + workerHeight)

        var topHandle = new PIXI.Graphics()
        topHandle.beginFill(App.current.theme.primaryColor, 1)
        topHandle.drawRect(0, 0, width, 15)
        topHandle.endFill()
        topHandle.interactive = true
        topHandle.buttonMode = true
        const that = this
        topHandle.on('click', function(event) {
            App.current.toggleCluster(that.cluster.id)
        })
        var text = new PIXI.Text(this.cluster.api_server_url, {fontFamily: 'ShareTechMono', fontSize: 10, fill: 0x000000})
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        this.addChild(topHandle)
    }

}
