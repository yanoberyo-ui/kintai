/**
 * パスワードヒント回答のハッシュ化ユーティリティ
 * Web Crypto API (SHA-256) を使用
 */

/**
 * ランダムなソルトを生成する
 * @returns {string} 16バイトのhex文字列
 */
export function generateSalt() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 回答をソルト付きSHA-256でハッシュ化する
 * @param {string} answer - ハッシュ化する回答
 * @param {string} salt - ソルト文字列
 * @returns {Promise<string>} hex形式のハッシュ値
 */
export async function hashHintAnswer(answer, salt) {
  const normalized = answer.toLowerCase().trim()
  const data = new TextEncoder().encode(salt + normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
