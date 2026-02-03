'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LogOut, 
  MessageCircle, 
  User, 
  Link, 
  Unlink, 
  Loader2, 
  QrCode,
  Clock,
  Smartphone,
  Send,
  Activity,
  TrendingUp,
  Wifi,
  WifiOff,
  MessageSquare,
  Download,
  Trash2
} from 'lucide-react';

type Event = {
  type: string;
  message: string;
  details?: string;
  timestamp: string;
};

type Metrics = {
  connected: boolean;
  phone_number: string;
  last_connected_at: string;
  total_messages_sent: number;
  total_messages_received: number;
  connection_uptime_seconds: number;
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'connected':
      return <Wifi className="h-4 w-4 text-green-500" />;
    case 'disconnected':
      return <WifiOff className="h-4 w-4 text-red-500" />;
    case 'message_sent':
      return <Send className="h-4 w-4 text-blue-500" />;
    case 'message_received':
      return <Download className="h-4 w-4 text-purple-500" />;
    case 'qr_generated':
      return <QrCode className="h-4 w-4 text-orange-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
};

export default function Dashboard() {
  const { token, username, logout, isLoading } = useAuth();
  const router = useRouter();
  const [waStatus, setWaStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<number>(30);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  
  // Events and metrics
  const [events, setEvents] = useState<Event[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  
  // Message sending
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Define callbacks first (before the useEffect that uses them)
  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const status = await api.getWhatsAppStatus(token);
      setWaStatus(status);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, [token]);

  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getMetrics(token);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [token]);

  const subscribeToEvents = useCallback(() => {
    if (!token) return null;
    
    const es = api.subscribeToEvents(
      token,
      (event) => {
        const newEvent: Event = {
          type: event.type,
          message: event.data.message || event.data,
          details: event.data.details,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [...prev.slice(-49), newEvent]); // Keep last 50 events
      },
      (error) => {
        console.error('Event subscription error:', error);
      }
    );
    
    return es;
  }, [token]);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/');
      return;
    }
    if (token) {
      fetchStatus();
      fetchMetrics();
      
      // Subscribe to events
      const eventsES = subscribeToEvents();
      
      // Periodic metrics refresh
      const metricsInterval = setInterval(fetchMetrics, 5000);
      
      return () => {
        eventsES?.close();
        clearInterval(metricsInterval);
      };
    }
  }, [token, isLoading, fetchStatus, fetchMetrics, subscribeToEvents]);

  // Auto-scroll events to bottom
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const sendMessage = async () => {
    if (!token || !phoneNumber || !messageText) return;
    setSendingMessage(true);
    try {
      await api.sendMessage(token, phoneNumber, messageText);
      setMessageText('');
      fetchMetrics();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!token) return;
    setLoading(true);
    setCountdown(30);
    try {
      await api.connectWhatsApp(token);
      startQRStream();
    } catch (error) {
      console.error('Failed to connect:', error);
      setLoading(false);
    }
  };

  const startQRStream = useCallback(() => {
    if (!token) return;
    
    // Close existing connection if any
    if (eventSource) {
      eventSource.close();
    }
    
    // Reset countdown
    setCountdown(30);
    
    // Listen for QR code via SSE with token in query param
    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL || '/'}/api/whatsapp/qr?token=${token}`,
      { withCredentials: false }
    );
    setEventSource(es);
    
    es.addEventListener('qr', (event: MessageEvent) => {
      console.log('QR received:', event.data ? 'Yes (length: ' + event.data.length + ')' : 'No');
      setQrCode(event.data);
      setCountdown(30); // Reset countdown when new QR arrives
    });

    es.onerror = (error) => {
      console.log('SSE Error:', error);
      es.close();
      setLoading(false);
      setEventSource(null);
    };
    
    es.onopen = () => {
      console.log('SSE Connection opened');
    };
    
    es.addEventListener('timeout', (event: MessageEvent) => {
      console.log('QR Timeout:', event.data);
      // QR expired, request new one
      setQrCode(null);
      setCountdown(30);
    });
    
    es.addEventListener('error', (event: MessageEvent) => {
      console.log('QR Error:', event.data);
      es.close();
      setLoading(false);
      setEventSource(null);
    });

    // Listen for connection success
    es.addEventListener('connected', (event: MessageEvent) => {
      console.log('WhatsApp connected:', event.data);
      es.close();
      setQrCode(null);
      setLoading(false);
      setEventSource(null);
      fetchStatus();
    });
  }, [token, fetchStatus]);

  // Countdown timer effect
  useEffect(() => {
    if (!qrCode) return;
    
    if (countdown <= 0) {
      // Auto-refresh when countdown reaches 0
      setQrCode(null);
      startQRStream();
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode, countdown, startQRStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const disconnectWhatsApp = async () => {
    if (!token) return;
    try {
      await api.disconnectWhatsApp(token);
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setQrCode(null);
      setCountdown(30);
      fetchStatus();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const clearWhatsAppSession = async () => {
    if (!token) return;
    if (!confirm('This will clear your WhatsApp session and require you to scan the QR code again. Continue?')) {
      return;
    }
    try {
      await api.disconnectWhatsApp(token, true);
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setQrCode(null);
      setCountdown(30);
      setWaStatus(null);
      fetchStatus();
    } catch (error) {
      console.error('Failed to clear session:', error);
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
      {/* Navigation with Connection Status */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">PingLater</h1>
            </div>
            
            {/* Connection Status in NavBar */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full border">
                <div className={`h-2 w-2 rounded-full ${waStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  {waStatus?.connected ? 'Connected' : 'Disconnected'}
                </span>
                {waStatus?.phone_number && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({waStatus.phone_number})
                  </span>
                )}
              </div>
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
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.total_messages_sent || 0}</div>
                <p className="text-xs text-muted-foreground">Total messages sent</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Received</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.total_messages_received || 0}</div>
                <p className="text-xs text-muted-foreground">Total messages received</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connection Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics?.connection_uptime_seconds || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.last_connected_at 
                    ? `Last: ${new Date(metrics.last_connected_at).toLocaleTimeString()}`
                    : 'Not connected yet'
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - WhatsApp Settings & QR */}
            <div className="lg:col-span-2 space-y-6">
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
                        <>
                          <Button 
                            onClick={disconnectWhatsApp} 
                            variant="destructive"
                            className="gap-2"
                          >
                            <Unlink className="h-4 w-4" />
                            Disconnect
                          </Button>
                          <Button 
                            onClick={clearWhatsAppSession} 
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            title="Clear session and force re-registration"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear
                          </Button>
                        </>
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
                        <div className="flex flex-col items-center gap-2">
                          <Badge 
                            variant={countdown <= 10 ? "destructive" : "secondary"} 
                            className="gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            Expires in {countdown} seconds
                          </Badge>
                          {countdown <= 10 && countdown > 0 && (
                            <p className="text-xs text-destructive">
                              QR code will refresh automatically
                            </p>
                          )}
                          {countdown === 0 && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Refreshing QR code...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Send Message */}
              {waStatus?.connected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Send Message
                    </CardTitle>
                    <CardDescription>
                      Send a WhatsApp message to any contact
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Phone Number</Label>
                      <Input
                        id="recipient"
                        placeholder="e.g., 1234567890 (with country code)"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Input
                        id="message"
                        placeholder="Type your message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                    </div>
                    <Button 
                      onClick={sendMessage}
                      disabled={sendingMessage || !phoneNumber || !messageText}
                      className="w-full gap-2"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Message
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Events Feed */}
            <div className="lg:col-span-1">
              <Card className="h-[600px] flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Events
                  </CardTitle>
                  <CardDescription>
                    Real-time activity feed
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <ScrollArea className="h-[500px] px-4">
                    <div className="space-y-3 pr-4">
                      {events.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No events yet</p>
                          <p className="text-xs">Events will appear here when activity occurs</p>
                        </div>
                      ) : (
                        events.map((event, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted transition-colors"
                          >
                            <div className="mt-0.5">
                              {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{event.message}</p>
                              {event.details && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {event.details}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={eventsEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
