'use strict';

const fs = require('fs');
const path = require('path');
const {common, exitCoa} = require('./common');
const Generator = require('../generator');

module.exports = function() {
    this.title('Generate html report from gemini coverage statistics')
        .helpful()
        .apply(common)
        .opt()
            .name('template')
            .long('template')
            .short('t')
            .title('Template to use')
            .def('default')
            .val((val) => {
                if (!fs.existsSync(path.resolve(__dirname, '../templates/', val))) {
                    console.warn('Template %s is not found. Using default.', val);
                    return 'default';
                }
                return val;
            })
            .end()
        .opt()
            .name('destDir')
            .long('dest-dir')
            .short('d')
            .title('Destination directory where the report files will be created')
            .def(path.join(process.cwd(), 'gemini-coverage'))
        .act((opts, args) => {
            return (new Generator(opts, args)).generate()
                .then(exitCoa);
        });
};
