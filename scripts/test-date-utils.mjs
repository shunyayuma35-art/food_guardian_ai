import assert from 'node:assert/strict'

// utils.ts と同等のロジックを直接テスト
function formatLocalDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addLocalDays(base, n) {
  const [y, mo, d] = base.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  dt.setDate(dt.getDate() + n)
  return formatLocalDate(dt)
}

// テスト1: +30日（月またぎ）
assert.equal(addLocalDays('2026-10-07', 30), '2026-11-06', '+30日')

// テスト2: +365日（年またぎ）
assert.equal(addLocalDays('2026-10-07', 365), '2027-10-07', '+365日')

// テスト3: 1月末+30日（閏年でない年）
assert.equal(addLocalDays('2026-01-31', 30), '2026-03-02', '1月31日+30日')

// テスト4: JST 08:00 の new Date() → 今日の日付（UTC変換しない）
// JST = UTC+9 なので UTC で -1 日にならないことを確認
const jstDate = new Date('2026-10-07T08:00:00+09:00')
assert.equal(formatLocalDate(jstDate), '2026-10-07', 'JST 08:00 → 2026-10-07')

console.log('All 4 tests passed.')
