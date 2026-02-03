'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Trash2, RefreshCw, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface APIToken {
  id: number;
  name: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface TokenListProps {
  tokens: APIToken[];
  onDelete: (id: number) => void;
  onRotate: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}

export function TokenList({ tokens, onDelete, onRotate, onToggleActive }: TokenListProps) {
  const [tokenToDelete, setTokenToDelete] = useState<number | null>(null);

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return format(new Date(date), 'MMM d, yyyy');
  };

  const formatRelativeDate = (date: string | null) => {
    if (!date) return 'Never';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const getScopeBadgeColor = (scope: string) => {
    if (scope === 'all') return 'bg-red-500 hover:bg-red-600';
    if (scope.startsWith('messages:')) return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-gray-500 hover:bg-gray-600';
  };

  return (
    <>
      <div className="space-y-4">
        {tokens.map((token) => (
          <div
            key={token.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold truncate">{token.name}</h3>
                {!token.is_active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {token.expires_at && new Date(token.expires_at) < new Date() && (
                  <Badge variant="destructive">Expired</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatRelativeDate(token.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Last used {formatRelativeDate(token.last_used_at)}</span>
                </div>
                {token.expires_at && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Expires {formatDate(token.expires_at)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {token.scopes.map((scope) => (
                  <Badge
                    key={scope}
                    variant="secondary"
                    className={`text-xs ${getScopeBadgeColor(scope)} text-white`}
                  >
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Switch
                checked={token.is_active}
                onCheckedChange={(checked) => onToggleActive(token.id, checked)}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRotate(token.id)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rotate Token
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setTokenToDelete(token.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Revoke Token
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!tokenToDelete} onOpenChange={() => setTokenToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API token? This action cannot be undone.
              Any applications using this token will no longer be able to access the API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenToDelete(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (tokenToDelete) {
                  onDelete(tokenToDelete);
                  setTokenToDelete(null);
                }
              }}
              variant="destructive"
            >
              Revoke Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
