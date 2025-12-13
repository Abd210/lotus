import React from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  React.useEffect(() => {
    // Auto scroll to top when toast appears
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-900/90' : 'bg-red-900/90';
  const borderColor = type === 'success' ? 'border-green-500' : 'border-red-500';
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  const textColor = type === 'success' ? 'text-green-300' : 'text-red-300';

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slide-in">
      <div className={`${bgColor} ${borderColor} border-2 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-md min-w-[300px] max-w-md`}>
        <div className="flex items-center gap-3">
          <i className={`fas ${icon} ${textColor} text-2xl`}></i>
          <p className="text-off-white font-medium flex-1">{message}</p>
          <button onClick={onClose} className="text-off-white/70 hover:text-off-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState(null);

  const showToast = React.useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const hideToast = React.useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={hideToast} />
  ) : null;

  return { showToast, ToastComponent };
}
