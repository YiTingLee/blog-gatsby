---
title: Docker Image Minimization
date: "2021-07-17T17:00:00.000Z"
template: "post"
draft: false
slug: "docker-image-minimization"
category: "Docker"
tags:
  - "Docker"
  - "Optimization"
description: "Docker image減肥大作戰!!"
socialImage: ""
---

## 介紹
在上傳或下載docker image的時候，大家或多或少都應該有遇過Timeout或是上傳速度很慢等問題，更甚至有時候是把docker image拉到IOT裝置上面跑，先天條件上機器就無法容納沒減肥過的docker image，而縮小docker image的大小是避免這些問題的方法之一，也是我們今天要做的主要實驗。

今天的實驗主要是使用Nest這個框架建立出來的service來做為我們縮小的主要對象。雖然是使用Nest作為範例，但這些方法和概念都可以適用在不同的專案上。

## 第一輪: 準備
用Nest建一個基本的專案吧

```shell
$ nest new nest-playground
```

我們會得到一個完整Nest的App, 看起會像這樣
![Folder Structure](/images/docker-image-minimization/folder-structure.png)

接著用最基本的方法包成docker image吧
 - nest-playground的專案下建立Dockerfile

```Dockerfile
FROM node:12

WORKDIR /app

COPY . .

RUN yarn install

EXPOSE 3000

CMD ["yarn", "start"]
```

 - build docker image指令如下

```shell
$ docker build -t nest-backend .
```

這樣build出來的docker-image總共使用了__**1.6G**__，比預想中大很多吧

#### 為什麼這麼大?
因為我們把整個repo，node_modules，以及實際build出來的js都包在這包image內了

## 第二輪: 拿掉非必要檔案
#### 那怎麼辦?
這邊先把必要的程式留下來，其他非必要的檔案都拿掉，包含source code，也就是說除了build出來的dist外其他檔案都不需要存在
 - 把Dockerfile分成兩個stage
   - stage1負責build code
   - stage2則負責把stage1 build好的程式copy進去stage2內然後run起來

經過這些處理後，stage2(也就最後要run起的image)內只會包含dist內容，任何repo內的資料都會被留在stage1裡面，並不會被放到stage2內，實作如下。

```Dockerfile
# STAGE 1

FROM node:12 AS build

WORKDIR /app

COPY . .

RUN yarn install

CMD ["yarn", "build:prod"]

# STAGE 2

FROM node:12

WORKDIR /app

COPY --from=build /app/package.json .
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["yarn", "start:prod"]
```

這邊為了將node_modules內沒使用到的東西拿掉，我們使用了webpack來處理，[Webpack Config](https://github.com/YiTingLee/NestAppMinimization/blob/master/webpack.config.js)在這邊。

這樣處理完的docker image剩下__**919MB**__

#### 感覺還是很大?

## 第二輪: 使用輕量化的Node版本alpine
我們一般使用的node image是Debian based的，擁有完整的功能，大小約650MB+，而alpine僅有維持運作最基礎的OS功能，甚至連Python/gcc都沒有，大小約50MB+。使用輕量化的node並不是完全沒有後遺症，輕量化的image肯定就是拿掉了許多功能及module，但在image size上是擁有很大的優勢。

```Dockerfile
# STAGE 1

FROM node:12-alpine AS build

WORKDIR /app

COPY . .

RUN yarn install

CMD ["yarn", "build:prod"]

# STAGE 2

FROM node:12-alpine

WORKDIR /app

COPY --from=build /app/package.json .
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["yarn", "start:prod"]
```

使用輕量版Node build完後的總大小是__**90.5MB**__

## 結論
這次的實驗大小的進度分別是1.6GB -> 919MB -> 90.5MB，總共減少了17X，當中除了Dockerfile在Stage上的操作外還有一些webpack的使用才能大幅度的減少image的大小。

這邊要再說一次，雖然今天的實驗主要是使用Nest這個框架做為我們的主要範例，但這些方法及概念都可以套用到不同的專案上，尤其是frontend的專案另外還可以使用nginx等輕量化的web server作為基底。

## Source Code
https://github.com/YiTingLee/NestAppMinimization
