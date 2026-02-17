const variants = {
  error: 'bg-red-50 text-red-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-700',
};

export default function Alert({ children, variant = 'error', className = '' }) {
  return (
    <div className={`${variants[variant]} p-3 rounded-lg text-sm mb-4 ${className}`}>
      {children}
    </div>
  );
}
