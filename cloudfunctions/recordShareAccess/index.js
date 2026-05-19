const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { bookId } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('[recordShareAccess] bookId:', bookId, 'openid:', openid)

  if (!bookId || !openid) {
    console.error('[recordShareAccess] 缺少参数')
    return { success: false, error: '缺少参数' }
  }

  const db = cloud.database()

  try {
    const bookRes = await db.collection('books').doc(bookId).get()
    const book = bookRes.data
    if (!book) {
      console.error('[recordShareAccess] 账本不存在:', bookId)
      return { success: false, error: '账本不存在' }
    }

    console.log('[recordShareAccess] 账本创建者:', book._openid, '访问者:', openid)

    if (book._openid === openid) {
      console.log('[recordShareAccess] 创建者本人访问，跳过记录')
      return { success: true, isOwner: true }
    }

    // 统一转为字符串数组（兼容旧版对象格式）
    let sharedWith = (book.sharedWith || []).map(item => {
      if (typeof item === 'object' && item.openid) return item.openid
      return item
    }).filter(Boolean)

    if (!Array.isArray(sharedWith)) sharedWith = []

    if (sharedWith.includes(openid)) {
      console.log('[recordShareAccess] openid已存在，无需重复添加')
      return { success: true, alreadyExists: true }
    }

    sharedWith.push(openid)

    await db.collection('books').doc(bookId).update({
      data: {
        sharedWith: sharedWith
      }
    })

    console.log('[recordShareAccess] 添加成功, sharedWith:', sharedWith)
    return { success: true }
  } catch (err) {
    console.error('[recordShareAccess] 失败:', err)
    return { success: false, error: err.message }
  }
}
