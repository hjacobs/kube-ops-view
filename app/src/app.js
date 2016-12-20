import Tooltip from './tooltip.js'
import Cluster from './cluster.js'
const PIXI = require('pixi.js')

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

var tooltip = new Tooltip()
tooltip.draw()

function update(clusters) {
    graphics.removeChildren();
    graphics.lineStyle(2, 0xaaaaff, 1);
    var y = 50;
    for (var cluster of clusters) {
        var clusterBox = new Cluster(cluster, tooltip)
        clusterBox.draw()
        clusterBox.x = 50
        clusterBox.y = y
        graphics.addChild(clusterBox)
        y += 270;
    }
    graphics.addChild(tooltip)
}

function fetchData() {
    fetch('kubernetes-clusters', {credentials: 'include'})
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
