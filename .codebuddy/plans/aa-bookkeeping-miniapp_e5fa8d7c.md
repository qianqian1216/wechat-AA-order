---
name: aa-bookkeeping-miniapp
overview: 开发一个微信AA记账小程序，支持创建账本、成员管理、账单添加（含参与人选择）、多用户协同记账、以及AA统计功能
design:
  architecture:
    component: tdesign
  styleKeywords:
    - 现代简约
    - 金融科技风
    - 卡片式布局
    - 清爽白底
    - 活力渐变主色
    - 圆润设计语言
    - 清晰的信息层级
    - 微交互动效
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 36rpx
      weight: 600
    subheading:
      size: 30rpx
      weight: 500
    body:
      size: 28rpx
      weight: 400
  colorSystem:
    primary:
      - "#07C160"
      - "#06AE56"
      - "#1296DB"
    background:
      - "#F5F7FA"
      - "#FFFFFF"
      - "#FAFAFA"
    text:
      - "#1A1A1A"
      - "#666666"
      - "#999999"
    functional:
      - "#E54D42"
      - "#07C160"
      - "#FF9500"
      - "#1890FF"
todos:
  - id: init-project
    content: 初始化微信小程序项目骨架，配置project.config.json、app.js、app.json、app.wxss等基础文件
    status: completed
  - id: install-tdesign
    content: 安装配置TDesign组件库，npm安装依赖并在全局引入基础组件
    status: completed
    dependencies:
      - init-project
  - id: create-cloud-func
    content: 创建login云函数，实现获取openid的登录能力
    status: completed
    dependencies:
      - init-project
  - id: build-index-page
    content: 实现首页（我的账本列表），包含账本卡片展示、新建账本入口和空状态处理
    status: completed
    dependencies:
      - install-tdesign
  - id: build-book-detail-page
    content: 实现账本详情页，包含账本概览、账单列表、成员统计面板和Tab切换
    status: completed
    dependencies:
      - install-tdesign
  - id: build-add-bill-page
    content: 实现添加账单页面，包含金额输入、描述、付款人选择、参与成员多选及登录校验逻辑
    status: completed
    dependencies:
      - install-tdesign
  - id: build-create-book-page
    content: 实现创建账本和成员管理页面，完成账本创建和成员增删功能
    status: completed
    dependencies:
      - install-tdesign
  - id: integrate-share-login
    content: 集成分享功能和微信授权登录流程，完善权限控制逻辑
    status: completed
    dependencies:
      - build-book-detail-page
      - build-add-bill-page
  - id: verify-project
    content: 使用[code-explorer]验证完整项目结构和代码一致性，确保所有模块正确关联
    status: completed
    dependencies:
      - init-project
      - install-tdesign
      - create-cloud-func
      - build-index-page
      - build-book-detail-page
      - build-add-bill-page
      - build-create-book-page
      - integrate-share-login
---

## 产品概述

一款基于微信小程序的AA记账应用，支持多人共同记账并自动分摊费用。由一人创建账本和成员，可分享给他人查看；创建者可直接添加账单，其他成员需微信授权登录后才能添加账单。最终统计每个成员的AA结算情况。

## 核心功能

- **账本管理**：创建者创建账本（设置名称），账本可通过小程序分享功能分享给他人查看
- **成员管理**：创建者添加参与AA的成员信息（昵称、头像颜色标识）
- **账单管理**：添加账单时填写金额、描述、选择参与AA的成员；仅创建者可免登录添加账单，其他用户需微信授权登录后才能添加
- **统计面板**：展示账本总金额、每个成员的消费总额、应付金额、已付金额、差额（应收/应退）
- **权限控制**：未登录用户可查看账本详情和统计数据；点击"添加账单"按钮时触发微信授权登录流程

## 用户角色与权限

| 角色 | 查看账本 | 添加/编辑账单 | 管理成员 | 删除账单 |
| --- | --- | --- | --- | --- |
| 创建者 | 是 | 是 | 是 | 是 |
| 已登录成员 | 是 | 是 | 否 | 否 |
| 未登录访客 | 是 | 否（引导登录） | 否 | 否 |


