Page({
  data: {
    bookId: '',
    newBook: false,
    members: [],
    newNickname: '',
    colorIndex: 0,
    deleteConfirm: { show: false, id: '', nickname: '' },
    colors: [
      '#07C160', '#1890FF', '#FF9500', '#E54D42',
      '#7232DD', '#13C2C2', '#F5317D', '#FA8C16'
    ]
  },

  onLoad(options) {
    const { bookId, newBook } = options
    if (!bookId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({
      bookId,
      newBook: !!newBook
    })

    this.loadMembers()   // 首次加载
  },

  onShow() {
    // 返回时静默刷新（首次由 onLoad 处理）
    if (this.data.bookId && this.data.members.length > 0) {
      this.loadMembers()
    }
  },

  // 加载成员列表
  async loadMembers() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('members')
        .where({ bookId: this.data.bookId })
        .orderBy('createTime', 'asc')
        .get()

      this.setData({
        members: res.data || [],
        colorIndex: (res.data || []).length % this.data.colors.length
      })
    } catch (err) {
      console.error('加载成员失败:', err)
    }
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ newNickname: e.detail.value })
  },

  // 添加成员
  async onAddMember() {
    const { newNickname, bookId, members, colors, colorIndex } = this.data

    if (!newNickname.trim()) {
      return wx.showToast({ title: '请输入昵称', icon: 'none' })
    }

    if (newNickname.trim().length > 10) {
      return wx.showToast({ title: '昵称不能超过10个字', icon: 'none' })
    }

    try {
      const db = wx.cloud.database()
      const now = new Date()
      
      await db.collection('members').add({
        data: {
          bookId,
          nickname: newNickname.trim(),
          avatarColor: colors[colorIndex % colors.length],
          sortOrder: members.length,
          createTime: now
        }
      })

      // 更新账本成员数量
      await db.collection('books').doc(bookId).update({
        data: { memberCount: members.length + 1 }
      })

      this.setData({
        newNickname: '',
        colorIndex: (colorIndex + 1) % colors.length
      })

      wx.showToast({ title: '添加成功', icon: 'success' })
      this.loadMembers()
    } catch (err) {
      console.error('添加成员失败:', err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  // 删除成员
  onDeleteMember(e) {
    const { id, nickname } = e.currentTarget.dataset
    this.setData({
      deleteConfirm: { show: true, id, nickname }
    })
  },

  // 确认删除
  async onConfirmDelete() {
    const { id } = this.data.deleteConfirm
    this.setData({ 'deleteConfirm.show': false })

    try {
      const db = wx.cloud.database()

      await db.collection('members').doc(id).remove()

      await db.collection('books').doc(this.data.bookId).update({
        data: { memberCount: Math.max(0, this.data.members.length - 1) }
      })

      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadMembers()
    } catch (err) {
      console.error('删除失败:', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  // 取消删除
  onCancelDelete() {
    this.setData({ 'deleteConfirm.show': false })
  },

  // 完成（新账本创建流程）
  onFinish() {
    if (this.data.members.length === 0) {
      return wx.showToast({ title: '请至少添加一个成员', icon: 'none' })
    }

    wx.navigateBack()
  },

  // 分享邀请
  onShareAppMessage() {
    return {
      title: '邀请你加入AA记账',
      path: `/pages/book-detail/book-detail?shareCode=${this.data.bookId}`
    }
  }
})
