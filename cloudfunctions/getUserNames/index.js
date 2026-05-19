const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { openids } = event
  if (!openids || !Array.isArray(openids) || openids.length === 0) {
    return { success: false, error: '缺少参数' }
  }

  const db = cloud.database()
  const _ = db.command

  try {
    // 批量查询用户信息
    const res = await db.collection('users')
      .where({ _openid: _.in(openids) })
      .get()

    const userMap = {}
    ;(res.data || []).forEach(u => {
      if (u._openid) {
        userMap[u._openid] = u.nickname || '—'
      }
    })

    return { success: true, data: userMap }
  } catch (err) {
    console.error('[getUserNames] 失败:', err)
    return { success: false, error: err.message }
  }
}
