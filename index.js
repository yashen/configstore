"use strict";
var commander = require('commander');
var child_process = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var DEBUG = false;
var level = 0;
var workingFolderConfigFile = path.join(os.homedir(), ".configstore");
var workingFolder = null;
var configFile = null;
;
if (fs.existsSync(workingFolderConfigFile)) {
    workingFolder = JSON.parse(fs.readFileSync(workingFolderConfigFile, "utf-8"));
    configFile = path.join(workingFolder, "configstore.json");
}
function exec(command, args, cwd) {
    if (cwd === void 0) { cwd = ''; }
    if (DEBUG) {
        var output = [("exec " + command)].concat(args).join(" ");
        output += " pwd:" + cwd;
        console.log(output);
    }
    var result = child_process.spawnSync(command, args, {
        encoding: 'utf-8',
        cwd: cwd
    });
    if (result.status > 0) {
        throw result.stderr;
    }
    return result.stdout;
}
var init = commander.command("init [path]");
var Folder = (function () {
    function Folder() {
    }
    return Folder;
}());
var Config = (function () {
    function Config() {
        this.files = [];
        this.folders = [];
    }
    return Config;
}());
var config = new Config();
function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config, null, ' '));
}
if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
}
init.action(function (workingFolder) {
    if (!workingFolder) {
        workingFolder = '/' + path.relative('/', '.');
    }
    configFile = path.join(workingFolder, 'configstore.json');
    if (!fs.existsSync(configFile)) {
        saveConfig();
    }
    fs.writeFileSync(workingFolderConfigFile, JSON.stringify(workingFolder));
});
var add = commander.command("add <filename>");
add.action(function (fullpath) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }
    if (!path.isAbsolute(fullpath)) {
        console.log(fullpath + " not a absolute path");
        return;
    }
    if (!fs.existsSync(fullpath)) {
        console.log(fullpath + " not exist");
        return;
    }
    var stat = fs.statSync(fullpath);
    if (stat.isFile()) {
        config.files.push(fullpath);
        saveConfig();
    }
    else if (stat.isDirectory()) {
        config.folders.push({
            path: fullpath
        });
        saveConfig();
    }
    else {
        console.log(fullpath + " not a file and directory");
    }
});
var list = commander.command("list");
list.action(function () {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }
    var no = 0;
    config.files.forEach(function (item) {
        no++;
        console.log("" + item);
    });
    config.folders.forEach(function (item) {
        no++;
        console.log("" + item.path);
    });
});
var rm = commander.command("rm <filename>");
rm.action(function (fullpath) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }
    if (!path.isAbsolute(fullpath)) {
        console.log(fullpath + " not a absolute path");
        return;
    }
    config.files = config.files.filter(function (item) {
        return item != fullpath;
    });
    config.folders = config.folders.filter(function (item) {
        return item.path != fullpath;
    });
    saveConfig();
});
var tar = commander.command("tar <tarfilename>");
function _tar(filename) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }
    var tarfile = path.join('/' + path.relative('/', '.'), filename);
    var args = ["-c", "-f", tarfile].concat(configFile).concat(config.files);
    exec("tar", args, workingFolder);
    if (level == 0) {
        console.log("tar files success");
    }
    config.folders.forEach(function (item) {
        var args = ["-u", "-f", filename];
        if (item.excludes) {
            item.excludes.forEach(function (excludeItem) {
                args.push("--exclude=" + excludeItem);
            });
        }
        args.push(item.path);
        exec("tar", args, workingFolder);
        if (level == 0) {
            console.log("tar folder " + item.path + " success");
        }
    });
}
tar.action(_tar);
function _extract(targetfolder, filename) {
    var fullname = '/' + path.relative('/', filename);
    exec('tar', ['-xvf', fullname], targetfolder);
}
function _git(folder) {
    var gitfolder = path.join(folder, ".git");
    if (!fs.existsSync(gitfolder)) {
        exec('git', ['init'], folder);
    }
    exec('git', ['add', '.'], folder);
    try {
        exec('git', ['commit', '-a', '-m', 'auto'], folder);
    }
    catch (error) {
    }
}
var sync = commander.command("sync");
sync.action(function () {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }
    var tarfile = path.join(os.tmpdir(), "configstore.tar");
    level++;
    _tar(tarfile);
    level--;
    var tmpfolder = fs.mkdtempSync(path.join(os.tmpdir(), "configstore"));
    _extract(tmpfolder, tarfile);
    var storeFolder = path.join(workingFolder, "store");
    if (!fs.existsSync(storeFolder)) {
        fs.mkdirSync(storeFolder);
    }
    exec('rsync', [tmpfolder + '/', '-av', '--delete', '--exclude', '.git', storeFolder], '.');
    exec('rm', ['-f', tmpfolder]);
    fs.unlinkSync(tarfile);
    _git(storeFolder);
    console.log("Config files sync success to " + storeFolder + " folder");
});
commander.parse(process.argv);
