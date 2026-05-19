const app = getApp()

Page({
  data: {
    name: '',
    submitting: false,
    authorized: false,
    authChecking: true,
    tempNickname: ''
  },

  async onLoad(options) {
    this.authOnly = options.authOnly === '1'
    this.returnBookId = options.returnBookId || ''
    await this.checkAuth()
  },

  // 检查授权状态
  async checkAuth() {
    this.setData({ authChecking: true })
    let openid = app.globalData.openid

    if (!openid) {
      try {
        const res = await wx.cloud.callFunction({ name: 'login' })
        if (res && res.result && res.result.openid) {
          openid = res.result.openid
          app.globalData.openid = openid
        }
      } catch (err) {
        console.warn('获取openid失败:', err)
      }
    }

    if (openid) {
      try {
        const db = wx.cloud.database()
        const userRes = await db.collection('users').where({ _openid: openid }).get()
        if (userRes.data && userRes.data.length > 0) {
          this.setData({ authorized: true, authChecking: false })
          // 如果只是来授权的，且已有授权，直接跳转
          if (this.authOnly && this.returnBookId) {
            wx.redirectTo({
              url: `/pages/add-bill/add-bill?bookId=${this.returnBookId}`
            })
          }
          return
        }
      } catch (err) {
        console.warn('查询用户信息失败:', err)
      }
    }

    this.setData({ authorized: false, authChecking: false })
  },

  // 昵称审核通过
  onNicknameReview(e) {
    const { value } = e.detail
    if (value) {
      this.setData({ tempNickname: value })
    }
  },

  // 昵称输入框失去焦点
  onNicknameBlur(e) {
    const value = e.detail.value
    if (value && !this.data.tempNickname) {
      this.setData({ tempNickname: value })
    }
  },

  // 确认授权
  async onConfirmAuth() {
    const nickname = this.data.tempNickname
    if (!nickname) {
      wx.showToast({ title: '请先点击输入框获取昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '授权中...' })
    try {
      // 确保有 openid
      if (!app.globalData.openid) {
        const res = await wx.cloud.callFunction({ name: 'login' })
        if (res && res.result && res.result.openid) {
          app.globalData.openid = res.result.openid
        }
      }

      // 保存到 users 集合
      app.globalData.userInfo = { nickName: nickname, avatarUrl: '' }
      try {
        await wx.cloud.callFunction({
          name: 'saveUserInfo',
          data: { nickname, avatar: '' }
        })
      } catch (saveErr) {
        console.warn('保存用户信息失败:', saveErr)
      }

      this.setData({ authorized: true })
      wx.hideLoading()
      wx.showToast({ title: '授权成功', icon: 'success' })

      // 如果是仅为授权而来，授权完成后跳转回添加账单
      if (this.authOnly && this.returnBookId) {
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/add-bill/add-bill?bookId=${this.returnBookId}`
          })
        }, 1500)
        return
      }
    } catch (err) {
      wx.hideLoading()
      console.error('授权失败:', err)
      wx.showToast({ title: '授权失败', icon: 'none' })
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  async onSubmit() {
    const { name, submitting } = this.data

    if (submitting) return

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