## 技术栈

- **前端框架**：微信小程序原生框架（WXML + WXSS + JavaScript）
- **UI组件库**：TDesign 微信小程序组件库（tdesign-miniprogram）
- **后端/数据库**：微信云开发（云数据库 + 云函数）
- **认证**：微信云开发匿名登录 + 微信授权登录（wx.getUserProfile）

## 技术架构

### 系统架构

采用微信小程序云开发原生架构，前后端一体：

- 小程序端负责页面渲染、用户交互、调用云开发API
- 云数据库存储所有业务数据（账本、成员、账单、用户）
- 无需独立后端服务器，利用云开发的免鉴权特性

### 数据库集合设计

```
books 集合（账本）
  - _id: 账本ID（自增或UUID）
  - _openid: 创建者openid
  - name: 账本名称
  - shareCode: 分享码（用于分享链接识别）
  - createTime: 创建时间
  - updateTime: 更新时间

members 集合（成员）
  - _id: 成员ID
  - bookId: 关联账本ID
  - nickname: 成员昵称
  - avatarColor: 头像标识颜色
  - sortOrder: 排序序号

bills 集合（账单）
  - _id: 账单ID
  - bookId: 关联账本ID
  - _openid: 创建者openid（记录谁添加的这笔账单）
  - amount: 金额
  - description: 账单描述
  - participantIds: 参与AA的成员ID数组
  - payerId: 付款人成员ID
  - createTime: 创建时间
```

### 权限策略

- `books` 集合：仅创建者可写，所有人可读（通过shareCode查询）
- `members` 集合：通过安全规则限制，仅创建者的openid可写入对应bookId的成员数据
- `bills` 集合：已登录用户（有openid）可为对应bookId添加账单，所有人可读

### 数据流

```
创建账本 → 添加成员 → 分享账本(生成带shareCode链接)
  ↓
打开分享链接 → 加载账本数据(含成员列表+账单列表+统计)
  ↓
添加账单 → 检查登录状态 → 未登录则微信授权 → 选择参与成员 → 写入数据库
  ↓
统计计算 → 前端聚合计算每个成员的应付/已付/差额
```

## 实现要点

- 统计逻辑在前端通过聚合账单数据实现（遍历bills按成员分组求和），避免额外的云函数开销
- 分享机制使用小程序`wx.shareAppMessage`结合shareCode参数传递
- 登录使用`wx.cloud.callFunction`获取openid，结合`wx.getUserProfile`获取用户昵称头像

## 目录结构

```
c:/Users/kqq/CodeBuddy/20260411001711/
├── miniprogram/
│   ├── app.js                          # [NEW] 应用入口，初始化云开发环境
│   ├── app.json                        # [NEW] 全局配置，注册页面路径和TDesign组件
│   ├── app.wxss                        # [NEW] 全局样式变量和基础样式
│   ├── pages/
│   │   ├── index/                      # [NEW] 首页（我的账本列表 + 创建账本入口）
│   │   │   ├── index.js                # [NEW] 首页逻辑：加载账本列表、创建新账本
│   │   │   ├── index.json              # [NEW] 页面配置：引入TDesign组件
│   │   │   ├── index.wxml              # [NEW] 首页模板：账本卡片列表 + FAB创建按钮
│   │   │   └── index.wxss              # [NEW] 首页样式
│   │   ├── book-detail/                # [NEW] 账本详情页（核心页面）
│   │   │   ├── book-detail.js          # [NEW] 详情页逻辑：加载账本/成员/账单/统计数据
│   │   │   ├── book-detail.json        # [NEW] 页面配置：引入TDesign组件
│   │   │   ├── book-detail.wxml        # [NEW] 详情页模板：概览/账单列表/成员统计
│   │   │   └── book-detail.wxss        # [NEW] 详情页样式
│   │   ├── add-bill/                   # [NEW] 添加/编辑账单页
│   │   │   ├── add-bill.js             # [NEW] 账单表单逻辑：登录检查、表单提交、成员选择
│   │   │   ├── add-bill.json           # [NEW] 页面配置：引入TDesign表单组件
│   │   │   ├── add-bill.wxml           # [NEW] 账单表单模板：金额/描述/参与者多选
│   │   │   └── add-bill.wxss           # [NEW] 表单样式
│   │   ├── create-book/                # [NEW] 创建账本页
│   │   │   ├── create-book.js          # [NEW] 创建账本逻辑
│   │   │   ├── create-book.json        # [NEW] 页面配置
│   │   │   ├── create-book.wxml        # [NEW] 账本名称输入表单
│   │   │   └── create-book.wxss        # [NEW] 样式
│   │   └── member-manage/              # [NEW] 成员管理页
│   │       ├── member-manage.js        # [NEW] 成员CRUD逻辑：添加/删除/排序
│   │       ├── member-manage.json      # [NEW] 页面配置
│   │       ├── member-manage.wxml      # [NEW] 成员列表 + 添加成员表单
│   │       └── member-manage.wxss      # [NEW] 样式
├── cloudfunctions/
│   └── login/                          # [NEW] 登录云函数，获取openid
│       ├── index.js                    # [NEW] 云函数入口
│       └── package.json                # [NEW] 云函数依赖
├── project.config.json                 # [NEW] 小程序项目配置文件
├── project.private.config.json         # [NEW] 私有配置（不提交）
├── package.json                        # [NEW] 项目依赖（tdesign-miniprogram）
└── sitemap.json                        # [NEW] 小程序索引配置
```

