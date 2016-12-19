//Create the renderer
const renderer = PIXI.autoDetectRenderer(256, 256, {resolution: 2});
renderer.view.style.position = 'absolute';
renderer.view.style.display = 'block';
renderer.autoResize = true;
renderer.resize(window.innerWidth, window.innerHeight);

//Add the canvas to the HTML document
document.body.appendChild(renderer.view);


//Create a container object called the `stage`
const stage = new PIXI.Container();

var graphics = new PIXI.Graphics();


stage.addChild(graphics);

var clusters = []

const FACTORS = {
    'm': 1/1000,
    'Ki': 1000,
    'Mi': 1000 * 1000
}

function parseResource(v) {
    const match = v.match(/^(\d*)(\D*)$/)
    const factor = FACTORS[match[2]] || 1
    return parseInt(match[1]) * factor
}

class Tooltip extends PIXI.Graphics {
    constructor () {
        super()
    }
    draw () {
        var tooltip = this
        tooltip.lineStyle(1, 0x000000, 1)
        tooltip.beginFill(0x666666, 0.8)
        tooltip.drawRect(0, 0, 200, 400)
        tooltip.endFill()
        var text = new PIXI.Text('', {fontSize: 12, fill: 0xffffff})
        text.x = 2
        text.y = 2
        tooltip.addChild(text)
        tooltip.text = text
        tooltip.visible = false
    }
}

