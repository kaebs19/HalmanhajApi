const baseClass = 'w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function Input({ className = '', ...props }) {
  return (
    <input className={`${baseClass} ${className}`} {...props} />
  );
}
