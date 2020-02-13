/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const path = require('path');
const os = require('os');
const fsProm = require('fs').promises;
const child_process = require('child_process');

async function link(hakEnv, moduleInfo) {
    const yarnrc = path.join(hakEnv.projectRoot, '.yarnrc');
    // this is fairly terrible but it's reasonably clunky to either parse a yarnrc
    // properly or get yarn to do it, so this will probably suffice for now.
    // We just check to see if there is a local .yarnrc at all, and assume that
    // if you've put one there yourself, you probably know what you're doing and
    // we won't meddle with it.
    // Also we do this for each module which is unnecessary, but meh.
    try {
        await fsProm.stat(yarnrc);
    } catch (e) {
        await fsProm.writeFile(
            yarnrc, 
            '--link-folder ' + path.join(hakEnv.dotHakDir, 'links') + os.EOL,
        );
    }

    await new Promise((resolve, reject) => {
        const proc = child_process.spawn('yarn', ['link'], {
            cwd: moduleInfo.moduleOutDir,
            stdio: 'inherit',
        });
        proc.on('exit', code => {
            code ? reject(code) : resolve();
        });
    });

    await new Promise((resolve, reject) => {
        const proc = child_process.spawn('yarn', ['link', moduleInfo.name], {
            cwd: hakEnv.projectRoot,
            stdio: 'inherit',
        });
        proc.on('exit', code => {
            code ? reject(code) : resolve();
        });
    });
};

module.exports = link;
