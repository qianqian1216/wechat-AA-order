const app = getApp()

const SLOGANS = [
  '🌸 今天一起AA吧',
  '🍜 我请客，你AA',
  '💰 吃好喝好，算清就好',
  '🧑‍🤝‍🧑 友谊第一，账单清',
  '🍕 吃吃喝喝，AA快乐',
  '✨ AA一时爽，一直爽',
  '🍻 举起酒杯，一起记账',
  '🤝 好兄弟明算账',
  '🎉 快乐加倍，钱包不累',
  '📋 吃完先算账再走'
]

Page({
  data: {
    myBooks: [],
    sharedBooks: [],
    loading: false,
    isEmpty: false,
    sharingBook: null,
    slogan: '🌸 摊一下'
  },

  onLoad() {
    const idx = Math.floor(Math.random() * SLOGANS.length)
    this.setData({ slogan: SLOGANS[idx] })
  },

  onShow() {
    const hasData = this.data.myBooks.length > 0 || this.data.sharedBooks.length > 0
    this.loadBooks(!hasData)
  },

  // 加载账本列表（同时查询我创建的 + 我可查看的）
  async loadBooks(showLoading = true) {
    if (showLoading) this.setData({ loading: true })
    try {
      const db = wx.cloud.database()

      let openid = app.globalData.openid || ''

      if (!openid) {
        try {
          const res = await wx.cloud.callFunction({ name: 'login' })
          openid = res.result.openid
          app.globalData.openid = openid
        } catch (loginErr) {
          console.warn('获取openid失败:', loginErr)
        }
      }

      if (!openid) {
        this.setData({ loading: false, isEmpty: true })
        return
      }

      // 并行查询：我创建的 + 我可查看的（通过 sharedWith 字段）
      const [myRes, sharedRes] = await Promise.all([
        db.collection('books')
          .where({ _openid: openid })
          .orderBy('updateTime', 'desc')
          .get(),
        db.collection('books')
          .where({
            sharedWith: openid,
            _openid: db.command.neq(openid)
          })
          .orderBy('updateTime', 'desc')
          .get()
      ])

      const myRaw = myRes.data || []
      const sharedRaw = sharedRes.data || []

      // 补全统计数据
      const enrichBook = async (book) => {
        try {
          const [membersData, billsData] = await Promise.all([
            db.collection('members').where({ bookId: book._id }).get(),
            db.collection('bills').where({ bookId: book._id }).get()
          ])

          const memberCount = (membersData.data || []).length
          const bills = billsData.data || []
          const billCount = bills.length
          const totalAmount = bills.reduce((sum, b) => sum + (b.amount || 0), 0)

          return {
            ...book,
            createTimeStr: book.createTimeStr || '',
            iconColor: book.iconColor || '#07C160',
            memberCount,
            billCount,
            totalAmount: totalAmount.toFixed(2)
          }
        } catch (statErr) {
          console.warn(`统计账本${book._id}失败:`, statErr)
          return {
            ...book,
            createTimeStr: book.createTimeStr || '',
            iconColor: book.iconColor || '#07C160',
            memberCount: '-',
            billCount: '-',
            totalAmount: '-'
          }
        }
      }

      // 并行补全两组账本的统计数据
      const [myBooks, sharedBooks] = await Promise.all([
        Promise.all(myRaw.map(enrichBook)),
        Promise.all(sharedRaw.map(enrichBook))
      ])

      this.setData({
        myBooks,
        sharedBooks,
        isEmpty: myBooks.length === 0 && sharedBooks.length === 0,
        loading: false
      })
    } catch (err) {
      console.error('加载账本失败:', err)
      this.setData({ loading: false, isEmpty: true })
    }
  },

  // 新建账本
  onAddBook() {
    wx.navigateTo({ url: '/pages/create-book/create-book' })
  },

  // 点击账本卡片
  onBookTap(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${id}` })
  },

  // 点击分享按钮时记录待分享的账本信息
  setSharingBook(e) {
    const { id, name } = e.currentTarget.dataset
    // 同时存入全局，避免页面切换丢失
    app.globalData.sharingBook = { id, name }
    this.setData({
      sharingBook: { id, name }
    })
  },

  // 页面分享（按钮触发 + 菜单触发都走这里）
  onShareAppMessage() {
    // 优先用按钮点击设置的
    let book = this.data.sharingBook
    if (!book || !book.id) {
      // 如果用户直接用了菜单，尝试从全局取
      book = app.globalData.sharingBook || null
    }
    if (book && book.id) {
      return {
        title: `在「${book.name}」账本中一起摊一下`,
        path: `/pages/book-detail/book-detail?shareCode=${book.id}`,
        imageUrl: ''
      }
    }
    return {
      title: '摊一下 - 轻松管理多人分账',
      path: '/pages/index/index'
    }
  }
})
