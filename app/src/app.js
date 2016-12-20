import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
const PIXI = require('pixi.js')

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
        const renderer = PIXI.autoDetectRenderer(256, 256, {resolution: 2});
        renderer.view.style.position = 'absolute';
        renderer.view.style.display = 'block';
        renderer.autoResize = true;
        renderer.resize(window.innerWidth, window.innerHeight);

        //Add the canvas to the HTML document
        document.body.appendChild(renderer.view);

        //Create a container object called the `stage`
        const stage = new PIXI.Container();

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
            if (event.key && event.key.length == 1 && !event.ctrlKey) {
                this.filterString += event.key
                this.filter()
                event.preventDefault();
            }
            else if (event.key == 'Backspace') {
                this.filterString = this.filterString.slice(0, Math.max(0, this.filterString.length-1))
                this.filter()
                event.preventDefault();
            }
        }

        addEventListener(
            'keydown', downHandler.bind(this), false
        );

        this.renderer = renderer
        this.stage = stage
        this.searchText = searchText
        this.viewContainer = viewContainer
        this.tooltip = tooltip
    }

    run() {
        this.initialize()

        const that = this

        function update(clusters) {
            that.viewContainer.removeChildren();
            var y = 0;
            for (var cluster of clusters) {
                var clusterBox = new Cluster(cluster, that.tooltip)
                clusterBox.draw()
                clusterBox.x = 0
                clusterBox.y = y
                that.viewContainer.addChild(clusterBox)
                y += 270;
            }
            that.filter()
        }

        function fetchData() {
            fetch('kubernetes-clusters', {credentials: 'include'})
            .then(function(response) {
                return response.json()
            })
            .then(function(json) {
                const clusters = json.kubernetes_clusters;
                update(clusters)
            });
            window.setTimeout(fetchData, 5000)
        }

        fetchData()


        function mainLoop() {
            requestAnimationFrame(mainLoop)
            that.renderer.render(that.stage)
        }

        mainLoop();
    }
}

module.exports = App