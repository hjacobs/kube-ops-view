import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
import {Pod, ALL_PODS} from './pod.js'
import SelectBox from './selectbox'
import { PRIMARY_VIOLET } from './colors.js'
import 'pixi-display'
const PIXI = require('pixi.js')


export default class App {

    constructor() {
        this.filterString = ''
        this.seenPods = {}
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
                        if (!name.includes(searchString)) {
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

        stage.displayList = new PIXI.DisplayList()

        const menuBar = new PIXI.Graphics()
        menuBar.beginFill(PRIMARY_VIOLET, 1)
        menuBar.drawRect(0, 0, window.innerWidth, 25)
        menuBar.endFill()
        stage.addChild(menuBar)

        const searchPrompt = new PIXI.Text('>', {fontFamily: 'ShareTechMono', fontSize: 18})
        searchPrompt.x = 20
        searchPrompt.y = 5
        PIXI.ticker.shared.add(function (_) {
            var v = Math.sin((PIXI.ticker.shared.lastTime % 2000) / 2000. * Math.PI)
            searchPrompt.alpha = v
        })
        stage.addChild(searchPrompt)

        const searchText = new PIXI.Text('', {fontFamily: 'ShareTechMono', fontSize: 18})
        searchText.x = 40
        searchText.y = 5
        stage.addChild(searchText)

        const items = [
            {
                text: 'Name', sorterFn: () => {}
            },
            {
                text: 'Age', sorterFn: () => {}
            },
            {
                text: 'Memory', sorterFn: () => {}
            },
            {
                text: 'CPU', sorterFn: () => {}
            },

        ]
        const selectBox = new SelectBox(items)
        selectBox.x = 265
        selectBox.y = 5
        const mainLayer = new PIXI.DisplayGroup(1, true)
        selectBox.displayGroup = mainLayer
        stage.addChild(selectBox.draw())

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
                this.filterString = this.filterString.slice(0, Math.max(0, this.filterString.length - 1))
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
        const pod = new Pod(originalPod.pod, this.tooltip, null)
        pod.draw()
        const targetPosition = new PIXI.Point(globalX, globalY)
        const angle = Math.random() * Math.PI * 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const distance = Math.max(200, Math.random() * Math.min(window.innerWidth, window.innerHeight))
        // blur filter looks cool, but has huge performance penalty
        // const blur = new PIXI.filters.BlurFilter(20, 2)
        // pod.filters = [blur]
        pod.pivot.x = pod.width / 2
        pod.pivot.y = pod.height / 2
        pod.alpha = 0
        pod._progress = 0
        originalPod.visible = false
        const that = this
        const tick = function (t) {
            // progress goes from 0 to 1
            const progress = Math.min(1, pod._progress + (0.01 * t))
            const scale = 1 + ((1 - progress) * 140)
            pod._progress = progress
            pod.x = targetPosition.x + (distance * cos * (1 - progress))
            pod.y = targetPosition.y + (distance * sin * (1 - progress))
            pod.alpha = progress
            pod.rotation = progress * progress * Math.PI * 2
            // blur.blur = (1 - alpha) * 20
            pod.scale.x = scale
            pod.scale.y = scale
            if (progress >= 1) {
                PIXI.ticker.shared.remove(tick)
                that.stage.removeChild(pod)
                originalPod.visible = true
            }
        }
        PIXI.ticker.shared.add(tick)
        this.stage.addChild(pod)
    }

    update(clusters) {
        this.viewContainer.removeChildren()
        var y = 0
        for (var cluster of clusters) {
            var clusterBox = new Cluster(cluster, this.tooltip)
            clusterBox.draw()
            clusterBox.x = 0
            clusterBox.y = y
            this.viewContainer.addChild(clusterBox)
            y += 270
        }
        this.filter()

        let i = 0
        const that = this
        const firstTime = Object.keys(this.seenPods).length == 0
        for (const key of Object.keys(ALL_PODS)) {
            if (!this.seenPods[key]) {
                const pod = ALL_PODS[key]
                this.seenPods[key] = pod
                const globalPos = pod.toGlobal({x: 0, y: 0})
                if (!firstTime && i < 10) {
                    window.setTimeout(function () {
                        that.animatePodCreation(pod, globalPos.x, globalPos.y)
                    }, 100 * i)
                }
                i++
            }
        }
    }

    tick(time) {
        this.renderer.render(this.stage)
    }

    run() {
        this.initialize()

        const that = this

        function fetchData() {
            fetch('kubernetes-clusters', {credentials: 'include'})
                .then(function (response) {
                    return response.json()
                })
                .then(function (json) {
                    const clusters = json.kubernetes_clusters
                    that.update(clusters)
                })
            window.setTimeout(fetchData, 5000)
        }

        fetchData()

        PIXI.ticker.shared.add(this.tick, this)
    }
}

module.exports = App
