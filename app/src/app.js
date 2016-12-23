import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
import {Pod, ALL_PODS, sortByName, sortByMemory, sortByCPU, sortByAge} from './pod.js'
import SelectBox from './selectbox'
import { PRIMARY_COLOR, SECONDARY_COLOR } from './colors.js'
import { DESATURATION_FILTER } from './filters.js'

const PIXI = require('pixi.js')


export default class App {

    constructor() {
        const hash = document.location.hash
        if (hash.startsWith('#q=')) {
            this.filterString = hash.substring(3)
        } else {
            this.filterString = ''
        }
        this.seenPods = new Set()
        this.sorterFn = ''
    }

    filter() {
        const searchString = this.filterString
        this.searchText.text = searchString
        if (searchString) {
            document.location.hash = '#q=' + searchString
        } else {
            document.location.hash = ''
        }
        const filter = DESATURATION_FILTER
        for (const cluster of this.viewContainer.children) {
            for (const node of cluster.children) {
                const name = node.pod && node.pod.name
                if (name) {
                    // node is actually unassigned pod
                    if (!name.includes(searchString)){
                        node.filters = [filter]
                    } else {
                        // TODO: pod might have other filters set..
                        node.filters = []
                    }
                }
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

        const menuBar = new PIXI.Graphics()
        menuBar.beginFill(SECONDARY_COLOR, 0.8)
        menuBar.drawRect(0, 0, window.innerWidth, 28)
        menuBar.lineStyle(2, SECONDARY_COLOR, 0.8)
        menuBar.moveTo(0, 28)
        menuBar.lineTo(window.innerWidth, 28)
        menuBar.lineStyle(1, PRIMARY_COLOR, 1)
        menuBar.drawRect(20, 3, 200, 22)
        stage.addChild(menuBar)

        const searchPrompt = new PIXI.Text('>', {fontFamily: 'ShareTechMono', fontSize: 14, fill: PRIMARY_COLOR})
        searchPrompt.x = 26
        searchPrompt.y = 8
        PIXI.ticker.shared.add(function (_) {
            var v = Math.sin((PIXI.ticker.shared.lastTime % 2000) / 2000. * Math.PI)
            searchPrompt.alpha = v
        })
        stage.addChild(searchPrompt)

        const searchText = new PIXI.Text('', {fontFamily: 'ShareTechMono', fontSize: 14, fill: PRIMARY_COLOR})
        searchText.x = 40
        searchText.y = 8
        stage.addChild(searchText)

        const items = [
            {
                text: 'SORT: NAME', sorterFn: sortByName
            },
            {
                text: 'SORT: AGE', sorterFn: sortByAge
            },
            {
                text: 'SORT: MEMORY', sorterFn: sortByMemory
            },
            {
                text: 'SORT: CPU', sorterFn: sortByCPU
            }
        ]
        //setting default sort
        App.sorterFn = items[0].sorterFn
        const selectBox = new SelectBox(items)
        selectBox.x = 265
        selectBox.y = 3
        menuBar.addChild(selectBox.draw())

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

    animatePodCreation(originalPod, globalPosition) {
        const pod = new Pod(originalPod.pod, null, this.tooltip)
        pod.draw()
        pod.interactive = false
        const targetPosition = globalPosition
        const angle = Math.random()*Math.PI*2
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
            pod.scale.set(scale)
            if (progress >= 1) {
                PIXI.ticker.shared.remove(tick)
                that.stage.removeChild(pod)
                pod.destroy()
                originalPod.visible = true
            }
        }
        PIXI.ticker.shared.add(tick)
        this.stage.addChild(pod)
    }
    animatePodDeletion(originalPod, globalPosition) {
        const pod = new Pod(originalPod.pod, null, this.tooltip)
        pod.draw()
        const globalCenter = new PIXI.Point(globalPosition.x + pod.width/2, globalPosition.y + pod.height/2)
        const blur = new PIXI.filters.BlurFilter(4)
        pod.filters = [blur]
        pod.position = globalPosition.clone()
        pod.alpha = 1
        pod._progress = 1
        originalPod.destroy()
        const that = this
        const tick = function(t) {
            // progress goes from 1 to 0
            const progress = Math.max(0, pod._progress - (0.02 * t))
            const scale = 1 + ((1 - progress) * 8)
            pod._progress = progress
            pod.alpha = progress
            pod.scale.set(scale)
            pod.position.set(globalCenter.x - pod.width/2, globalCenter.y - pod.height/2)

            if (progress <= 0) {
                PIXI.ticker.shared.remove(tick)
                that.stage.removeChild(pod)
                pod.destroy()
            }
        }
        PIXI.ticker.shared.add(tick)
        this.stage.addChild(pod)
    }
    update(clusters) {
        const that = this
        let changes = 0
        const firstTime = this.seenPods.size == 0
        const podKeys = new Set()
        for (const cluster of clusters) {
            for (const node of cluster.nodes) {
                for (const pod of node.pods) {
                    podKeys.add(cluster.api_server_url + '/' + pod.namespace + '/' + pod.name)
                }
            }
            for (const pod of cluster.unassigned_pods) {
                podKeys.add(cluster.api_server_url + '/' + pod.namespace + '/' + pod.name)
            }
        }
        for (const key of Object.keys(ALL_PODS)) {
            const pod = ALL_PODS[key]
            if (!podKeys.has(key)) {
                // pod was deleted
                delete ALL_PODS[key]
                this.seenPods.delete(key)
                if (changes < 10) {
                    // NOTE: we need to do this BEFORE removeChildren()
                    // to get correct global coordinates
                    const globalPos = pod.toGlobal({x: 0, y: 0})
                    window.setTimeout(function() {
                        that.animatePodDeletion(pod, globalPos)
                    }, 100 * changes)
                } else {
                    pod.destroy()
                }
                changes++
            }
        }
        this.viewContainer.removeChildren()
        let y = 0
        for (const cluster of clusters) {
            for (const node of cluster.nodes) {
                for (const pod of node.pods) {
                    podKeys.add(cluster.api_server_url + '/' + pod.namespace + '/' + pod.name)
                }
            }
            for (const pod of cluster.unassigned_pods) {
                podKeys.add(cluster.api_server_url + '/' + pod.namespace + '/' + pod.name)
            }
            const clusterBox = new Cluster(cluster, this.tooltip)
            clusterBox.draw()
            clusterBox.x = 0
            clusterBox.y = y
            this.viewContainer.addChild(clusterBox)
            y += 270
        }
        this.filter()

        for (const key of Object.keys(ALL_PODS)) {
            const pod = ALL_PODS[key]
            if (!this.seenPods.has(key)) {
                // pod was created
                this.seenPods.add(key)
                if (!firstTime && changes < 10) {
                    const globalPos = pod.toGlobal({x: 0, y: 0})
                    window.setTimeout(function() {
                        that.animatePodCreation(pod, globalPos)
                    }, 100 * changes)
                }
                changes++
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
