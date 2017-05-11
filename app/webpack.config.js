var path = require('path'),
    webpack = require('webpack'),
    pkg = require('./package.json'),
    DEBUG = process.env.NODE_ENV !== 'production',
    entry = [
        './src/app.js',
    ]

module.exports = {
    context: path.join(__dirname, './'),
    entry: entry,
    target: 'web',
    devtool: DEBUG ? 'inline-source-map' : false,
    output: {
        library: 'App',
        path: path.resolve(pkg.config.buildDir),
        publicPath: DEBUG ? '/' : './',
        filename: DEBUG ? 'app.js' : 'app-[hash].js'
    },
    node: {
        fs: 'empty'
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.LoaderOptionsPlugin({
            debug: DEBUG
        })
    ],
    module: {
        rules: [
            {enforce: 'pre', test: /\.js$/, loader: 'eslint-loader', exclude: /node_modules/},
            {test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader', query: {plugins: ['transform-runtime'], presets: ['es2015']}},
            {test: /\.html$/, exclude: /node_modules/, loader: 'file-loader?name=[path][name].[ext]'},
            {test: /\.jpe?g$|\.svg$|\.png$/, exclude: /node_modules/, loader: 'file-loader?name=[path][name].[ext]'},
            {test: /\.json$/, exclude: /node_modules/, loader: 'json'},
            {test: /\.(otf|eot|svg|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/, loader: 'url?limit=8192&mimetype=application/font-woff'},
            {test: /\.json$/, include: path.join(__dirname, 'node_modules', 'pixi.js'), loader: 'json'},
            {enforce: 'post', include: path.resolve(__dirname, 'node_modules/pixi.js'), loader: 'transform-loader?brfs'}
        ]
    }
}
