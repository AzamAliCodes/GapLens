import React from 'react';

export const NBInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`nb-input w-full font-mono text-sm ${className}`}
        {...props}
      />
    );
  }
);
NBInput.displayName = 'NBInput';

export const NBTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`nb-input w-full font-mono text-sm resize-y ${className}`}
        {...props}
      />
    );
  }
);
NBTextarea.displayName = 'NBTextarea';
