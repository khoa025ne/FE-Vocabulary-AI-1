import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ViMascotImage } from './ViMascotImage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="errcard glass">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <ViMascotImage pose="surprised" size={88} alt="Vi ngạc nhiên khi gặp sự cố" />
            </div>
            <h1>Đã có lỗi xảy ra</h1>
            <p className="sub" style={{ marginTop: '10px', lineHeight: 1.65 }}>
              Rất tiếc, đã có sự cố ngoài ý muốn khi tải nội dung này. Dữ liệu học của bạn vẫn an toàn — bạn thử lại hoặc quay về trang chính nhé.
            </p>
            {this.state.error && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: 'var(--danger-bg)',
                  borderRadius: '12px',
                  color: 'var(--red-dark)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  overflowX: 'auto',
                }}
              >
                {this.state.error.message}
              </div>
            )}
            <div className="row" style={{ marginTop: '20px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Về trang chính
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
