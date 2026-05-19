const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { nickname, avatar } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { success: false, error: '获取用户身份失败' }
  }

  const db = cloud.database()
  const _ = db.command

  try {
    // 检查是否已有记录
    const existing = await db.collection('users').where({
      _openid: openid
    }).get()

    if (existing.data.length > 0) {
      // 更新
      await db.collection('users').doc(existing.data[0]._id).update({
        data: { nickname, avatar }
      })
    } else {
      // 新增（云函数中需显式设置 _openid）
      await db.collection('users').add({
        data: { _openid: openid, nickname, avatar }
      })
    }

    console.log('[saveUserInfo] 保存成功, openid:', openid, 'nickname:', nickname)
    return { success: true }
  } catch (err) {
    console.error('[saveUserInfo] 失败:', err)
    return { success: false, error: err.message }
  }
}
