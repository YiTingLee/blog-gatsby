---
title: Database Index
date: "2020-11-11T20:15:00.000Z"
template: "post"
draft: false
slug: "database-index"
category: "Database"
tags:
  - "Database"
description: "簡單理解Database index"
socialImage: ""
---

## 前言
此文章的目的並非讓大家對於Btree有深度了解，而是使用簡單的方式解釋Database Index的基本原理，使得在設計Index的時候有正確的方向。

## 介紹
當我們發現資料庫Query速度越來越慢，且已經漸漸地影響到使用者體驗的時候，那就是優化資料庫的最佳時機，而最典型的方法就是加index，但是在設計上如果不理解index的原理而隨便亂加的話，反而會造成整體資料庫效率降低!!

目前多數的RDBMS的index都是由Btree的方法實作，所以講Database index之前，必須先簡單了解一下Btree的基本特性。

## Btree
這是Btree的基本樣貌:
![Btree](/images/database-index/btree.png)

Btree共有幾種特性:
 - 有別於一般二元樹，每個node都能擁有多個Key
 - 一個node可以擁有K+1個支線(K = Key的數量)
 - Key數值必在兩個Parent的Key範圍內(如圖上的56/74都在47及99內)
 - Btree為平衡樹且每個葉節點深度必定相同

接著我們來看一下Search速度上的差異，圖上的例子共有23/44/47等八個數字，若我們用For-loop的方式尋找，最差情況是O(n)

若我們從Btree的方式搜尋，則最差情況是最深階層數，故為O(log n)

## Database index
其實在使用資料庫的同時，我們已經不知不覺中使用了大量的index，而這個index就是每個Table的Primary Key，接下來我們就用PK來解釋Database的搜尋方式

首先我們先建立簡單的Table

```sql
create table test(
    id integer primary key,
    num integer,
    content varchar(40)
);
```

找出目前test table內的index，可以看出Primary Key本身就會被建立成index

```sql
eric_db=# select * from pg_indexes where tablename = 'test';
 schemaname | tablename |   indexname    | tablespace |                           indexdef

 public     | test      | test_pkey      |            | CREATE UNIQUE INDEX test_pkey ON public.test USING btree (id)
```

接著我們來討論index與Btree之間的關係

![Btree-index](/images/database-index/btree-index.png)

圖中所有的Key都是test中的id(PK)，而在葉節點的部分才會帶該筆id的資料內容。

### Query
```sql
select * from test where id = 29;
```
![Steps](/images/database-index/btree-index-step.png)

當我們下Query時，Database找出id為29的方式如圖上所示，且與Btree的走訪方法相同，這邊我就不重複解釋。比較不同的是資料僅存在於葉節點，走訪的過程即便是遇到Key相同只要不在葉節點就無法取得資料。

### 那假設我們是找num = 29的時候也是照著Btree的方法?

答案是否定的，只要沒設index，Database就會用full scan的方式去搜尋。

## 原理

每當我們建立index時，Database都會幫我們建立一個index table去維護這個Btree，所以index越多則index table當然也越來越多，所需要的空間需求也會隨之增加。

當我們建立Primary Key以外的index時，基本上原理都是相同的，差別只在於非PK的Btree葉節點的資料內容為PK。

接著上面的範例，我們設了num為index，然後找出num = 29，Database動作如下
 - 透過num的btree找出id
 - 再由id的btree找出整個row的內容

### 我的硬碟就是大，那我每個欄位都設index來加速好了

上面有提到Database會幫我們維護所有的index btree，若index太多會造成新增或刪除資料的時候負擔太大，同時維護多個Btree(包括這些index table的讀寫動作)所造成的負擔都會使你的系統效能變差。

## 實驗

隨機建立100萬份資料
```sql
create table test(
    id integer primary key,
    num integer,
    content varchar(40)
);

create index test_num_index on test(num);

insert into test SELECT generate_series(1,1000000) as id, (random()*(10^3))::integer, (random()*(10^3))::VARCHAR(40);

```

若沒有postgres的環境的話，可以用docker-compose來玩，這邊是我實驗的環境
```docker
version: "3.3"
services:
  postgres:
    image: postgres:latest
    container_name: eric_db
    ports:
      - 5432:5432
    environment: 
      POSTGRES_DB: eric_db
      POSTGRES_USER: eric
      POSTGRES_PASSWORD: eric
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
  
```

explain是postgres提供出來查詢sql command的成本，我們就用此方法來實驗

```sql
eric_db=# explain select * from test where content = '29';
                               QUERY PLAN
 Gather  (cost=1000.00..13561.43 rows=1 width=26)
   Workers Planned: 2
   ->  Parallel Seq Scan on test  (cost=0.00..12561.33 rows=1 width=26)
         Filter: ((content)::text = '29'::text)
(4 rows)
```

```sql
eric_db=# explain select * from test where id = 29;
                              QUERY PLAN

 Index Scan using test_pkey on test  (cost=0.42..8.44 rows=1 width=26)
   Index Cond: (id = 29)
(2 rows)
```

若未使用index的情況下成本為13561.43，這邊Postgres已經幫我們使用了並行處裡，否則成本會更高。反觀使用index的總成本只需要8.44

這邊我就不解釋此成本的計算方式，簡單理解成數值越高成本越大即可，有興趣者可前往postgres的document。

## 結論

index是非常典型的以空間換取時間的例子，但也不是index越多越好，而是必須透過實際情況來決定哪些column該設定index，都沒用到的column設定index也是很浪費的。