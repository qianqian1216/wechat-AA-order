const app = getApp()

Page({
  data: {
    bookId: '',
    shareCode: '',
    book: null,
    members: [],
    bills: [],
    stats: [],
    suggestions: [],  // 支付建议
    totalAmount: 0,
    activeTab: 'bills',
    loading: false,
    isOwner: false,
    shareAdded: false,
    currentOpenid: '',
    isLoggedIn: false,
    showSuggestionModal: false,  // 弹窗显示状态
    deleteBillConfirm: { show: false, id: '', desc: '' },
    _loaded: false              // 是否已加载过数据（用于判断首次/返回）
  },

  async onLoad(options) {
    const { id, shareCode } = options
    console.log('[book-detail] onLoad options:', JSON.stringify(options))
    this.setData({
      bookId: id || '',
      shareCode: shareCode || ''
    }, () => {
      console.log('[book-detail] shareCode 最终值:', this.data.shareCode)
    })
    await this.checkLogin()        // 先确保 openid 就绪
    this.loadBookData(true)        // 再加载数据
  },

  onShow() {
    // 返回时静默刷新（已有数据则不闪 loading）
    if ((this.data.bookId || this.data.shareCode) && this.data._loaded) {
      this.loadBookData(false) // 静默刷新
    }
  },

  // 检查登录状态
  async checkLogin() {
    if (app.globalData.openid) {
      this.setData({ isLoggedIn: true })
      return
    }
    // 尝试静默获取 openid
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      if (res && res.result && res.result.openid) {
        app.globalData.openid = res.result.openid
        this.setData({ isLoggedIn: true })
      }
    } catch (err) {
      console.warn('获取openid失败，非创建者访问:', err)
    }
  },

  // 加载账本数据
  async loadBookData(showLoading = true) {
    if (showLoading) this.setData({ loading: true })
    try {
      const db = wx.cloud.database()

      // 查询账本
      let bookRes
      if (this.data.bookId) {
        bookRes = await db.collection('books').doc(this.data.bookId).get()
      } else if (this.data.shareCode) {
        bookRes = await db.collection('books').where({ 
          _id: this.data.shareCode 
        }).get()
        if (bookRes.data && bookRes.data.length > 0) {
          this.setData({ bookId: bookRes.data[0]._id })
        }
      }

      // doc().get() 返回 data 为对象，where().get() 返回 data 为数组，统一处理
      const rawData = bookRes.data
      const book = Array.isArray(rawData) ? rawData[0] : rawData

      if (!book) {
        this.setData({ loading: false })
        wx.showToast({ title: '账本不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 检查是否为创建者
      let isOwner = false
      if (app.globalData.openid && app.globalData.openid === book._openid) {
        isOwner = true
      }

      // 检查当前用户是否已添加该共享账本（兼容字符串和对象两种格式）
      let shareAdded = false
      if (!isOwner && app.globalData.openid && Array.isArray(book.sharedWith)) {
        shareAdded = book.sharedWith.some(item => {
          if (typeof item === 'string') return item === app.globalData.openid
          if (typeof item === 'object' && item.openid) return item.openid === app.globalData.openid
          return false
        })
      }

      // 并行加载成员和账单
      const [membersRes, billsRes] = await Promise.all([
        db.collection('members').where({ bookId: book._id }).orderBy('sortOrder', 'asc').get(),
        db.collection('bills').where({ bookId: book._id }).orderBy('createTime', 'desc').get()
      ])

      const members = membersRes.data || []
      const bills = billsRes.data || []

      // 查询账单创建人的昵称（通过云函数，避免跨用户查询限制）
      const creatorOpenids = [...new Set(bills.map(b => b.creatorOpenid).filter(Boolean))]
      let creatorMap = {}
      if (creatorOpenids.length > 0) {
        try {
          const userRes = await wx.cloud.callFunction({
            name: 'getUserNames',
            data: { openids: creatorOpenids }
          })
          if (userRes.result && userRes.result.success) {
            creatorMap = userRes.result.data || {}
          }
        } catch (userErr) {
          console.warn('查询创建人昵称失败:', userErr)
        }
      }
      // 给每条账单附加创建人昵称
      const billsWithCreator = bills.map(b => ({
        ...b,
        creatorName: b.creatorOpenid ? (creatorMap[b.creatorOpenid] || '—') : ''
      }))

      // 计算统计数据
      const { stats, totalAmount, suggestions } = this.calcStats(members, bills)

      this.setData({
        book,
        members,
        bills: billsWithCreator,
        stats,
        totalAmount,
        suggestions: suggestions || [],
        isOwner,
        shareAdded,
        currentOpenid: app.globalData.openid || '',
        loading: false,
        _loaded: true
      })

      // 设置导航栏标题
      wx.setNavigationBarTitle({ title: book.name })
    } catch (err) {
      console.error('加载数据失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  // 计算成员统计
  calcStats(members, bills) {
    let totalAmount = 0
    const memberStats = {}

    // 初始化成员统计
    members.forEach(m => {
      memberStats[m._id] = {
        id: m._id,
        nickname: m.nickname,
        avatarColor: m.avatarColor,
        totalPaid: 0,      // 付款总额（作为付款人）
        totalShare: 0,      // 应付总额（作为参与人）
        balance: 0          // 差额（正数为应收，负数为应付）
      }
    })

    // 遍历账单计算
    bills.forEach(bill => {
      totalAmount += bill.amount

      // 付款人记录
      if (bill.payerId && memberStats[bill.payerId]) {
        memberStats[bill.payerId].totalPaid += bill.amount
      }

      // 参与人分摊
      if (bill.participantIds && bill.participantIds.length > 0) {
        const perPerson = bill.amount / bill.participantIds.length
        bill.participantIds.forEach(pid => {
          if (memberStats[pid]) {
            memberStats[pid].totalShare += perPerson
          }
        })
      }
    })

    // 计算差额和显示文本
    Object.values(memberStats).forEach(stat => {
      stat.balance = stat.totalPaid - stat.totalShare
      stat.totalPaid = Math.round(stat.totalPaid * 100) / 100
      stat.totalShare = Math.round(stat.totalShare * 100) / 100
      stat.balance = Math.round(stat.balance * 100) / 100

      // 预生成 WXML 显示所需的字段（小程序不支持在模板中调用 Math.abs 等方法）
      const absBalance = Math.abs(stat.balance)
      stat.balanceAbs = absBalance.toFixed(2)
      if (stat.balance > 0) {
        stat.balanceLabel = '+应收'
      } else if (stat.balance < 0) {
        stat.balanceLabel = '应付'
      } else {
        stat.balanceLabel = '已平账'
      }
    })

    // 生成支付建议方案
    const suggestions = this.calcPaymentSuggestions(memberStats)

    return {
      stats: Object.values(memberStats),
      totalAmount: Math.round(totalAmount * 100) / 100,
      suggestions
    }
  },

  /**
   * 智能支付建议算法 - 最优转账方案
   * 原理：将所有需要付款的人（债务人）和需要收款的人（债权人）进行匹配
   * 目标：用最少的转账次数结清所有账目
   */
  calcPaymentSuggestions(memberStats) {
    const suggestions = []

    // 分离债务人和债权人
    const debtors = []  // 需要付钱的人 (balance < 0)
    const creditors = []  // 需要收钱的人 (balance > 0)

    Object.values(memberStats).forEach(stat => {
      if (stat.balance < -0.005) {  // 浮点数误差处理，小于-0.01才算负债
        debtors.push({
          id: stat.id,
          nickname: stat.nickname,
          avatarColor: stat.avatarColor,
          amount: Math.abs(stat.balance)
        })
      } else if (stat.balance > 0.005) {  // 大于0.01才算有应收
        creditors.push({
          id: stat.id,
          nickname: stat.nickname,
          avatarColor: stat.avatarColor,
          amount: stat.balance
        })
      }
    })

    // 如果没有需要结算的直接返回
    if (debtors.length === 0 || creditors.length === 0) {
      return suggestions
    }

    // 双指针匹配算法：债务人逐个向债权人付款
    let debtorIdx = 0
    let creditorIdx = 0

    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const debtor = debtors[debtorIdx]
      const creditor = creditors[creditorIdx]

      // 计算本次转账金额（取较小值）
      const transferAmount = Math.min(debtor.amount, creditor.amount)

      // 保留两位小数
      const amount = Math.round(transferAmount * 100) / 100

      if (amount > 0.005) {  // 大于0.01才生成建议
        suggestions.push({
          from: debtor.nickname,
          fromColor: debtor.avatarColor,
          to: creditor.nickname,
          toColor: creditor.avatarColor,
          amount: amount.toFixed(2)
        })
      }

      // 更新剩余金额
      debtor.amount -= transferAmount
      creditor.amount -= transferAmount

      // 如果当前债务人已还完，移到下一个
      if (debtor.amount <= 0.005) {
        debtorIdx++
      }

      // 如果当前债权人已收完，移到下一个
      if (creditor.amount <= 0.005) {
        creditorIdx++
      }
    }

    return suggestions
  },

  // 显示建议支付方案弹窗
  onShowSuggestion() {
    this.setData({ showSuggestionModal: true })
  },

  // 关闭弹窗
  onCloseSuggestion() {
    this.setData({ showSuggestionModal: false })
  },

  // 阻止弹窗内滚动穿透
  preventMove() {},

  // Tab切换
  onTabChange(e) {
    this.setData({ activeTab: e.detail.value })
  },

  // 跳转到AA结算（操作栏按钮）
  onGoSettlement() {
    this.setData({ activeTab: 'stats' })
    if (this.data.suggestions.length > 0) {
      setTimeout(() => { this.onShowSuggestion() }, 300)
    }
  },

  // 添加账单（创建者和被分享者都可添加）
  async onAddBill() {
    // 检查是否已授权昵称
    const openid = app.globalData.openid
    if (openid) {
      try {
        const db = wx.cloud.database()
        const userRes = await db.collection('users').where({ _openid: openid }).get()
        if (!userRes.data || userRes.data.length === 0) {
          // 未授权，引导授权
          wx.showModal({
            title: '需要授权昵称',
            content: '添加账单前需要获取你的微信昵称，请先授权',
            confirmText: '去授权',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({
                  url: `/pages/create-book/create-book?authOnly=1&returnBookId=${this.data.bookId}`
                })
              }
            }
          })
          return
        }
      } catch (err) {
        console.warn('检查授权失败:', err)
      }
    }
    wx.navigateTo({
      url: `/pages/add-bill/add-bill?bookId=${this.data.bookId}`
    })
  },

  // 微信登录
  doLogin(callback) {
    wx.getUserProfile({
      desc: '用于完善用户信息',
      success: (res) => {
        app.globalData.userInfo = res.userInfo
        // 调用云函数获取openid
        wx.cloud.callFunction({ name: 'login' }).then(loginRes => {
          app.globalData.openid = loginRes.result.openid
          callback && callback()
        })
      },
      fail: () => {
        wx.showToast({ title: '登录已取消', icon: 'none' })
      }
    })
  },

  // 管理成员
  onManageMembers() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅创建者可管理成员', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/member-manage/member-manage?bookId=${this.data.bookId}`
    })
  },

  // 编辑账单（只能编辑自己创建的）
  onEditBill(e) {
    const { id, creator } = e.currentTarget.dataset
    const { currentOpenid } = this.data
    if (creator && creator !== currentOpenid) {
      wx.showToast({ title: '只能编辑自己创建的账单', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/add-bill/add-bill?bookId=${this.data.bookId}&billId=${id}`
    })
  },

  // 删除账单（只能删除自己创建的）
  onDeleteBill(e) {
    const { id, desc, creator } = e.currentTarget.dataset
    const { currentOpenid } = this.data
    if (creator && creator !== currentOpenid) {
      wx.showToast({ title: '只能删除自己创建的账单', icon: 'none' })
      return
    }
    this.setData({
      deleteBillConfirm: { show: true, id, desc }
    })
  },

  // 确认删除账单
  onConfirmDeleteBill() {
    const { id } = this.data.deleteBillConfirm
    this.setData({ 'deleteBillConfirm.show': false })
    this.doDeleteBill(id)
  },

  // 取消删除账单
  onCancelDeleteBill() {
    this.setData({ 'deleteBillConfirm.show': false })
  },

  // 执行删除
  async doDeleteBill(billId) {
    try {
      const db = wx.cloud.database()
      await db.collection('bills').doc(billId).remove()
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadBookData() // 刷新数据
    } catch (err) {
      console.error('删除失败:', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: `【${this.data.book ? this.data.book.name : '摊一下'}】邀请你一起记账`,
      path: `/pages/book-detail/book-detail?shareCode=${this.data.bookId}`,
      imageUrl: '' // 可设置分享图片
    }
  },

  // 记录分享访问（非创建者通过分享链接访问时调用）
  async recordShareAccess() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'recordShareAccess',
        data: { bookId: this.data.bookId }
      })
      console.log('[book-detail] recordShareAccess 云函数返回值:', JSON.stringify(res.result))
      if (res.result && res.result.success) {
        console.log('[book-detail] 分享访问记录成功')
      } else {
        console.warn('[book-detail] 分享访问记录失败:', res.result)
      }
      return res.result
    } catch (err) {
      console.warn('[book-detail] 调用 recordShareAccess 失败，请确认云函数已部署并上传:', err)
      return { success: false, error: err.message }
    }
  },

  // 非创建者主动点击"添加到我的账本"
  async onAddToMyBooks() {
    if (this.data.shareAdded) return
    wx.showLoading({ title: '添加中...' })
    const result = await this.recordShareAccess()
    wx.hideLoading()
    if (result && result.success) {
      this.setData({ shareAdded: true })
      wx.showToast({ title: '已添加到我的账本', icon: 'success' })
    } else {
      wx.showToast({ title: '添加失败，请重试', icon: 'none' })
    }
  }
})
