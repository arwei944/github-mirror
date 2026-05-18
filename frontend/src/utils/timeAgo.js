/**
 * 将 ISO 时间戳转换为相对时间描述
 * @param {string} dateStr - ISO 8601 时间字符串
 * @returns {string} 相对时间描述，如 "3 分钟前"
 */
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`
  const years = Math.floor(months / 12)
  return `${years} 年前`
}

/**
 * 格式化数字（添加千分位）
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num == null) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
