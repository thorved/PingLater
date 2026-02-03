'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';

interface CreateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, scopes: string[], expiresAt: string | null) => Promise<void>;
  availableScopes: string[];
}

export function CreateTokenModal({
  isOpen,
  onClose,
  onCreate,
  availableScopes,
}: CreateTokenModalProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setSelectedScopes([]);
    setExpiresAt('');
    setError(null);
    onClose();
  };

  const handleScopeToggle = (scope: string) => {
    setSelectedScopes((prev) => {
      if (scope === 'all') {
        // If 'all' is selected, only select 'all'
        return prev.includes('all') ? [] : ['all'];
      }
      
      // If selecting a specific scope and 'all' is already selected, unselect 'all'
      if (prev.includes('all')) {
        return [scope];
      }
      
      if (prev.includes(scope)) {
        return prev.filter((s) => s !== scope);
      }
      return [...prev, scope];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Token name is required');
      return;
    }
    
    if (selectedScopes.length === 0) {
      setError('At least one scope is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const expirationDate = expiresAt ? new Date(expiresAt).toISOString() : null;
      await onCreate(name.trim(), selectedScopes, expirationDate);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setIsLoading(false);
    }
  };

  const getScopeDescription = (scope: string) => {
    switch (scope) {
      case 'all':
        return 'Full access to all API endpoints';
      case 'messages:send':
        return 'Send WhatsApp messages';
      case 'messages:read':
        return 'Read message history';
      case 'metrics:read':
        return 'Access dashboard metrics';
      case 'status:read':
        return 'Check WhatsApp connection status';
      default:
        return scope;
    }
  };

  const getScopeBadgeColor = (scope: string) => {
    if (scope === 'all') return 'bg-red-500';
    if (scope.startsWith('messages:')) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create API Token</DialogTitle>
          <DialogDescription>
            Create a new API token for external integrations. The token will be shown only once.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Token Name</Label>
            <Input
              id="name"
              placeholder="e.g., Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {availableScopes.map((scope) => (
                <div key={scope} className="flex items-start space-x-3">
                  <Checkbox
                    id={scope}
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={() => handleScopeToggle(scope)}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={scope}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Badge className={`${getScopeBadgeColor(scope)} text-white text-xs`}>
                        {scope}
                      </Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getScopeDescription(scope)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expiration Date (Optional)</Label>
            <Input
              id="expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiration
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The raw token will be shown only once after creation. Make sure to copy it immediately.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
