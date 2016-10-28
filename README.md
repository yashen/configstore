# configstore

更新配置文件到存储库，仓库使用git

## 安装

`npm install zconfigstore -g`

## 初始化

`configstore init [workingFolder]`

这个命令会在工作目录下创建configstore.json

文件的内容可能如下

```
"folders":[],
{
"files":[]
}

```

## 添加需要存储的文件
使用下面的命令添加文件或者目录


`configstore add  fileorfolderpath`

上面命令会根据path的类型自动添加到folders或files中



## 打包配置文件

```configstore tar filename```


## 同步到git库

```
configstore sync

```

git库是工作目录下的store目录，上面的操作会提交配置文件的变化到git库中
