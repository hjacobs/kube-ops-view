import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
import {Pod, ALL_PODS, sortByName, sortByMemory, sortByCPU, sortByAge} from './pod.js'
import SelectBox from './selectbox'
import {Theme, ALL_THEMES} from './themes.js'
import {DESATURATION_FILTER} from './filters.js'
import {JSON_delta} from './vendor/json_delta.js'
import Config from './config.js'

const PIXI = require('pixi.js')

const addWheelListener = require('./vendor/addWheelListener')


export default class App {

    constructor() {
        const params = this.parseLocationHash()
        this.config = Config.fromParams(params)
        this.filterString = (params.get('q') && decodeURIComponent(params.get('q'))) || ''
        this.selectedClusters = new Set((params.get('clusters') || '').split(',').filter(x => x))
        this.seenPods = new Set()
        this.sorterFn = ''
        this.theme = Theme.get(localStorage.getItem('theme'))
        this.eventSource = null
        this.connectTime = null
        this.keepAliveTimer = null
        this.clusters = new Map()
        this.clusterStatuses = new Map()
        this.viewContainerTargetPosition = new PIXI.Point()
        this.bootstrapping = true
    }

    parseLocationHash() {
        // hash startswith #
        const hash = document.location.hash.substring(1)
        const params = new Map()
        for (const pair of hash.split(';')) {
            const keyValue = pair.split('=', 2)
            if (keyValue.length == 2) {
                params.set(keyValue[0], keyValue[1])
            }
        }
        return params
    }

    changeLocationHash(key, value) {
        const params = this.parseLocationHash()
        params.set(key, value)
        const pairs = []
        for (const [key, value] of params) {
            if (value) {
                pairs.push(key + '=' + encodeURIComponent(value))
            }
        }

        document.location.hash = '#' + pairs.sort().join(';')
    }

    nameMatches(pod, searchString) {
        const name = pod.name
        return name && name.includes(searchString)
    }

    labelMatches(pod, name, value) {
        const labels = pod.labels
        return labels && labels[name] === value
    }

    createMatchesFunctionForQuery(query) {
        if (query.includes('=')) {
            const labelAndValue = query.split('=', 2)
            return pod => this.labelMatches(pod, labelAndValue[0], labelAndValue[1])
        } else {
            return pod => this.nameMatches(pod, query)
        }
    }

    filter() {
        const searchString = this.filterString
        if (this.searchText) {
            // this.searchText might be undefined (dashboard mode)
            this.searchText.text = searchString
        }
        this.changeLocationHash('q', searchString)
        const elementDisplayFilter = DESATURATION_FILTER
        const filterableElements = []
        const matchesQuery = this.createMatchesFunctionForQuery(searchString)
        for (const cluster of this.viewContainer.children) {
            for (const node of cluster.children) {
                if (node.pod) { // node is actually unassigned pod
                    filterableElements.push(node)
                }
                for (const pod of node.children) {
                    if (pod.pod) {
                        filterableElements.push(pod)
                    }
                }
            }
        }
        filterableElements.forEach(value => {
            if (!matchesQuery(value.pod)) {
                value.filters = [elementDisplayFilter]
            } else {
                // TODO: pod might have other filters set..
                value.filters = []
            }
        })
    }

    initialize() {
        App.current = this

        // create the renderer
        const noWebGL = this.config.renderer === 'canvas'
        const renderer = PIXI.autoDetectRenderer(256, 256, {resolution: 2}, noWebGL)
        renderer.view.style.display = 'block'
        renderer.autoResize = true
        renderer.resize(window.innerWidth, window.innerHeight)

        window.onresize = function () {
            renderer.resize(window.innerWidth, window.innerHeight)
        }

        //Add the canvas to the HTML document
        document.body.appendChild(renderer.view)
        this.renderer = renderer

        //Create a container object called the `stage`
        this.stage = new PIXI.Container()

        this.registerEventListeners()
        setInterval(this.pruneUnavailableClusters.bind(this), 5 * 1000)

        if (this.config.reloadIntervalSeconds) {
            setTimeout(function () {
                location.reload(false)
            }, this.config.reloadIntervalSeconds * 1000)
        }
    }

