export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${className}`} {...props}>
      {children}
    </div>
  );
}