## 设计风格概述

采用现代简约的金融科技风格，以清爽的白底配合活力的主色调，营造轻松愉快的记账氛围。整体视觉层次分明，使用卡片式布局组织信息，配合适度的圆角和阴影提升质感。

## 页面规划（5个核心页面）

### 页面1：首页 - 我的账本

- **顶部导航块**：显示应用标题"AA记账"，右侧设置入口
- **账本列表区域**：以卡片形式展示所有已创建的账本，每张卡片显示账本名称、成员数量、账单数量、总金额摘要
- **快捷操作区**：右下角悬浮的FAB按钮"新建账本"，使用品牌色填充带加号图标
- **空状态提示**：无账本时展示引导插图和"创建你的第一个账本"文案

### 页面2：账本详情页（核心页面）

- **账本头部信息块**：展示账本名称、创建时间、成员头像横向排列、总金额大字突出显示
- **快捷操作栏**：包含"添加账单"、"管理成员"、"分享"三个操作按钮
- **账单列表区块**：按时间倒序展示账单卡片，每条显示消费描述、金额、参与成员头像组、付款人标签
- **成员统计区块**：底部固定区域展示每个成员的消费统计卡片，包含消费总额、应付份额、已付金额、差额（用红色表示需支付、绿色表示应收款）
- **底部导航**：可在"账单列表"和"成员统计"两个Tab间切换

### 页面3：添加账单页

- **页面标题块**：返回导航 + "添加账单"标题
- **表单区域 - 金额输入**：大字金额输入框，带人民币符号前缀，数字键盘友好
- **表单区域 - 描述输入**：文本输入框，placeholder"请输入消费描述"
- **表单区域 - 付款人选择**：单选组件，从成员中选择谁是实际付款人
- **表单区域 - 参与成员选择**：Checkbox多选组件，勾选哪些人参与本次AA分摊
- **预览确认区**：实时显示人均金额预览
- **提交按钮**：底部固定"保存"按钮

### 页面4：创建账本页

- **简洁表单**：仅需输入账本名称
- **提交按钮**："创建账本"按钮，创建成功后跳转到成员管理页

### 页面5：成员管理页

- **当前成员列表**：以Tag/Chip形式展示现有成员，每个成员显示昵称和彩色头像圆圈，长按可删除
- **添加成员表单**：输入框输入昵称 + 自动分配颜色 + 确认添加按钮
- **成员颜色系统**：预设8种柔和色彩循环分配给新成员作为头像背景色

## Agent Extensions

- **code-explorer**
- Purpose: 在项目搭建完成后进行代码结构验证和依赖检查
- Expected outcome: 确认项目文件结构完整、依赖正确安装、配置无误