    registerEventListeners() {
        function downHandler(event) {
            const panAmount = 20
            if (event.key == 'ArrowLeft') {
                this.viewContainerTargetPosition.x += panAmount
            }
            else if (event.key == 'ArrowRight') {
                this.viewContainerTargetPosition.x -= panAmount
            }
            if (event.key == 'ArrowUp') {
                this.viewContainerTargetPosition.y += panAmount
            }
            else if (event.key == 'ArrowDown') {
                this.viewContainerTargetPosition.y -= panAmount
            }
            if (event.key == 'PageUp') {
                this.viewContainerTargetPosition.y += window.innerHeight
            }
            else if (event.key == 'PageDown') {
                this.viewContainerTargetPosition.y -= window.innerHeight
            }
            else if (event.key == 'Home') {
                this.viewContainerTargetPosition.x = 20
                this.viewContainerTargetPosition.y = this.config.dashboardMode ? 20 : 40
            }
            else if (event.key && event.key.length == 1 && !event.ctrlKey && !event.metaKey) {
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

        var isDragging = false,
            prevX, prevY

        function mouseDownHandler(event) {
            if (event.button == 0 || event.button == 1) {
                prevX = event.clientX
                prevY = event.clientY
                isDragging = true
                this.renderer.view.style.cursor = 'move'
            }
        }

        function mouseMoveHandler(event) {
            if (!isDragging) {
                return
            }
            var dx = event.clientX - prevX
            var dy = event.clientY - prevY

            this.viewContainer.x += dx
            this.viewContainer.y += dy
            // stop any current move animation
            this.viewContainerTargetPosition.x = this.viewContainer.x
            this.viewContainerTargetPosition.y = this.viewContainer.y
            prevX = event.clientX
            prevY = event.clientY
        }

        function mouseUpHandler(_event) {
            isDragging = false
            this.renderer.view.style.cursor = 'default'
        }

        function touchStartHandler(event) {
            if (event.touches.length == 1) {
                const touch = event.touches[0]
                prevX = touch.clientX
                prevY = touch.clientY
                isDragging = true
            }
        }

        function touchMoveHandler(event) {
            if (!isDragging) {
                return
            }
            if (event.touches.length == 1) {
                const touch = event.touches[0]
                var dx = touch.clientX - prevX
                var dy = touch.clientY - prevY

                this.viewContainer.x += dx
                this.viewContainer.y += dy
                // stop any current move animation
                this.viewContainerTargetPosition.x = this.viewContainer.x
                this.viewContainerTargetPosition.y = this.viewContainer.y
                prevX = touch.clientX
                prevY = touch.clientY
            }
        }

        function touchEndHandler(_event) {
            isDragging = false
        }

        addEventListener('keydown', downHandler.bind(this), false)
        addEventListener('mousedown', mouseDownHandler.bind(this), false)
        addEventListener('mousemove', mouseMoveHandler.bind(this), false)
        addEventListener('mouseup', mouseUpHandler.bind(this), false)
        addEventListener('touchstart', touchStartHandler.bind(this), false)
        addEventListener('touchmove', touchMoveHandler.bind(this), false)
        addEventListener('touchend', touchEndHandler.bind(this), false)

        const that = this
        const interactionObj = new PIXI.interaction.InteractionData()

        function getLocalCoordinates(x, y) {
            return interactionObj.getLocalPosition(that.viewContainer, undefined, {x: x, y: y})
        }

        const minScale = 1 / 32
        const maxScale = 32

        function zoom(x, y, isZoomIn) {
            const direction = isZoomIn ? 1 : -1
            const factor = (1 + direction * 0.1)
            const newScale = Math.min(Math.max(that.viewContainer.scale.x * factor, minScale), maxScale)
            that.viewContainer.scale.set(newScale)

            // zoom around one point on ViewContainer
            const beforeTransform = getLocalCoordinates(x, y)
            that.viewContainer.updateTransform()
            const afterTransform = getLocalCoordinates(x, y)

            that.viewContainer.x += (afterTransform.x - beforeTransform.x) * newScale
            that.viewContainer.y += (afterTransform.y - beforeTransform.y) * newScale

            // stop any current move animation
            that.viewContainerTargetPosition.x = that.viewContainer.x
            that.viewContainerTargetPosition.y = that.viewContainer.y
        }

        addWheelListener(this.renderer.view, function (e) {
            zoom(e.clientX, e.clientY, e.deltaY < 0)
        })
    }

    drawMenuBar() {
        const menuBar = new PIXI.Graphics()
        menuBar.beginFill(this.theme.secondaryColor, 1)
        menuBar.drawRect(0, 0, this.renderer.width, 28)
        menuBar.lineStyle(2, this.theme.secondaryColor, 1)
        menuBar.moveTo(0, 28)
        menuBar.lineTo(this.renderer.width, 28)
        menuBar.lineStyle(1, this.theme.primaryColor, 1)
        menuBar.drawRect(20, 3, 200, 22)
        this.stage.addChild(menuBar)

        const searchPrompt = new PIXI.Text('>', {
            fontFamily: 'ShareTechMono',
            fontSize: 14,
            fill: this.theme.primaryColor
        })
        searchPrompt.x = 26
        searchPrompt.y = 8
        PIXI.ticker.shared.add(function (_) {
            var v = Math.sin((PIXI.ticker.shared.lastTime % 2000) / 2000. * Math.PI)
            searchPrompt.alpha = v
        })
        this.stage.addChild(searchPrompt)

        const searchText = new PIXI.Text('', {fontFamily: 'ShareTechMono', fontSize: 14, fill: this.theme.primaryColor})
        searchText.x = 40
        searchText.y = 8
        this.stage.addChild(searchText)

        const items = [
            {
                text: 'SORT: NAME', value: sortByName
            },
            {
                text: 'SORT: AGE', value: sortByAge
            },
            {
                text: 'SORT: MEMORY', value: sortByMemory
            },
            {
                text: 'SORT: CPU', value: sortByCPU
            }
        ]
        //setting default sort
        this.sorterFn = items[0].value
        const app = this
        const selectBox = new SelectBox(items, this.sorterFn, function (value) {
            app.changeSorting(value)
        })
        selectBox.x = 265
        selectBox.y = 3
        menuBar.addChild(selectBox.draw())

        const themeOptions = Object.keys(ALL_THEMES).sort().map(name => {
            return {text: name.toUpperCase(), value: name}
        })
        const themeSelector = new SelectBox(themeOptions, this.theme.name, function (value) {
            app.switchTheme(value)
        })
        themeSelector.x = 420
        themeSelector.y = 3
        menuBar.addChild(themeSelector.draw())

        this.searchText = searchText
    }

    draw() {
        this.stage.removeChildren()
        this.theme.apply(this.stage)

        const viewContainer = new PIXI.Container()
        viewContainer.scale.set(this.config.initialScale)
        viewContainer.x = 20
        viewContainer.y = this.config.dashboardMode ? 20 : 40
        this.viewContainerTargetPosition.x = viewContainer.x
        this.viewContainerTargetPosition.y = viewContainer.y
        this.stage.addChild(viewContainer)

        if (!this.config.dashboardMode) {
            this.drawMenuBar()
        }

        const tooltip = new Tooltip()
        tooltip.draw()
        this.stage.addChild(tooltip)

        this.viewContainer = viewContainer
        this.tooltip = tooltip
    }

    animatePodCreation(originalPod, globalPosition) {
        const pod = new Pod(originalPod.pod, null, this.tooltip)
        pod.draw()
        pod.blendMode = PIXI.BLEND_MODES.ADD
        pod.interactive = false
        const targetPosition = globalPosition
        const angle = Math.random() * Math.PI * 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const distance = Math.max(200, Math.random() * Math.min(this.renderer.width, this.renderer.height))
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
        pod.blendMode = PIXI.BLEND_MODES.ADD
        const globalCenter = new PIXI.Point(globalPosition.x + pod.width / 2, globalPosition.y + pod.height / 2)
        const blur = new PIXI.filters.BlurFilter(4)
        pod.filters = [blur]
        pod.position = globalPosition.clone()
        pod.alpha = 1
        pod._progress = 1
        originalPod.destroy()
        const that = this
        const tick = function (t) {
            // progress goes from 1 to 0
            const progress = Math.max(0, pod._progress - (0.02 * t))
            const scale = 1 + ((1 - progress) * 8)
            pod._progress = progress
            pod.alpha = progress
            pod.scale.set(scale)
            pod.position.set(globalCenter.x - pod.width / 2, globalCenter.y - pod.height / 2)

            if (progress <= 0) {
                PIXI.ticker.shared.remove(tick)
                that.stage.removeChild(pod)
                pod.destroy()
            }
        }
        PIXI.ticker.shared.add(tick)
        this.stage.addChild(pod)
    }

    update() {
        // make sure we create a copy (this.clusters might get modified)
        const clusters = Array.from(this.clusters.entries()).sort().map(idCluster => idCluster[1])
        const that = this
        let changes = 0
        const podKeys = new Set()
        for (const cluster of clusters) {
            for (const node of Object.values(cluster.nodes)) {
                for (const pod of Object.values(node.pods)) {
                    podKeys.add(cluster.id + '/' + pod.namespace + '/' + pod.name)
                }
            }
            for (const pod of Object.values(cluster.unassigned_pods)) {
                podKeys.add(cluster.id + '/' + pod.namespace + '/' + pod.name)
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
                    window.setTimeout(function () {
                        that.animatePodDeletion(pod, globalPos)
                    }, 100 * changes)
                } else {
                    pod.destroy()
                }
                changes++
            }
        }
        const clusterComponentById = {}
        for (const component of this.viewContainer.children) {
            clusterComponentById[component.cluster.id] = component
        }
        let y = 0
        const clusterIds = new Set()
        for (const cluster of clusters) {
            if (!this.selectedClusters.size || this.selectedClusters.has(cluster.id)) {
                clusterIds.add(cluster.id)
                const status = this.clusterStatuses.get(cluster.id)
                let clusterBox = clusterComponentById[cluster.id]
                if (!clusterBox) {
                    clusterBox = new Cluster(cluster, status, this.tooltip)
                    this.viewContainer.addChild(clusterBox)
                } else {
                    clusterBox.cluster = cluster
                    clusterBox.status = status
                }
                clusterBox.draw()
                clusterBox.x = 0
                clusterBox.y = y
                y += clusterBox.height + 10
            }
        }
        for (const component of this.viewContainer.children) {
            if (!clusterIds.has(component.cluster.id)) {
                this.viewContainer.removeChild(component)
            }
        }
        this.filter()

        for (const key of Object.keys(ALL_PODS)) {
            const pod = ALL_PODS[key]
            if (!this.seenPods.has(key)) {
                // pod was created
                this.seenPods.add(key)
                if (!this.bootstrapping && changes < 10) {
                    const globalPos = pod.toGlobal({x: 0, y: 0})
                    window.setTimeout(function () {
                        that.animatePodCreation(pod, globalPos)
                    }, 100 * changes)
                }
                changes++
            }
        }
    }

    tick(time) {
        const deltaX = this.viewContainerTargetPosition.x - this.viewContainer.x
        const deltaY = this.viewContainerTargetPosition.y - this.viewContainer.y
        if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
            this.viewContainer.position.x = this.viewContainerTargetPosition.x
            this.viewContainer.position.y = this.viewContainerTargetPosition.y
        } else {
            if (Math.abs(deltaX) > time) {
                this.viewContainer.x += time * Math.sign(deltaX) * Math.max(10, Math.abs(deltaX) / 10)
            }
            if (Math.abs(deltaY) > time) {
                this.viewContainer.y += time * Math.sign(deltaY) * Math.max(10, Math.abs(deltaY) / 10)
            }
        }
        this.renderer.render(this.stage)
    }

