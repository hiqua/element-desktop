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
const url = require('url');
const fsProm = require('fs').promises;
const child_process = require('child_process');

const npm = require('npm');
const semver = require('semver');
const needle = require('needle');
const mkdirp = require('mkdirp');
const tar = require('tar');

async function fetch(hakEnv, moduleInfo) {
    let haveModuleBuildDir;
    try {
        const stats = await fsProm.stat(moduleInfo.moduleBuildDir);
        haveModuleBuildDir = stats.isDirectory();
    } catch (e) {
        haveModuleBuildDir = false;
    }

    if (haveModuleBuildDir) return;

    await new Promise((resolve) => {
        npm.load({'loglevel': 'silent'}, resolve);
    });

    console.log("Fetching " + moduleInfo.name + " at version " + moduleInfo.version);
    const versions = await new Promise((resolve, reject) => {
        npm.view([
            moduleInfo.name + '@' + moduleInfo.version,
            'dist.tarball',
            (err, versions) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(versions);
                }
            },
        ]);
    });

    const orderedVersions = Object.keys(versions);
    semver.sort(orderedVersions);

    console.log("Resolved version " + orderedVersions[0] + " for " + moduleInfo.name);

    const tarballUrl = versions[orderedVersions[0]]['dist.tarball'];

    await mkdirp(moduleInfo.moduleHakDir);

    const parsedUrl = url.parse(tarballUrl);
    const tarballFile = path.join(moduleInfo.moduleHakDir, path.basename(parsedUrl.path));

    let haveTarball;
    try {
        await fsProm.stat(tarballFile);
        haveTarball = true;
    } catch (e) {
        haveTarball = false;
    }
    if (!haveTarball) {
        console.log("Downloading " + tarballUrl);
        await needle('get', tarballUrl, { output: tarballFile });
    } else {
        console.log(tarballFile + " already exists.");
    }

    await mkdirp(moduleInfo.moduleBuildDir);

    await tar.x({
        file: tarballFile,
        cwd: moduleInfo.moduleBuildDir,
        strip: 1,
    });

    await new Promise((resolve, reject) => {
        const proc = child_process.spawn(
            'yarn',
            ['install', '--ignore-scripts'],
            {
                stdio: 'inherit',
                cwd: moduleInfo.moduleBuildDir,
            },
        );
        proc.on('exit', code => {
            code ? reject(code) : resolve();
        });
    });

    // also extract another copy to the output directory at this point
    // nb. we do not yarn install in the output copy
    await mkdirp(moduleInfo.moduleOutDir);
    await tar.x({
        file: tarballFile,
        cwd: moduleInfo.moduleOutDir,
        strip: 1,
    });
}

module.exports = fetch;
