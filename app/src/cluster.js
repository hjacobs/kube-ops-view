import { Node, isMaster } from './node.js'
import { Pod } from './pod.js'
import App from './app.js'
const PIXI = require('pixi.js')

export default class Cluster extends PIXI.Graphics {
    constructor (cluster, status, tooltip, config) {
        super()
        this.cluster = cluster
        this.status = status
        this.tooltip = tooltip
        this.config = config
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
        let workerX = left
        let workerY = top
        let workerWidth = 0
        let workerHeight = 0
        const workerNodes = []
        
        let maxPodsInWorkers = 0
        let maxPodsInMasters = 0
        // get the largest number of pods (workers and masters)
        for (const n of Object.values(this.cluster.nodes)) {
            const podsInNode = Object.values(n.pods).length

            if (isMaster(n.labels)) {
                if (podsInNode >= maxPodsInMasters) {
                    maxPodsInMasters = podsInNode
                }
            } else {
                if (podsInNode >= maxPodsInWorkers) {
                    maxPodsInWorkers = podsInNode
                }
            }
        }
        
        // with maxPodsInWorkers we can calculate the size of all nodes in the cluster
        this.podsPerRowWorker = Math.max(
            App.current.defaultPodsPerRow,
            Math.ceil(Math.sqrt(maxPodsInWorkers))
        )
        this.podsPerRowMaster = Math.max(
            App.current.defaultPodsPerRow,
            Math.ceil(Math.sqrt(maxPodsInMasters))
        )

        this.widthOfWorkerNodePx = Math.max(
            App.current.defaultWidthOfNodePx,
            Math.floor(this.podsPerRowWorker * App.current.sizeOfPodPx + App.current.startDrawingPodsAt + 2)
        )
        this.widthOfMasterNodePx = Math.max(
            App.current.defaultWidthOfNodePx,
            Math.floor(this.podsPerRowMaster * App.current.sizeOfPodPx + App.current.startDrawingPodsAt + 2)
        )

        this.heightOfWorkerNodePx = Math.max(
            App.current.defaultHeightOfNodePx,
            Math.floor(this.podsPerRowWorker * App.current.sizeOfPodPx + App.current.heightOfTopHandlePx + (App.current.sizeOfPodPx * 2) + 2)
        )
        this.heightOfMasterNodePx = Math.max(
            App.current.defaultHeightOfNodePx,
            Math.floor(this.podsPerRowMaster * App.current.sizeOfPodPx + App.current.heightOfTopHandlePx + (App.current.sizeOfPodPx * 2) + 2)
        )

        const maxWidth = (window.innerWidth * (1/this.config.initialScale)) - (this.heightOfWorkerNodePx * 1.2)

        for (const nodeName of Object.keys(this.cluster.nodes).sort()) {
            const node = this.cluster.nodes[nodeName]
            let nodeBox = null
         
            if (isMaster(node.labels)) {
                nodeBox = new Node(node, this, this.tooltip, this.podsPerRowMaster, this.widthOfMasterNodePx, this.heightOfMasterNodePx)
                nodeBox.draw()

                if (masterX > maxWidth) {
                    masterWidth = masterX
                    masterX = left
                    masterY += this.heightOfMasterNodePx + padding
                    masterHeight += this.heightOfMasterNodePx + padding
                }
                if (masterHeight == 0) {
                    masterHeight = this.heightOfMasterNodePx + padding
                }
                nodeBox.x = masterX
                nodeBox.y = masterY
                masterX += this.widthOfMasterNodePx + padding
            } else {
                nodeBox = new Node(node, this, this.tooltip, this.podsPerRowWorker, this.widthOfWorkerNodePx, this.heightOfWorkerNodePx)
                nodeBox.draw()

                if (workerX > maxWidth) {
                    workerWidth = workerX
                    workerX = left
                    workerY += this.heightOfWorkerNodePx + padding
                    workerHeight += this.heightOfWorkerNodePx + padding
                }
                workerNodes.push(nodeBox)
                if (workerHeight == 0) {
                    workerHeight = this.heightOfWorkerNodePx + padding
                }
                nodeBox.x = workerX
                nodeBox.y = workerY
                workerX += this.widthOfWorkerNodePx + padding
            }
            this.addChild(nodeBox)
        }
        for (const nodeBox of workerNodes) {
            nodeBox.y += masterHeight
        }

        /*
            Place unassigned pods to the right of the master nodes, or
            to the right of the worker nodes if there were no masters.
         */
        var unassignedX = masterX === left ? workerX : masterX

        for (const pod of Object.values(this.cluster.unassigned_pods)) {
            var podBox = Pod.getOrCreate(pod, this, this.tooltip)
            podBox.x = unassignedX
            podBox.y = masterY
            podBox.draw()
            this.addChild(podBox)
            unassignedX += 20
        }

        this.lineStyle(2, App.current.theme.primaryColor, 1)
        const width = Math.max(masterX, masterWidth, workerX, workerWidth, unassignedX)
        this.drawRect(0, 0, width, top + masterHeight + workerHeight)

        const topHandle = this.topHandle = new PIXI.Graphics()
        topHandle.beginFill(App.current.theme.primaryColor, 1)
        topHandle.drawRect(0, 0, width, App.current.heightOfTopHandlePx)
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