    changeSorting(newSortFunction) {
        this.sorterFn = newSortFunction
        this.update()
    }

    switchTheme(newTheme) {
        this.theme = Theme.get(newTheme)
        this.draw()
        this.update()
        localStorage.setItem('theme', newTheme)
    }

    toggleCluster(clusterId) {
        if (this.selectedClusters.has(clusterId)) {
            this.selectedClusters.delete(clusterId)
        } else {
            this.selectedClusters.add(clusterId)
        }
        this.changeLocationHash('clusters', Array.from(this.selectedClusters).join(','))
        // make sure we are updating our EventSource filter
        this.connect()
        this.update()
    }

    keepAlive() {
        if (this.keepAliveTimer != null) {
            clearTimeout(this.keepAliveTimer)
        }
        this.keepAliveTimer = setTimeout(this.connect.bind(this), this.config.keepAliveSeconds * 1000)
        if (this.connectTime != null) {
            const now = Date.now()
            if (now - this.connectTime > this.config.maxConnectionLifetimeSeconds * 1000) {
                // maximum connection lifetime exceeded => reconnect
                this.connect()
            }
        }
    }

    pruneUnavailableClusters() {
        let updateNeeded = false
        const nowSeconds = Date.now() / 1000
        for (const [clusterId, statusObj] of this.clusterStatuses.entries()) {
            const lastQueryTime = statusObj.last_query_time || 0
            if (lastQueryTime < nowSeconds - this.config.maxDataAgeSeconds) {
                this.clusters.delete(clusterId)
                updateNeeded = true
            } else if (lastQueryTime < nowSeconds - 20) {
                updateNeeded = true
            }
        }
        if (updateNeeded) {
            this.update()
        }
    }

