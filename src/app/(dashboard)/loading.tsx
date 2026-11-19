// แสดงทันทีระหว่างรอข้อมูลจากเซิร์ฟเวอร์ (ผู้ใช้เห็นการตอบสนองตั้งแต่คลิก)
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-7 w-64 rounded bg-stone-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-stone-200" />)}</div>
      <div className="h-80 rounded-lg bg-stone-200" />
    </div>
  );
}
