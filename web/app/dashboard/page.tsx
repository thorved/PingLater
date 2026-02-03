'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { 
  LogOut, 
  MessageCircle, 
  User, 
  Link, 
  Unlink, 
  Loader2, 
  QrCode,
  Clock,
  Smartphone
} from 'lucide-react';

export default function Dashboard() {
  const { token, username, logout, isLoading } = useAuth();
  const router = useRouter();
  const [waStatus, setWaStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/');
      return;
    }
    if (token) {
      fetchStatus();
    }
  }, [token, isLoading]);

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const status = await api.getWhatsAppStatus(token);
      setWaStatus(status);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const connectWhatsApp = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await api.connectWhatsApp(token);
      // Listen for QR code via SSE with token in query param
      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/whatsapp/qr?token=${token}`,
        { withCredentials: false }
      );
      
      eventSource.addEventListener('qr', (event) => {
        setQrCode(event.data);
      });

      eventSource.onerror = () => {
        eventSource.close();
        setLoading(false);
      };

      // Close after 60 seconds
      setTimeout(() => {
        eventSource.close();
        setLoading(false);
        fetchStatus();
      }, 60000);
    } catch (error) {
      console.error('Failed to connect:', error);
      setLoading(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!token) return;
    try {
      await api.disconnectWhatsApp(token);
      setQrCode(null);
      fetchStatus();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">PingLater</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Welcome, {username}</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={waStatus?.connected ? "default" : "destructive"}>
                    {waStatus?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                {waStatus?.phone_number && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {waStatus.phone_number}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">QR Code Status</CardTitle>
                <QrCode className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={qrCode ? "secondary" : "outline"}>
                    {qrCode ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Session</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{username}</div>
                <p className="text-xs text-muted-foreground">Logged in</p>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                WhatsApp Settings
              </CardTitle>
              <CardDescription>
                Manage your WhatsApp connection and authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${waStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="font-medium">Connection Status</p>
                    <p className="text-sm text-muted-foreground">
                      {waStatus?.connected 
                        ? `Connected to ${waStatus.phone_number}` 
                        : 'Not connected to WhatsApp'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!waStatus?.connected ? (
                    <Button 
                      onClick={connectWhatsApp} 
                      disabled={loading}
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link className="h-4 w-4" />
                      )}
                      {loading ? 'Connecting...' : 'Connect'}
                    </Button>
                  ) : (
                    <Button 
                      onClick={disconnectWhatsApp} 
                      variant="destructive"
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>

              {/* QR Code Display */}
              {qrCode && !waStatus?.connected && (
                <>
                  <Separator />
                  <div className="flex flex-col items-center space-y-4 py-4">
                    <div className="text-center space-y-2">
                      <p className="font-medium">Scan this QR code with WhatsApp</p>
                      <p className="text-sm text-muted-foreground">
                        Open WhatsApp on your phone and scan the code below
                      </p>
                    </div>
                    <div className="p-6 bg-white rounded-xl border shadow-sm">
                      <QRCodeSVG value={qrCode} size={256} />
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Expires in 60 seconds
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
