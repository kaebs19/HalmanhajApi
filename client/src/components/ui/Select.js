const baseClass = 'w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

export default function Select({ children, className = '', ...props }) {
  return (
    <select className={`${baseClass} ${className}`} {...props}>
      {children}
    </select>
  );
}
