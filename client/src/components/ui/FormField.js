export default function FormField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-gray-600 text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}
