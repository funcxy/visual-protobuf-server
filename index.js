const express = require('express');
const spawn = require('child_process').spawn;
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const archiver = require('archiver');
const origin = require('./origin.json');
const app = express();
// ALlow Origin
app.use(cors({
    origin: [/localhost/, ...origin],
    credentials: true
}));

app.use(bodyParser.json());

const languages = require('./languages.json');

app.use((req, res) => {
    let { title = 'main', body, targets } = req.body;
    let targetList = Object.keys(targets).filter(v => targets[v]).map(v => languages[v]).filter(v => v !== undefined);
    fs.mkdtemp(path.join(__dirname, 'worker/'), function (err, folder) {
        console.log(folder);
        fs.writeFile(path.join(folder, `${title}.proto`), req.body.body, function (err) {
            if (!err) {
                const p = spawn('protoc', [`${title}.proto`, ...targetList.map(v => `--${v.option}_out=.`)], {
                    cwd: folder
                });
                p.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                });

                p.stderr.on('data', (data) => {
                    console.log(`stderr: ${data}`);
                    res.write(data);
                });

                p.on('close', (code) => {
                    if (code === 0) {
                        res.setHeader('Content-Type', 'application/zip');
                        res.setHeader('Content-disposition', 'attachment; filename=target.zip');
                        console.log('compile succuess');
                        const output = fs.createWriteStream(path.join(folder, 'target.zip'));
                        const archive = archiver('zip');

                        output.on('close', function () {
                            console.log(archive.pointer() + ' total bytes');
                            console.log('archiver has been finalized and the output file descriptor has closed.');
                        });

                        archive.on('error', function (err) {
                            throw err;
                        });

                        archive.pipe(res);
                        archive.bulk(targetList.map(v => ({
                            expand: true,
                            cwd: path.join(folder, v.srcPath || ''),
                            src: v.src,
                            dest: v.dest,
                            dot: true
                        })));
                        archive.bulk({
                            expand: true,
                            cwd: folder,
                            src: ['**/*.proto'],
                            dest: '.',
                            dot: true
                        });
                        archive.finalize();
                    } else {
                        res.end();
                    }
                    console.log(`child process exited with code ${code}`);
                });
            }
        })
    });
})

app.listen(4000);