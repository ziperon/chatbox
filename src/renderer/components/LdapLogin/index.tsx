import React, { useState, useCallback } from 'react';
import styled from 'styled-components';

export interface LdapLoginProps {
    onAuthenticate: (username: string, password: string) => Promise<boolean | string>;
    initialUsername?: string;
}

const Container = styled.div`
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
  padding: 0;
`;

const Form = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 24px;
`;

const Title = styled.h1`
  font-size: 20px;
  margin: 0 0 16px;
  color: #e2e8f0;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  color: #94a3b8;
  margin-top: 16px;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #0b1220;
  color: #e2e8f0;
  font-size: 14px;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 12px;
  margin-top: 24px;
  border-radius: 8px;
  border: none;
  background: #2563eb;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #1d4ed8;
  }
  
  &:disabled {
    background: #1e3a8a;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const Error = styled.div`
  color: #f87171;
  font-size: 14px;
  margin-top: 12px;
  min-height: 20px;
`;

const Hint = styled.div`
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.4;
`;

export const LdapLogin: React.FC<LdapLoginProps> = ({ onAuthenticate, initialUsername = '' }) => {
    const [username, setUsername] = useState(initialUsername);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password || isLoading) return;

        // Allow admin/admin in development mode
        const isDev = process.env.NODE_ENV === 'development';
        console.log('Development mode:', isDev);
        if (isDev && username === 'admin' && password === 'admin') {
            console.log('Development mode: Using admin credentials');
            const result = await onAuthenticate(username, password);
            if (result !== true) {
                setError('Failed to authenticate with admin credentials');
            }
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const result = await onAuthenticate(username, password);
            if (result !== true) {
                setError(typeof result === 'string' ? result : 'Authentication failed');
            }
        } catch (err: unknown) {
            const error = err as Error;
            setError(error?.message || 'An error occurred during authentication');
        } finally {
            setIsLoading(false);
            setPassword('');
        }
    }, [username, password, isLoading, onAuthenticate]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const event = new Event('submit', { cancelable: true }) as unknown as React.FormEvent;
            handleSubmit(event);
        }
    };

    return (
        <Container>
            <Form>
                <Title>LDAP Sign In</Title>
                <Hint>Use  credentials. Format: user@corp.vtbcapital.internal or CORP\user</Hint>

                <form onSubmit={handleSubmit}>
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                        autoComplete="username"
                        disabled={isLoading}
                    />

                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="current-password"
                        disabled={isLoading}
                    />

                    <Button
                        type="submit"
                        disabled={!username || !password || isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>

                    {error && <Error>{error}</Error>}
                </form>
            </Form>
        </Container>
    );
};

export default LdapLogin;
