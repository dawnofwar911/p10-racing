'use strict';

const path = require('path');
const url = require('url');
const Promise = require('bluebird');
const hb = require('handlebars');
const fs = require('fs-extra');

const readFile = (path) => fs.readFile(path, 'utf8');

module.exports = class Generator {
    constructor(opts, args) {
        this.opts = opts;
        this.args = args;
        this.templateDir = path.join(__dirname, 'templates', opts.template);
    }

    generate() {
        return fs.ensureDir(this.opts.destDir)
            .then(() => this.makeReports())
            .catch((err) => {
                throw new Error(`Error while making reports\n${err.stack || err.message || err}`);
            });
    }

    makeReports() {
        const reports = [];
        let cov = this.args.coverage;

        if (typeof cov === 'string') {
            cov = readFile(cov).then(JSON.parse);
        }

        const covHbs = path.join(this.templateDir, 'coverage.hbs');
        return Promise.all([readFile(covHbs), cov])
            .spread((tmpl, coverage) => {
                // split files processing into batches to avoid too many files being opened
                const batch = (files) => {
                    if (!files.length) {
                        return;
                    }

                    return Promise.all(files.splice(0, 10).map((fileInfo) => {
                        const reportFile = fileInfo.file.replace(/\//g, '_') + '.html',
                            reportPath = path.join(this.opts.destDir, reportFile);

                        return this.makeReport(
                            path.resolve(this.opts.sourceRoot, fileInfo.file),
                            reportPath,
                            {
                                data: fileInfo,
                                tmpl: tmpl
                            })
                            .then((rulesStat) => {
                                reports.push({
                                    source: fileInfo.file,
                                    report: reportFile,
                                    stat: rulesStat
                                });
                            });
                    }))
                        .then(() => batch(files));
                };

                return batch(coverage.files.slice());
            })
            .then(() => prepareOutputStats(reports))
            .then((stats) => this.writeIndex(stats))
            .then(() => this.copyResources());
    }

    makeReport(source, dest, opts) {
        const {blocks} = opts.data;
        const {total, covered, percent, neverUsed} = opts.data.stat;
        const level = neverUsed && 'worst' || percent === 100 && 'perfect' || percent >= 50 && 'good' || 'bad';

        const stat = {total, covered, percent, level, detailReport: true, neverUsed};

        return readFile(source)
            .catch(() => {
                stat.detailReport = false;
                return null;
            })
            .then((content) => {
                if (!content) {
                    return;
                }

                const handled = new Set();

                let lines = content.split(/\r?\n/g);
                // cover into <pre> blocks css lines having some coverage state
                for (let b = blocks.length - 1; b >= 0; b--) {
                    const block = blocks[b];

                    for (let l = block.start.line - 1; l < block.end.line; l++) {
                        if (!handled.has(l)) {
                            lines[l] = `<pre class="${block.type}">${htmlEscape(lines[l])}</pre>`;
                            handled.add(l);
                        }
                    }
                }

                // cover into <pre> blocks everything not covered in the state above
                lines = lines.map((line, lineNo) => handled.has(lineNo) ? line : `<pre>${htmlEscape(line)}</pre>`);

                return fs.writeFile(dest, hb.compile(opts.tmpl)({
                    content: lines.join('\n'),
                    source: path.relative(path.dirname(dest), source),
                    projectSource: path.relative(this.opts.sourceRoot, source),
                    url: url,
                    stat: stat
                }));
            })
            .then(() => stat);
    }

    copyResources() {
        return fs.copy(path.join(__dirname, 'templates', this.opts.template, 'res'), this.opts.destDir);
    }

    writeIndex(stats) {
        return readFile(path.join(this.templateDir, 'coverage-index.hbs'))
            .then((tmpl) => {
                return fs.writeFile(
                    path.join(this.opts.destDir, 'index.html'),
                    hb.compile(tmpl)(stats));
            });
    }
};

function prepareOutputStats(reports) {
    reports.sort((a, b) => a.source.localeCompare(b.source));

    const stat = reports.reduce(
        (prev, current) => {
            prev.covered += current.stat.covered;
            prev.total += current.stat.total;

            return prev;
        },
        {total: 0, covered: 0}
    );

    return Promise.resolve({
        reports: reports,
        covered: stat.covered,
        total: stat.total,
        percent: Math.round(stat.covered / stat.total * 100)
    });
}

function htmlEscape(s) {
    if (!s) {
        return '';
    }

    const escape = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#x27;',
        '`': '&#x60;'
    };

    return s.replace(
        new RegExp(`[${Object.keys(escape).join('')}]`, 'g'),
        (c) => escape[c] || c
    );
}
