const baseClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer hover:file:bg-blue-100';

export default function FileInput({ hint, className = '', ...props }) {
  return (
    <div>
      <input type="file" className={`${baseClass} ${className}`} {...props} />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
