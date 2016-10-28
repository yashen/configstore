import * as commander from 'commander';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let DEBUG = false;
var level = 0;

let workingFolderConfigFile = path.join(os.homedir(),".configstore");
let workingFolder:string = null;
let configFile:string=null;;
if(fs.existsSync(workingFolderConfigFile)){
    workingFolder = JSON.parse(fs.readFileSync(workingFolderConfigFile,"utf-8"));
    configFile = path.join(workingFolder,"configstore.json");
}

function exec(command: string, args: string[], cwd: string=''): string {
    if (DEBUG) {
        var output = [`exec ${command}`].concat(args).join(" ");
        output += ` pwd:${cwd}`;
        console.log(output);
    }


    let result = child_process.spawnSync(command, args, {
        encoding: 'utf-8',
        cwd: cwd
    });

    if (result.status > 0) {
        throw result.stderr;
    }
    return <any>result.stdout;
}


let init = commander.command("init [path]");

class Folder {
    path: string;
    excludes?: string[];
}

class Config {
    files: string[] = [];
    folders: Folder[] = [];
}

let config = new Config();

function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config,null,' '));
}

if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
}

init.action(function (workingFolder:string) {

    if(!workingFolder){
        workingFolder = '/' + path.relative('/','.');
    }

    configFile = path.join(workingFolder,'configstore.json')

    if (!fs.existsSync(configFile)) {
            saveConfig();
    }
    fs.writeFileSync(workingFolderConfigFile,JSON.stringify(workingFolder));
});

let add = commander.command("add <filename>");
add.action(function (fullpath) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }

    if(!path.isAbsolute(fullpath)){
        console.log(`${fullpath} not a absolute path`);
        return;
    }

    if (!fs.existsSync(fullpath)) {
        console.log(`${fullpath} not exist`);
        return;
    }
    var stat = fs.statSync(fullpath);
    if (stat.isFile()) {
        config.files.push(fullpath);
        saveConfig();

    } else if (stat.isDirectory()) {
        config.folders.push({
            path: fullpath
        });
        saveConfig();

    } else {
        console.log(`${fullpath} not a file and directory`);
    }

});

let list = commander.command("list");
list.action(function () {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }

    let no = 0;
    config.files.forEach((item) => {
        no++;
        console.log(`${item}`);
    });
    config.folders.forEach((item) => {
        no++;
        console.log(`${item.path}`);
    });
});

let rm = commander.command("rm <filename>");
rm.action(function (fullpath: string) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }

    if(!path.isAbsolute(fullpath)){
        console.log(`${fullpath} not a absolute path`);
        return;
    }


    config.files = config.files.filter((item) => {
        return item != fullpath;
    });

    config.folders = config.folders.filter((item) => {
        return item.path != fullpath;
    });

    saveConfig();

});


let tar = commander.command("tar <tarfilename>");

function _tar(filename:string) {
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }

    let tarfile =  path.join('/' + path.relative('/','.'),filename);
    let args = ["-c", "-f", tarfile].concat(configFile).concat(config.files);
    exec("tar", args, workingFolder);
    if(level == 0){
        console.log("tar files success");
    }

    config.folders.forEach((item) => {
        let args = ["-u", "-f", filename];
        if (item.excludes) {
            item.excludes.forEach((excludeItem) => {
                args.push(`--exclude=${excludeItem}`);
            });
        }
        args.push(item.path);
        exec("tar", args, workingFolder);
        if(level == 0){
            console.log(`tar folder ${item.path} success`);
        }
    });
}

tar.action(_tar);

function  _extract(targetfolder:string,filename:string){
    let fullname = '/' + path.relative('/', filename);
    exec('tar',['-xvf',fullname],targetfolder);
}

function _git(folder:string){
    var gitfolder = path.join(folder,".git");
    if(!fs.existsSync(gitfolder)){
        exec('git',['init'],folder);
    }
    exec('git',['add','.'],folder);
    try {
        exec('git',['commit','-a','-m','auto'],folder);        
    } catch (error) {
        
    }
}


let sync = commander.command("sync");
sync.action(function(){
    if (!fs.existsSync(configFile)) {
        console.log("please init first");
        return;
    }

    let tarfile = path.join(os.tmpdir(),"configstore.tar");
    level++;
    _tar(tarfile);
    level--;
    let tmpfolder = fs.mkdtempSync(path.join(os.tmpdir(),"configstore"));
    _extract(tmpfolder,tarfile);

    let storeFolder = path.join(workingFolder,"store");
    if(!fs.existsSync(storeFolder)){
        fs.mkdirSync(storeFolder);
    }
    exec('rsync',[tmpfolder+'/','-av','--delete','--exclude','.git',storeFolder],'.');
    exec('rm',['-f',tmpfolder]);
    fs.unlinkSync(tarfile);

    _git(storeFolder);

    console.log(`Config files sync success to ${storeFolder} folder`);

});


commander.parse(process.argv);