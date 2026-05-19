const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { path, query } = event

  // 生成微信 URL Scheme，好友点击可直接打开小程序到指定页面
  try {
    const result = await cloud.openapi.urlscheme.generate({
      jump_wxa: {
        path: path || '',
        query: query || ''
      },
      is_expire: true,
      expire_type: 1,
      expire_time: Math.floor(Date.now() / 1000) + 2592000 // 30天有效
    })
    return result
  } catch (err) {
    console.error('生成scheme失败:', err)
    return { err: err.message, errCode: err.errCode }
  }
}
