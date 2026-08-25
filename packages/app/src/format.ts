export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
export function yearWeek(turn: number): string {
  const year = Math.floor((turn - 1) / 52) + 1
  const week = ((turn - 1) % 52) + 1
  return `${year}년차 ${week}주`
}
