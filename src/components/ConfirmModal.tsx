import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from './icons';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  itemName?: string;
  description?: React.ReactNode;
  warningText?: string;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'alert';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Xác nhận xóa',
  itemName,
  description,
  warningText = 'Hành động này không thể hoàn tác. Dữ liệu sau khi xóa sẽ không thể phục hồi.',
  confirmText = 'Xác nhận xóa',
  cancelText = 'Hủy bỏ',
  loadingText = 'Đang xử lý...',
  variant = 'danger',
  icon = 'trash',
  isLoading = false,
}) => {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const isDanger = variant === 'danger';
  const themeColor = isDanger ? '#DC2626' : variant === 'warning' ? '#D97706' : '#2563EB';
  const badgeBg = isDanger ? '#FEE2E2' : variant === 'warning' ? '#FEF3C7' : '#EFF6FF';
  const warnBg = isDanger ? '#FEF2F2' : variant === 'warning' ? '#FFFBEB' : '#F0F9FF';
  const warnBorder = isDanger ? '#FECDD3' : variant === 'warning' ? '#FDE68A' : '#BAE6FD';
  const warnText = isDanger ? '#991B1B' : variant === 'warning' ? '#92400E' : '#0369A1';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) {
              onClose();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              width: '100%',
              maxWidth: 440,
              padding: '24px 24px 20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #F1F5F9',
              textAlign: 'center',
            }}
          >
            {/* Icon Badge */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: badgeBg,
                color: themeColor,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Icon n={icon} s={28} />
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#0F172A',
                margin: '0 0 8px',
              }}
            >
              {title}
            </h3>

            {/* Description */}
            <div
              style={{
                fontSize: 13.5,
                color: '#475569',
                lineHeight: 1.5,
                margin: '0 0 16px',
              }}
            >
              {description ? (
                description
              ) : itemName ? (
                <p style={{ margin: 0 }}>
                  Bạn có chắc chắn muốn xóa{' '}
                  <b style={{ color: '#0F172A', wordBreak: 'break-all' }}>
                    "{itemName}"
                  </b>{' '}
                  không?
                </p>
              ) : (
                <p style={{ margin: 0 }}>Bạn có chắc chắn muốn thực hiện hành động này không?</p>
              )}
            </div>

            {/* Warning Callout */}
            {warningText && (
              <div
                style={{
                  background: warnBg,
                  border: `1px solid ${warnBorder}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: warnText,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  marginBottom: 20,
                }}
              >
                <div style={{ flexShrink: 0, color: themeColor }}>
                  <Icon n="alert" s={18} />
                </div>
                <div>{warningText}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={onClose}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: '#475569',
                  borderColor: '#CBD5E1',
                }}
              >
                {cancelText}
              </button>
              <button
                type="button"
                className="btn"
                onClick={onConfirm}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 13.5,
                  color: '#FFFFFF',
                  background: themeColor,
                  border: 'none',
                  cursor: isLoading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: isDanger ? '0 4px 12px rgba(220, 38, 38, 0.25)' : 'none',
                }}
              >
                {isLoading ? (
                  <>
                    <div
                      className="spinner"
                      style={{
                        width: 14,
                        height: 14,
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        borderTopColor: 'transparent',
                      }}
                    />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <>
                    <Icon n={icon} s={16} />
                    <span>{confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
export default ConfirmModal;

