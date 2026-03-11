export default function ChatPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-teal-500 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">تريجي</h1>
          <span className="text-sm opacity-80">مرشد طبي ذكي</span>
        </div>
      </header>

      {/* Chat Area — Placeholder for Phase 4 */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">محادثة الفرز الطبي</p>
          <p className="text-sm">سيتم تفعيلها في المرحلة الرابعة</p>
        </div>
      </div>

      {/* Input Area — Placeholder */}
      <div className="border-t bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              dir="rtl"
              placeholder="اكتب أعراضك هنا..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled
            />
            <button
              className="bg-teal-500 text-white px-6 py-3 rounded-xl font-semibold opacity-50 cursor-not-allowed"
              disabled
            >
              إرسال
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
