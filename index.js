const express = require('express');
const spawn = require('child_process').spawn;
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const archiver = require('archiver');

const app = express();
// ALlow Origin
app.use(cors({
    origin: [
        'http://localhost:3000'
    ],
    credentials: true
}));

app.use(bodyParser.json());

app.use((req, res) => {
    fs.mkdtemp(path.join(__dirname, 'worker/'), function (err, folder) {
        console.log(folder);
        fs.writeFile(path.join(folder, 'main.proto'), req.body.body, function (err) {
            if (!err) {
                const p = spawn('protoc', ['main.proto', '--js_out=.', '--cpp_out=.', '--java_out=.', '--python_out=.', '--ruby_out=.'], {
                    cwd: folder
                });
                p.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                });

                p.stderr.on('data', (data) => {
                    console.log(`stderr: ${data}`);
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
                            // res.sendFile(path.join(folder, 'target.zip'), {}, function(err){
                            //     if (err) {
                            //         throw err;
                            //     }
                            //     console.log('sent');
                            // });
                        });

                        archive.on('error', function (err) {
                            throw err;
                        });

                        archive.pipe(res);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.java'],
                                dest: 'java',
                                dot: true
                            }
                        ]);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.h', '**/*.cc'],
                                dest: 'cpp',
                                dot: true
                            }
                        ]);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.js'],
                                dest: 'js',
                                dot: true
                            }
                        ]);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.py'],
                                dest: 'python',
                                dot: true
                            }
                        ]);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.rb'],
                                dest: 'ruby',
                                dot: true
                            }
                        ]);
                        archive.bulk([
                            {
                                expand: true,
                                cwd: folder,
                                src: ['**/*.proto'],
                                dest: 'proto',
                                dot: true
                            }
                        ]);
                        archive.finalize();

                    }
                    console.log(`child process exited with code ${code}`);
                });
            }
        })
    });
})

app.listen(4000);