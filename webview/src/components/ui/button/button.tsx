import { ComponentType, forwardRef } from 'react';
import { IconBaseProps } from 'react-icons';
import './button.scss';

export type ButtonVariant =
  | 'ghost'
  | 'primary'
  | 'secondary'
  | 'contained'
  | 'error'
  | 'trigger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  startIcon?: ComponentType<IconBaseProps>;
  endIcon?: ComponentType<IconBaseProps>;
  icon?: ComponentType<IconBaseProps>;
  iconPosition?: 'start' | 'end';
}

const VARIANTS: Record<ButtonVariant, string> = {
  ghost: 'btn-ghost',
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  contained: 'btn-contained',
  error: 'btn-error',
  trigger: 'btn-trigger',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'ghost',
      size = 'md',
      startIcon: StartIcon,
      endIcon: EndIcon,
      icon: Icon,
      iconPosition = 'start',
      className,
      children,
      disabled,
      type,
      ...rest
    },
    ref,
  ) {
    const classes = [
      'btn',
      VARIANTS[variant],
      SIZES[size],
      Icon ? 'btn-icon-only' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={disabled}
        {...rest}>
        {Icon ? (
          <Icon className="btn-icon" />
        ) : (
          <>
            {StartIcon && <StartIcon className="btn-icon" />}
            {children != null && children}
            {EndIcon && <EndIcon className="btn-icon" />}
          </>
        )}
      </button>
    );
  },
);
