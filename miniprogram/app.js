App({
  onLaunch: function() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-1gi86ka032e77acf', // 请替换为您的云开发环境ID
        traceUser: true,
      })
    }

    // 获取系统信息
    const sysInfo = wx.getSystemInfoSync()
    this.globalData.statusBarHeight = sysInfo.statusBarHeight
    this.globalData.screenWidth = sysInfo.screenWidth
    this.globalData.screenHeight = sysInfo.screenHeight
  },

  globalData: {
    userInfo: null,
    openid: null,
    sharingBook: null,
    statusBarHeight: 0,
    screenWidth: 375,
    screenHeight: 667
  }
})
