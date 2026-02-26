import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { LoginPage } from './LoginPage';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
}));

describe('LoginPage', () => {
    let mockLogin: Mock;
    let mockClearAuthExpiredMessage: Mock;
    let mockNavigate: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLogin = vi.fn().mockResolvedValue(undefined);
        mockClearAuthExpiredMessage = vi.fn();
        mockNavigate = vi.fn();

        (useAuth as Mock).mockReturnValue({
            login: mockLogin,
            isAuthenticated: false,
            authExpiredMessage: null,
            clearAuthExpiredMessage: mockClearAuthExpiredMessage,
        });

        (useNavigate as Mock).mockReturnValue(mockNavigate);
    });

    describe('前端元素', () => {
        it('渲染登入頁面基本元素', () => {
            render(<LoginPage />);
            expect(screen.getByRole('heading', { name: '歡迎回來' })).toBeInTheDocument();
            expect(screen.getByLabelText('電子郵件')).toBeInTheDocument();
            expect(screen.getByLabelText('密碼')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '登入' })).toBeInTheDocument();
        });

        it('非同步登入過程中的 Loading 狀態', async () => {
            let resolveLogin!: () => void;
            mockLogin.mockImplementation(
                () => new Promise<void>((resolve) => {
                    resolveLogin = resolve;
                })
            );

            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'Password123');

            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByRole('button', { name: /登入中\.\.\./ })).toBeDisabled();
            expect(screen.getByLabelText('電子郵件')).toBeDisabled();
            expect(screen.getByLabelText('密碼')).toBeDisabled();

            resolveLogin();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: '登入' })).not.toBeDisabled();
            });
        });
    });

    describe('表單驗證', () => {
        it('Email 格式錯誤時顯示錯誤訊息', async () => {
            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'invalid-email');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('請輸入有效的 Email 格式')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('密碼長度不足時顯示錯誤訊息', async () => {
            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), '1234567');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須至少 8 個字元')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('密碼未包含英數混合時顯示錯誤訊息', async () => {
            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), '12345678');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須包含英文字母和數字')).toBeInTheDocument();

            await user.clear(screen.getByLabelText('密碼'));
            await user.type(screen.getByLabelText('密碼'), 'abcdefgh');
            await user.click(screen.getByRole('button', { name: '登入' }));

            expect(screen.getByText('密碼必須包含英文字母和數字')).toBeInTheDocument();
            expect(mockLogin).not.toHaveBeenCalled();
        });
    });

    describe('Mock API', () => {
        it('登入成功後導向至儀表板', async () => {
            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'Password123');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Password123');
                expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
            });
        });

        it('登入失敗時顯示 API 錯誤訊息', async () => {
            mockLogin.mockRejectedValue({
                response: { data: { message: '帳號或密碼錯誤' } }
            });

            render(<LoginPage />);
            const user = userEvent.setup();

            await user.type(screen.getByLabelText('電子郵件'), 'test@example.com');
            await user.type(screen.getByLabelText('密碼'), 'Password123');
            await user.click(screen.getByRole('button', { name: '登入' }));

            await waitFor(() => {
                expect(screen.getByText('帳號或密碼錯誤')).toBeInTheDocument();
            });
        });
    });

    describe('驗證權限', () => {
        it('已登入狀態下訪問登入頁應立即導向', () => {
            (useAuth as Mock).mockReturnValue({
                isAuthenticated: true,
                authExpiredMessage: null,
                clearAuthExpiredMessage: mockClearAuthExpiredMessage,
                login: mockLogin,
            });

            render(<LoginPage />);
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        });
    });

    describe('邏輯驗證', () => {
        it('收到登入過期訊息時顯示提示並清除', () => {
            (useAuth as Mock).mockReturnValue({
                isAuthenticated: false,
                authExpiredMessage: '登入已過期，請重新登入',
                clearAuthExpiredMessage: mockClearAuthExpiredMessage,
                login: mockLogin,
            });

            render(<LoginPage />);
            expect(screen.getByText('登入已過期，請重新登入')).toBeInTheDocument();
            expect(mockClearAuthExpiredMessage).toHaveBeenCalled();
        });
    });
});
