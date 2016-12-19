import Node from './node.js'
const PIXI = require('pixi.js')

export default class Cluster extends PIXI.Graphics {
    constructor (cluster, tooltip) {
        super()
        this.cluster = cluster
        this.tooltip = tooltip
    }

    draw () {
        var rows = [10, 10]
        for (var node of this.cluster.nodes) {
            var nodeBox = new Node(node, this.tooltip)
            nodeBox.draw()
            if (nodeBox.isMaster()) {
                nodeBox.x = rows[0]
                rows[0] += nodeBox.width + 5
                nodeBox.y = 20
            } else {
                nodeBox.x = rows[1]
                rows[1] += nodeBox.width + 5
                nodeBox.y = nodeBox.height + 25
            }
            this.addChild(nodeBox)
        }
        this.lineStyle(2, 0xaaaaff, 1);
        const width = Math.max(rows[0], rows[1])
        this.drawRect(0, 0, width, nodeBox.height * 2 + 30);

        var topHandle = new PIXI.Graphics()
        topHandle.beginFill(0xaaaaff, 1)
        topHandle.drawRect(0, 0, width, 15)
        topHandle.endFill()
        var text = new PIXI.Text(this.cluster.api_server_url, {fontSize: 10, fill: 0x000000})
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        this.addChild(topHandle)
    }

}
