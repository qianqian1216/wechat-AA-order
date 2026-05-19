const app = getApp()

Page({
  data: {
    bookId: '',
    billId: '',  // 编辑模式下的账单ID
    isEdit: false,  // 是否为编辑模式
    amount: '',
    description: '',
    payerId: '',
    participantIds: [],
    members: [],
    submitting: false
  },

  onLoad(options) {
    const { bookId, billId } = options
    if (!bookId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({ 
      bookId,
      billId: billId || '',
      isEdit: !!billId
    })

    this.loadMembers()
    
    // 编辑模式：加载账单数据
    if (billId) {
      this.loadBillData(billId)
    }
  },

  // 加载成员列表
  async loadMembers() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('members')
        .where({ bookId: this.data.bookId })
        .orderBy('sortOrder', 'asc')
        .get()
      
      const members = (res.data || []).map(m => ({
        ...m,
        selected: false  // 默认未选中
      }))
      
      this.setData({ members })
    } catch (err) {
      console.error('加载成员失败:', err)
    }
  },

  // 编辑模式：加载账单数据
  async loadBillData(billId) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('bills').doc(billId).get()
      const bill = res.data

      if (bill) {
        wx.setNavigationBarTitle({ title: '编辑账单' })
        
        // 更新成员的选中状态
        const participantIds = bill.participantIds || []
        const members = this.data.members.map(m => ({
          ...m,
          selected: participantIds.includes(m._id)
        }))

        this.setData({
          amount: String(bill.amount),
          description: bill.description || '',
          payerId: bill.payerId || '',
          participantIds,
          members
        })
      }
    } catch (err) {
      console.error('加载账单失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 输入处理
  onAmountInput(e) {
    let val = e.detail.value
    // 只允许数字和小数点
    val = val.replace(/[^\d.]/g, '')
    // 小数点后最多两位
    const parts = val.split('.')
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('')
    if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].slice(0, 2)

    this.setData({ amount: val })
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value })
  },

  // 选择付款人（点击选择）
  onPayerTap(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ payerId: id })
  },

  // 多选参与成员（点击切换）
  onParticipantTap(e) {
    const { id } = e.currentTarget.dataset
    let { members, participantIds } = this.data
    
    // 更新选中状态
    const updatedMembers = members.map(m => {
      if (m._id === id) {
        const newSelected = !m.selected
        if (newSelected) {
          participantIds.push(id)
        } else {
          const idx = participantIds.indexOf(id)
          if (idx > -1) participantIds.splice(idx, 1)
        }
        return { ...m, selected: newSelected }
      }
      return m
    })
    
    this.setData({ 
      members: updatedMembers,
      participantIds: [...participantIds]
    })
  },

  // 全选
  onSelectAll() {
    const allIds = this.data.members.map(m => m._id)
    const updatedMembers = this.data.members.map(m => ({ ...m, selected: true }))
    
    this.setData({ 
      participantIds: allIds,
      members: updatedMembers
    })
  },

  // 清空
  onClearAll() {
    const updatedMembers = this.data.members.map(m => ({ ...m, selected: false }))
    
    this.setData({ 
      participantIds: [],
      members: updatedMembers
    })
  },

  // 计算人均金额
  getAvgAmount() {
    const { amount, participantIds } = this.data
    if (!amount || participantIds.length === 0) return '0.00'
    return (parseFloat(amount) / participantIds.length).toFixed(2)
  },

  // 提交表单
  async onSubmit() {
    const { amount, description, payerId, participantIds, bookId, members, submitting, isEdit, billId } = this.data

    if (submitting) return

    // 表单验证
    if (!amount || parseFloat(amount) <= 0) {
      return wx.showToast({ title: '请输入有效金额', icon: 'none' })
    }

    if (!description.trim()) {
      return wx.showToast({ title: '请输入消费描述', icon: 'none' })
    }

    if (!payerId) {
      return wx.showToast({ title: '请选择付款人', icon: 'none' })
    }

    if (participantIds.length === 0) {
      return wx.showToast({ title: '请选择参与成员', icon: 'none' })
    }

    this.setData({ submitting: true })

    try {
      const db = wx.cloud.database()
      const now = new Date()
      
      // 构建参与者详细信息
      const participants = members.filter(m => participantIds.includes(m._id))
      // 获取付款人信息
      const payer = members.find(m => m._id === payerId)

      const billData = {
        bookId,
        amount: parseFloat(amount),
        description: description.trim(),
        payerId,
        payerName: payer ? payer.nickname : '',
        participantIds,
        participants: participants.map(p => ({
          _id: p._id,
          nickname: p.nickname
        })),
        creatorOpenid: app.globalData.openid || '',
        createTime: now,
        createTimeStr: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      }

      if (isEdit && billId) {
        // 编辑模式：更新账单
        await db.collection('bills').doc(billId).update({ data: billData })
        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        // 新增模式：添加账单
        await db.collection('bills').add({ data: billData })
        wx.showToast({ title: '添加成功', icon: 'success' })
      }

      // 更新账本的updateTime
      await db.collection('books').doc(bookId).update({
        data: {
          updateTime: now,
          updateTimeStr: `更新于 ${now.getMonth()+1}月${now.getDate()}日`
        }
      })

      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      console.error(isEdit ? '编辑账单失败:' : '添加账单失败:', err)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 重置表单
  onReset() {
    const updatedMembers = this.data.members.map(m => ({ ...m, selected: false }))
    this.setData({
      amount: '',
      description: '',
      payerId: '',
      participantIds: [],
      members: updatedMembers
    })
  }
})
