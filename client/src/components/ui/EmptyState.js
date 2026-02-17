export default function EmptyState({ icon = '📋', message, subMessage, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
      <span className="text-5xl block mb-3">{icon}</span>
      <p className="text-gray-500">{message}</p>
      {subMessage && <p className="text-gray-400 text-sm mt-1">{subMessage}</p>}
      {children}
    </div>
  );
}