    disconnect() {
        if (this.eventSource != null) {
            this.eventSource.close()
            this.eventSource = null
            this.connectTime = null
        }
    }

    refreshLastQueryTime(clusterId) {
        let statusObj = this.clusterStatuses.get(clusterId)
        if (!statusObj) {
            statusObj = {}
        }
        statusObj.last_query_time = Date.now() / 1000
        this.clusterStatuses.set(clusterId, statusObj)
    }

    connect() {
        // first close the old connection
        this.disconnect()
        const that = this
        // NOTE: path must be relative to work with kubectl proxy out of the box
        let url = 'events'
        const clusterIds = Array.from(this.selectedClusters).join(',')
        if (clusterIds) {
            url += '?cluster_ids=' + clusterIds
        }
        const eventSource = this.eventSource = new EventSource(url, {credentials: 'include'})
        this.keepAlive()
        eventSource.onerror = function (_event) {
            that._errors++
            if (that._errors <= 1) {
                // immediately reconnect on first error
                that.connect()
            } else {
                // rely on keep-alive timer to reconnect
                that.disconnect()
            }
        }
        eventSource.addEventListener('clusterupdate', function (event) {
            that._errors = 0
            that.keepAlive()
            const cluster = JSON.parse(event.data)
            const status = that.clusterStatuses.get(cluster.id)
            const nowSeconds = Date.now() / 1000
            if (status && status.last_query_time < nowSeconds - that.config.maxDataAgeSeconds) {
                // outdated data => ignore
            } else {
                that.clusters.set(cluster.id, cluster)
                that.update()
            }
        })
        eventSource.addEventListener('clusterdelta', function (event) {
            that._errors = 0
            that.keepAlive()
            const data = JSON.parse(event.data)
            // we received some delta => we know that the cluster query succeeded!
            that.refreshLastQueryTime(data.cluster_id)
            let cluster = that.clusters.get(data.cluster_id)
            if (cluster && data.delta) {
                // deep copy cluster object (patch function mutates inplace!)
                cluster = JSON.parse(JSON.stringify(cluster))
                cluster = JSON_delta.patch(cluster, data.delta)
                that.clusters.set(cluster.id, cluster)
                that.update()
            }
        })
        eventSource.addEventListener('clusterstatus', function (event) {
            that._errors = 0
            that.keepAlive()
            const data = JSON.parse(event.data)
            that.clusterStatuses.set(data.cluster_id, data.status)
        })
        eventSource.addEventListener('bootstrapend', function (_event) {
            that._errors = 0
            that.keepAlive()
            that.bootstrapping = false
        })
        this.connectTime = Date.now()
    }

    run() {
        this.initialize()
        this.draw()
        this.connect()

        PIXI.ticker.shared.add(this.tick, this)
    }
}

module.exports = App
