import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
const PIXI = require('pixi.js')

export default class App {
    constructor() {
        this.filterString = ''
    }

    filter() {
        const searchString = this.filterString
        this.searchText.text = '> ' + searchString
        const filter = new PIXI.filters.ColorMatrixFilter()
        filter.desaturate()
        for (const cluster of this.stage.children) {
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

        const searchText = new PIXI.Text('> ', {fontSize: 24, fill: 0xaaaaff})
        searchText.x = 50
        searchText.y = 5

        const tooltip = new Tooltip()
        tooltip.draw()

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
        this.tooltip = tooltip
    }

    run() {
        this.initialize()

        const that = this

        function update(clusters) {
            that.stage.removeChildren();
            var y = 50;
            for (var cluster of clusters) {
                var clusterBox = new Cluster(cluster, that.tooltip)
                clusterBox.draw()
                clusterBox.x = 50
                clusterBox.y = y
                that.stage.addChild(clusterBox)
                y += 270;
            }
            that.filter()
            that.stage.addChild(that.searchText)
            that.stage.addChild(that.tooltip)
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
