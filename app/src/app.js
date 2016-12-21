import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
import { Pod, ALL_PODS } from './pod.js'
const PIXI = require('pixi.js')

const SEEN_PODS = {}

export default class App {
    constructor() {
        this.filterString = ''
    }

    filter() {
        const searchString = this.filterString
        this.searchText.text = searchString
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.desaturate()
        for (const cluster of this.viewContainer.children) {
            for (const node of cluster.children) {
                for (const pod of node.children) {
                    const name = pod.pod && pod.pod.name
                    if (name) {
                        if (!name.includes(searchString)){
                            pod.filters = [filter]
                        } else {
                            // TODO: pod might have other filters set..
                            pod.filters = []
                        }
                    }
                }
            }
        }
    }

    initialize() {
        //Create the renderer
        const renderer = PIXI.autoDetectRenderer(256, 256, {resolution: 2})
        renderer.view.style.position = 'absolute'
        renderer.view.style.display = 'block'
        renderer.autoResize = true
        renderer.resize(window.innerWidth, window.innerHeight)

        //Add the canvas to the HTML document
        document.body.appendChild(renderer.view)

        //Create a container object called the `stage`
        const stage = new PIXI.Container()

        const searchPrompt = new PIXI.Text('>', {fontSize: 18, fill: 0xaaaaff})
        searchPrompt.x = 20
        searchPrompt.y = 5
        PIXI.ticker.shared.add(function(_) {
            var v = Math.sin((PIXI.ticker.shared.lastTime % 2000)/2000.* Math.PI)
            searchPrompt.alpha = v
        })
        stage.addChild(searchPrompt)

        const searchText = new PIXI.Text('', {fontSize: 18, fill: 0xaaaaff})
        searchText.x = 40
        searchText.y = 5
        stage.addChild(searchText)

        const viewContainer = new PIXI.Container()
        viewContainer.x = 20
        viewContainer.y = 40
        stage.addChild(viewContainer)


        const tooltip = new Tooltip()
        tooltip.draw()
        stage.addChild(tooltip)

        function downHandler(event) {
            if (event.key && event.key.length == 1 && !event.ctrlKey && !event.metaKey) {
                this.filterString += event.key
                this.filter()
                event.preventDefault()
            }
            else if (event.key == 'Backspace') {
                this.filterString = this.filterString.slice(0, Math.max(0, this.filterString.length-1))
                this.filter()
                event.preventDefault()
            }
        }

        addEventListener(
            'keydown', downHandler.bind(this), false
        )

        this.renderer = renderer
        this.stage = stage
        this.searchText = searchText
        this.viewContainer = viewContainer
        this.tooltip = tooltip
    }

    animatePodCreation(originalPod, globalX, globalY) {
        const pod = new Pod(originalPod.pod, this.tooltip)
        pod.draw()
        pod.x = globalX
        pod.y = globalY
        const blur = new PIXI.filters.BlurFilter(60)
        pod.filters = [blur]
        pod.pivot.x = pod.width / 2
        pod.pivot.y = pod.height / 2
        pod.scale.x = 401
        pod.scale.y = 401
        pod.alpha = 0
        originalPod.visible = false
        const that = this
        const tick = function(t) {
            const alpha = Math.min(1, pod.alpha + (0.01 * t))
            const scale = 1 + ((1 - alpha) * 400)
            pod.alpha = alpha
            pod.rotation = alpha * alpha * Math.PI * 2
            blur.blur = (1 - alpha) * 60
            pod.scale.x = scale
            pod.scale.y = scale
            if (alpha >= 1) {
                PIXI.ticker.shared.remove(tick)
                that.stage.removeChild(pod)
                originalPod.visible = true
            }
        }
        PIXI.ticker.shared.add(tick)
        this.stage.addChild(pod)
    }

    run() {
        this.initialize()

        const that = this

        function update(clusters) {
            that.viewContainer.removeChildren()
            var y = 0
            for (var cluster of clusters) {
                var clusterBox = new Cluster(cluster, that.tooltip)
                clusterBox.draw()
                clusterBox.x = 0
                clusterBox.y = y
                that.viewContainer.addChild(clusterBox)
                y += 270
            }
            that.filter()

            let i = 0
            const firstTime = Object.keys(SEEN_PODS).length == 0
            for (const key of Object.keys(ALL_PODS)) {
                if (!SEEN_PODS[key]) {
                    const pod = ALL_PODS[key]
                    SEEN_PODS[key] = pod
                    const globalPos = pod.toGlobal({x: 0, y: 0})
                    if (!firstTime && i < 5) {
                        that.animatePodCreation(pod, globalPos.x, globalPos.y)
                    }
                    i++
                }
            }
        }

        function fetchData() {
            fetch('kubernetes-clusters', {credentials: 'include'})
            .then(function(response) {
                return response.json()
            })
            .then(function(json) {
                const clusters = json.kubernetes_clusters
                update(clusters)
            })
            window.setTimeout(fetchData, 5000)
        }

        fetchData()


        function mainLoop() {
            requestAnimationFrame(mainLoop)
            that.renderer.render(that.stage)
        }

        mainLoop()
    }
}

module.exports = App
