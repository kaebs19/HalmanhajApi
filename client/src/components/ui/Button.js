const base = 'rounded-lg font-medium transition-colors';

const variants = {
  primary: {
    md: `bg-blue-600 text-white px-8 py-2.5 ${base} hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`,
    sm: `bg-blue-600 text-white px-4 py-1.5 ${base} text-sm hover:bg-blue-700`,
  },
  secondary: {
    md: `bg-gray-100 text-gray-700 px-8 py-2.5 ${base} hover:bg-gray-200`,
    sm: `bg-gray-100 text-gray-700 px-4 py-1.5 ${base} text-sm hover:bg-gray-200`,
  },
  danger: {
    md: `bg-red-50 text-red-600 px-4 py-1.5 ${base} text-sm hover:bg-red-100`,
    sm: `bg-red-50 text-red-600 px-4 py-1.5 ${base} text-sm hover:bg-red-100`,
  },
  edit: {
    md: `bg-yellow-50 text-yellow-700 px-4 py-1.5 ${base} text-sm hover:bg-yellow-100`,
    sm: `bg-yellow-50 text-yellow-700 px-4 py-1.5 ${base} text-sm hover:bg-yellow-100`,
  },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick,
  disabled,
  icon,
  className = '',
  ...props
}) {
  const classes = variants[variant]?.[size] || variants.primary.md;

  if (icon) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${classes} flex items-center gap-2 ${className}`}
        {...props}
      >
        <span className="text-lg">{icon}</span>
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
