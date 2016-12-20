import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
const PIXI = require('pixi.js')

export default class App {
    constructor() {
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

        const tooltip = new Tooltip()
        tooltip.draw()

        this.renderer = renderer
        this.stage = stage
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
