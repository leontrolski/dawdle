const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    entry: './src/index.ts',
    // PERFORMANCE - source maps take up lots of space
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader',
                    // PERFORMANCE - disable type checker - we will do this as part of the tests
                    options: {
                        transpileOnly: true,
                        experimentalWatchApi: true,
                    },
                }],
                exclude: [/node_modules/, /test/],
            }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ]
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new CopyWebpackPlugin([
            {
                from: 'mode*.js',
                to: path.resolve(__dirname, 'dist/modes'),
                context: path.resolve(__dirname, 'node_modules/ace-builds/src-noconflict/'),
            },
            {
                from: path.resolve(__dirname, 'src/mode-dawdle.js'),
                to: path.resolve(__dirname, 'dist/modes')
            },
        ])
    ],
    optimization: {
        // PERFORMANCE
        removeAvailableModules: false,
        removeEmptyChunks: false,

        splitChunks: {
          cacheGroups: {
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all'
            }
          }
        }
    },
    stats: 'verbose',
}