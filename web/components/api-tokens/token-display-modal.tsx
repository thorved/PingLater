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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, AlertTriangle } from 'lucide-react';

interface TokenDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  name: string;
}

export function TokenDisplayModal({
  isOpen,
  onClose,
  token,
  name,
}: TokenDisplayModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>API Token Created</DialogTitle>
          <DialogDescription>
            Your API token for "{name}" has been created successfully.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-semibold">
              This is the only time you will see this token. Copy it now!
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your API Token</label>
            <div className="flex gap-2">
              <Input
                value={token}
                readOnly
                type="text"
                className="font-mono text-sm min-w-0"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-md text-sm space-y-2">
            <p className="font-medium">Usage Example:</p>
            <code className="block bg-background p-2 rounded text-xs font-mono break-all whitespace-pre-wrap">
{`curl -X POST http://localhost:8080/api/whatsapp/send \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone_number":"1234567890","message":"Hello"}'`}
            </code>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            I&apos;ve copied the token
          </Button>
          <Button onClick={handleCopy} variant={copied ? 'outline' : 'default'}>
            {copied ? 'Copied!' : 'Copy Token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