class Node extends PIXI.Graphics {
    constructor (node, tooltip) {
        super()
        this.node = node
        this.tooltip = tooltip
    }
    isMaster() {
        return this.node.labels.master == 'true'
    }
    getResourceUsage() {
        const resources = {}
        for (var key of Object.keys(this.node.status.capacity)) {
            resources[key] = {
                'capacity': parseResource(this.node.status.capacity[key]),
                'requested': 0,
                'used': 0
            }
        }
        if (this.node.usage) {
            for (var key of Object.keys(this.node.usage)) {
                resources[key]['used'] = parseResource(this.node.usage[key])
            }
        }
        for (var pod of this.node.pods) {
            for (var container of pod.spec.containers) {
                if (container.resources && container.resources.requests) {
                    for (var key of Object.keys(container.resources.requests)) {
                        resources[key].requested += parseResource(container.resources.requests[key])
                    }
                }
            }
        }
        resources['pods'].requested = this.node.pods.length
        return resources
    }
    draw () {
        var nodeBox = this
        var topHandle = new PIXI.Graphics()
        topHandle.beginFill(0xaaaaff, 1)
        topHandle.drawRect(0, 0, 105, 15)
        topHandle.endFill()
        var text = new PIXI.Text(this.node.name, {fontSize: 10, fill: 0x000000})
        text.cacheAsBitmap = true
        var mask = new PIXI.Graphics()
        mask.beginFill(0x0)
        mask.drawRect(0, 0, 100, 15)
        mask.endFill()
        text.mask = mask
        text.x = 2
        text.y = 2
        topHandle.addChild(text)
        nodeBox.addChild(topHandle)
        nodeBox.lineStyle(2, 0xaaaaff, 1);
        nodeBox.beginFill(0x999999, 0.5)
        nodeBox.drawRect(0, 0, 105, 115)
        nodeBox.endFill()
        nodeBox.lineStyle(2, 0xaaaaaa, 1);
        topHandle.interactive = true
        topHandle.on('mouseover', function() {
            var s = nodeBox.node.name
            for (var key of Object.keys(nodeBox.node.labels)) {
                s += '\n' + key + ': ' + nodeBox.node.labels[key]
            }
            nodeBox.tooltip.text.text = s
            nodeBox.tooltip.x = nodeBox.toGlobal(new PIXI.Point(0, 0)).x
            nodeBox.tooltip.y = nodeBox.toGlobal(new PIXI.Point(0,0)).y
            nodeBox.tooltip.visible = true
        })
        topHandle.on('mouseout', function() {
            nodeBox.tooltip.visible = false
        })
        const resources = this.getResourceUsage()
        const cpuHeight = 80 / resources.cpu.capacity
        nodeBox.lineStyle(2, 0xaaffaa, 1)
        nodeBox.beginFill(0xaaffaa, 1)
        nodeBox.drawRect(3, 110 - resources.cpu.requested * cpuHeight, 3, resources.cpu.requested * cpuHeight)
        nodeBox.drawRect(5, 110 - resources.cpu.used * cpuHeight, 5, resources.cpu.used * cpuHeight)
        nodeBox.endFill()
        nodeBox.lineStyle(2, 0xaaaaaa, 1);
        for (var i=0; i<resources.cpu.capacity; i++) {
            nodeBox.drawRect(5, 110 - (i+1) * cpuHeight, 5, cpuHeight)
        }

        const scale = resources.memory.capacity / 80
        nodeBox.drawRect(14, 110 - resources.memory.capacity/scale, 5, resources.memory.capacity/scale)
        nodeBox.lineStyle(2, 0xaaffaa, 1)
        nodeBox.beginFill(0xaaffaa, 1)
        nodeBox.drawRect(13, 110 - resources.memory.requested/scale, 3, resources.memory.requested/scale)
        nodeBox.drawRect(15, 110 - resources.memory.used/scale, 3, resources.memory.used/scale)
        nodeBox.endFill()
        var text = new PIXI.Text('', {fontSize: 10, fill: 0xffffff})
        nodeBox.addChild(text)

        var px = 24
        var py = 20
        for (var pod of this.node.pods) {
            if (pod.metadata.namespace != 'kube-system') {
                var podBox = new Pod(pod, this.tooltip)
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
        var px = 24
        var py = 100
        for (var pod of this.node.pods) {
            if (pod.metadata.namespace == 'kube-system') {
                var podBox = new Pod(pod, this.tooltip)
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

class Pod extends PIXI.Graphics {
    constructor (pod, tooltip) {
        super()
        this.pod = pod
        this.tooltip = tooltip
    }

    draw() {
        // pod.status.containerStatuses might be undefined!
        const containerStatuses = this.pod.status.containerStatuses || []
        var ready = 0
        for (var containerStatus of containerStatuses) {
            if (containerStatus.ready) {
                ready++
            }
        }
        const allReady = ready >= containerStatuses.length

        const podBox = this
        podBox.interactive = true
        podBox.on('mouseover', function() {
            var filter = new PIXI.filters.ColorMatrixFilter()
            filter.brightness(1.3)
            podBox.filters = [filter]
            var s = this.pod.metadata.name
            for (var key of Object.keys(this.pod.metadata.labels)) {
                if (key !== 'pod-template-hash') {
                    s += '\n' + key + ': ' + this.pod.metadata.labels[key]
                }
            }
            s += '\nStatus: ' + this.pod.status.phase
            s += '\nReady: ' + ready + '/' + containerStatuses.length
            for (var containerStatus of containerStatuses) {
                var key = Object.keys(containerStatus.state)[0]
                s += '\n' + key
                if (containerStatus.state[key].reason) {
                    // "CrashLoopBackOff"
                    s += ': ' + containerStatus.state[key].reason
                }
            }
            this.tooltip.text.text = s
            this.tooltip.x = this.toGlobal(new PIXI.Point(10, 10)).x
            this.tooltip.y = this.toGlobal(new PIXI.Point(10, 10)).y
            this.tooltip.visible = true
            // console.log(this.pod)
        })
        podBox.on('mouseout', function() {
            podBox.filters = []
            this.tooltip.visible = false
        })
        podBox.lineStyle(2, 0xaaaaaa, 1);
        var i = 0
        var w = 10 / this.pod.spec.containers.length
        for (var container of this.pod.spec.containers) {
            podBox.drawRect(0 + i * w, 0, w, 10)
            i++
        }
        if (this.pod.status.phase == 'Succeeded') {
            // completed Job
            podBox.lineStyle(2, 0xaaaaff, 1);
        } else if (this.pod.status.phase == 'Running' && allReady) {
            podBox.lineStyle(2, 0xaaffaa, 1);
        } else if (this.pod.status.phase == 'Pending') {
            podBox.lineStyle(2, 0xffffaa, 1);
        } else {

            PIXI.ticker.shared.add(function(_) {
                var v = Math.sin((PIXI.ticker.shared.lastTime % 1000)/1000.* Math.PI)
                podBox.tint = PIXI.utils.rgb2hex([1, v, v])
            })
            podBox.lineStyle(2, 0xff9999, 1);
        }
        podBox.beginFill(0x999999, 0.5)
        podBox.drawRect(0, 0, 10, 10)
        return this
    }
}

var tooltip = new Tooltip()
tooltip.draw()

function update(clusters) {
    graphics.removeChildren();
    graphics.lineStyle(2, 0xaaaaff, 1);
    var x = 50;
    for (var cluster of clusters) {
        var clusterBox = new PIXI.Graphics()
        clusterBox.x = x
        clusterBox.y = 50
        graphics.addChild(clusterBox)
        var rows = [10, 10]
        for (var node of cluster.nodes) {
            var nodeBox = new Node(node, tooltip)
            nodeBox.draw()
            if (nodeBox.isMaster()) {
                nodeBox.x = rows[0]
                rows[0] += nodeBox.width + 5
                nodeBox.y = 10
            } else {
                nodeBox.x = rows[1]
                rows[1] += nodeBox.width + 5
                nodeBox.y = nodeBox.height + 15
            }
            clusterBox.addChild(nodeBox)
        }
        clusterBox.lineStyle(2, 0xaaaaff, 1);
        clusterBox.drawRect(0, 0, Math.max(rows[0], rows[1]), nodeBox.height * 2 + 20);
        x += 250;
    }
    graphics.addChild(tooltip)
}

function fetchData() {
    fetch('kubernetes-clusters')
    .then(function(response) {
        return response.json()
    })
    .then(function(json) {
        clusters = json.kubernetes_clusters;
        update(clusters)
    });
    window.setTimeout(fetchData, 5000)
}

fetchData()

function state() {
}

function mainLoop() {
    requestAnimationFrame(mainLoop);

    state();

    //Tell the `renderer` to `render` the `stage`
    renderer.render(stage);
}

mainLoop();
