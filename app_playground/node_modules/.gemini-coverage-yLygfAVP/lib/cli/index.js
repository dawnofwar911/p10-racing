'use strict';

const pkg = require('../../package.json');
const common = require('./common');

module.exports = require('coa').Cmd()
    .name(process.argv[1])
    .title(pkg.description)
    .helpful()
    .opt()
        .name('version')
        .title('Show version')
        .long('version')
        .flag()
        .end()
    .cmd().name('gen').apply(require('./gen')).end()
    .completable()
    .act(function(options) {
        if (options.version) {
            return pkg.version;
        }
        console.log(this.usage());
        return common.exitCoa(1);
    });
