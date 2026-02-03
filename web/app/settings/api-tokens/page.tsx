'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertCircle } from 'lucide-react';
import { TokenList } from '@/components/api-tokens/token-list';
import { CreateTokenModal } from '@/components/api-tokens/create-token-modal';
import { TokenDisplayModal } from '@/components/api-tokens/token-display-modal';

interface APIToken {
  id: number;
  name: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export default function APITokensPage() {
  const { token } = useAuth();
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);

  const fetchTokens = async () => {
    if (!token) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getAPITokens(token);
      setTokens(data.tokens || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScopes = async () => {
    if (!token) return;
    
    try {
      const data = await api.getAvailableScopes(token);
      setAvailableScopes(data.scopes || []);
    } catch (err) {
      console.error('Failed to fetch scopes:', err);
    }
  };

  useEffect(() => {
    fetchTokens();
    fetchScopes();
  }, [token]);

  const handleCreateToken = async (name: string, scopes: string[], expiresAt: string | null) => {
    if (!token) return;

    try {
      const data = await api.createAPIToken(token, {
        name,
        scopes,
        expires_at: expiresAt,
      });
      
      setNewToken({ token: data.token, name: data.name });
      setIsCreateModalOpen(false);
      fetchTokens();
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteToken = async (id: number) => {
    if (!token) return;

    try {
      await api.deleteAPIToken(token, id);
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete token');
    }
  };

  const handleRotateToken = async (id: number) => {
    if (!token) return;

    try {
      const data = await api.rotateAPIToken(token, id);
      setNewToken({ token: data.token, name: data.name });
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate token');
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    if (!token) return;

    try {
      await api.updateAPIToken(token, id, { is_active: isActive });
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update token');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Tokens</h1>
          <p className="text-muted-foreground mt-1">
            Manage API tokens for external integrations
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Token
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your API Tokens</CardTitle>
          <CardDescription>
            API tokens allow external applications to access your PingLater account programmatically.
            Keep your tokens secure and never share them publicly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-muted rounded w-full" />
                <div className="h-16 bg-muted rounded w-full" />
                <div className="h-16 bg-muted rounded w-full" />
              </div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-2">No API tokens yet</p>
              <p className="text-sm">Create your first token to start using the API</p>
            </div>
          ) : (
            <TokenList
              tokens={tokens}
              onDelete={handleDeleteToken}
              onRotate={handleRotateToken}
              onToggleActive={handleToggleActive}
            />
          )}
        </CardContent>
      </Card>

      <CreateTokenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateToken}
        availableScopes={availableScopes}
      />

      <TokenDisplayModal
        isOpen={!!newToken}
        onClose={() => setNewToken(null)}
        token={newToken?.token || ''}
        name={newToken?.name || ''}
      />
    </div>
  );
}
