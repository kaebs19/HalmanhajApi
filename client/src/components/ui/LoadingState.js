export default function LoadingState({ message = 'جاري التحميل...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
      </div>
      <p className="text-gray-400 text-sm font-medium">{message}</p>
    </div>
  );
}
