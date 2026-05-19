const app = getApp()

Page({
  data: {
    name: '',
    submitting: false,
    authorized: false,
    authChecking: true
  },

  async onLoad() {
    await this.checkAuth()
  },

  // 检查授权状态
  async checkAuth() {
    this.setData({ authChecking: true })

    // 已有 openid，已授权
    if (app.globalData.openid) {
      this.setData({ authorized: true, authChecking: false })
      return
    }

    // 尝试静默获取 openid
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      if (res && res.result && res.result.openid) {
        app.globalData.openid = res.result.openid
        this.setData({ authorized: true, authChecking: false })
        return
      }
    } catch (err) {
      console.warn('静默登录失败:', err)
    }

    // 静默获取失败，需要用户授权
    this.setData({ authorized: false, authChecking: false })
  },

  // 用户授权登录
  async onAuthorize() {
    try {
      wx.showLoading({ title: '授权中...' })
      const res = await wx.getUserProfile({
        desc: '用于创建账本'
      })
      app.globalData.userInfo = res.userInfo

      const loginRes = await wx.cloud.callFunction({ name: 'login' })
      if (loginRes && loginRes.result && loginRes.result.openid) {
        app.globalData.openid = loginRes.result.openid
        this.setData({ authorized: true })
        wx.hideLoading()
        wx.showToast({ title: '授权成功', icon: 'success' })
      } else {
        throw new Error('获取openid失败')
      }
    } catch (err) {
      wx.hideLoading()
      if (err.errMsg && err.errMsg.includes('deny')) {
        wx.showToast({ title: '授权已取消，无法创建账本', icon: 'none' })
      } else {
        console.error('授权失败:', err)
        wx.showToast({ title: '授权失败，请重试', icon: 'none' })
      }
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  async onSubmit() {
    const { name, submitting, authorized } = this.data

    if (submitting) return

    if (!authorized) {
      wx.showToast({ title: '请先授权后才能创建账本', icon: 'none' })
      return
    }

    if (!name.trim()) {
      return wx.showToast({ title: '请输入账本名称', icon: 'none' })
    }

    if (name.trim().length > 20) {
      return wx.showToast({ title: '名称不能超过20个字', icon: 'none' })
    }

    this.setData({ submitting: true })

    try {
      const db = wx.cloud.database()
      const now = new Date()

      const colors = ['#07C160', '#1890FF', '#FF9500', '#E54D42', '#7232DD', '#13C2C2', '#F5317D', '#FA8C16']
      const iconColor = colors[Math.floor(Math.random() * colors.length)]

      const res = await db.collection('books').add({
        data: {
          name: name.trim(),
          iconColor,
          memberCount: 0,
          billCount: 0,
          totalAmount: '0.00',
          shareCode: '',
          createTime: now,
          createTimeStr: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
          updateTime: now,
          updateTimeStr: ''
        }
      })

      wx.showToast({ title: '创建成功', icon: 'success' })

      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/member-manage/member-manage?bookId=${res._id}&newBook=1`
        })
      }, 1200)
    } catch (err) {
      console.error('创建账本失败:', err)
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
