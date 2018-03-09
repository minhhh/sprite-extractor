#!/usr/bin/env node

"use strict";

var doc = "\n\
SpriteExtractor\n\
\n\
Usage: sprite-extractor --sheet <filename> --data <filename>\n\
                      [-v --verbose]\n\
\n\
       sprite-extractor --version\n\
\n\
Tool for extracting sprites from TexturePacker Spritesheets\n\
Currently only support JSON hash\n\
\n\
General Options:\n\
  -h, --help                        Show this help message and exit\n\
  --version                         Print version information\n\
  -v, --verbose                     Show verbose information\n\
\n\
Output Options:\n\
  --sheet <filename>                Name of the texture sheet\n\
  --data <filename>                 Name of the data file\n\
\n\
Examples:\n\
\n\
  sprite-extractor --sheet out.png --data out.json\n\
        Extract sprites from out.png to current directory\n\
";

const async = require('async')
const fs = require('fs')
const path = require('path')
const pathIsAbsolute = require('path-is-absolute')
const isDirectory = require('is-directory')
const walker = require('walker')
const rimraf = require('rimraf')
const EventEmitter = require('events').EventEmitter;
const gm = require('gm').subClass({
    imageMagick: true
})
const docopt = require('docopt');

var launch = function(args) {
    var sheetFile = args ['--sheet']
    var sheetDataFile = args ['--data']
    var sheetData = null

    var emitter = new EventEmitter();

    async.waterfall(
        [
            function(next) {
                var WaitForAll = require('ewait').WaitForAll;
                var all = new WaitForAll({
                    timeout: 2147483647,
                    event: 'done'
                });

                all.add([emitter]);
                all.wait();
                next()
            },
            function(next) {
                fs.readFile(sheetDataFile, 'utf8', (err, data) => {
                    if (err) {
                        next(err)
                        return
                    }
                    sheetData = JSON.parse(data)
                    next()
                });
            },
            function(next) {
                var items = []
                for (var key in sheetData['frames']) {
                    var item = sheetData['frames'][key]
                    item['spriteName'] = key
                    items.push(item)
                }
                next(null, items)
            },
            function(items, next) {
                async.eachSeries(
                    items,
                    function(_item, _next) {
                        var x = _item['frame']['x']
                        var y = _item['frame']['y']
                        var w = _item['frame']['w']
                        var h = _item['frame']['h']
                        var frameW = w
                        var frameH = h
                        if (_item['rotated']) {
                            frameW = h
                            frameH = w
                        }
                        var result = gm(sheetFile).crop(frameW, frameH, x, y)
                        if (_item['rotated']) {
                            result.rotate('transparent', -90)
                        }
                        if (_item['trimmed']) {
                            w += _item['spriteSourceSize']['x']
                            result.gravity('East')
                                .background('transparent')
                                .extent(w, h)
                            result.gravity('West')
                                .background('transparent')
                                .extent(_item['sourceSize']['w'], h)
                            h += _item['spriteSourceSize']['y']
                            result.gravity('South')
                                .background('transparent')
                                .extent(_item['sourceSize']['w'], h)
                            result.gravity('North')
                                .background('transparent')
                                .extent(_item['sourceSize']['w'], _item['sourceSize']['h'])
                        }
                        result.write('./' + _item['spriteName'], function(_err) {
                            if (_err) {
                                _next(_err)
                                return
                            }
                            _next()
                        });
                    },
                    function(err) {
                        next(err)
                    }
                )
            }
        ],
        function(err, res) {
            if (err) {
                process.stderr.write('Encountered error: ' + err)
                emitter.emit('done')
                process.exit(1);
            }
            console.log('Done')
            emitter.emit('done')
        })
}


var kwargs = {
    name: 'sprite-extractor',
    version: 'sprite-extractor 0.0.1'
};

function main(args) {
    launch(args);
}

function error(err) {
    process.stderr.write(err);
}

if (require.main === module) {
    var args = docopt.docopt(doc, kwargs);
    // console.log(JSON.stringify(args))
    main(args);
}
