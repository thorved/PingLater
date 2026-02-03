'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { 
  ArrowLeft, 
  Plus, 
  Webhook, 
  Edit, 
  Trash2, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Activity,
  Send,
  Check,
  Loader2,
  AlertCircle,
  BarChart3,
  History
} from 'lucide-react';

interface Webhook {
  id: number;
  url: string;
  description: string;
  is_active: boolean;
  event_types: string[];
  created_at: string;
  updated_at: string;
}

interface WebhookEvent {
  type: string;
  description: string;
}

interface WebhookDelivery {
  id: number;
  event_type: string;
  success: boolean;
  response_status: number;
  error_message: string;
  retry_count: number;
  created_at: string;
}

interface WebhookStats {
  total_deliveries: number;
  successful: number;
  failed: number;
  success_rate: string;
  last_delivery_at: string;
  last_delivery_status: boolean;
}

export default function WebhooksPage() {
  const { token, username, logout, isLoading } = useAuth();
  const router = useRouter();
  
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [availableEvents, setAvailableEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    url: '',
    secret: '',
    description: '',
    event_types: ['message_received'],
    is_active: true,
  });
  
  // Testing state
  const [testingWebhook, setTestingWebhook] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  // Stats and deliveries
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  const fetchWebhooks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getWebhooks(token);
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  }, [token]);

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getWebhookEvents(token);
      setAvailableEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  }, [token]);

  const fetchStats = useCallback(async (webhookId: number) => {
    if (!token) return;
    try {
      const data = await api.getWebhookStats(token, webhookId);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [token]);

  const fetchDeliveries = useCallback(async (webhookId: number) => {
    if (!token) return;
    try {
      const data = await api.getWebhookDeliveries(token, webhookId, { limit: 50 });
      setDeliveries(data.deliveries || []);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/');
      return;
    }
    if (token) {
      Promise.all([fetchWebhooks(), fetchEvents()]).then(() => setLoading(false));
    }
  }, [token, isLoading, fetchWebhooks, fetchEvents, router]);

  useEffect(() => {
    if (selectedWebhook) {
      fetchStats(selectedWebhook.id);
      fetchDeliveries(selectedWebhook.id);
    }
  }, [selectedWebhook, fetchStats, fetchDeliveries]);

  const resetForm = () => {
    setFormData({
      url: '',
      secret: '',
      description: '',
      event_types: ['message_received'],
      is_active: true,
    });
    setIsEditing(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (webhook: Webhook) => {
    setFormData({
      url: webhook.url,
      secret: '',
      description: webhook.description,
      event_types: webhook.event_types,
      is_active: webhook.is_active,
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!token) return;
    
    try {
      if (isEditing && selectedWebhook) {
        await api.updateWebhook(token, selectedWebhook.id, formData);
      } else {
        await api.createWebhook(token, formData);
      }
      setIsDialogOpen(false);
      resetForm();
      fetchWebhooks();
      if (selectedWebhook) {
        fetchStats(selectedWebhook.id);
      }
    } catch (error) {
      console.error('Failed to save webhook:', error);
      alert('Failed to save webhook. Please check your input and try again.');
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete the webhook "${webhook.description || webhook.url}"?`)) {
      return;
    }
    
    try {
      await api.deleteWebhook(token, webhook.id);
      fetchWebhooks();
      if (selectedWebhook?.id === webhook.id) {
        setSelectedWebhook(null);
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook.');
    }
  };

  const handleTest = async (webhook: Webhook) => {
    if (!token) return;
    setTestingWebhook(webhook.id);
    setTestResult(null);
    
    try {
      const result = await api.testWebhook(token, webhook.id);
      setTestResult(result.delivery);
      fetchStats(webhook.id);
      fetchDeliveries(webhook.id);
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Failed to test webhook.');
    } finally {
      setTestingWebhook(null);
    }
  };

  const toggleEventType = (eventType: string) => {
    setFormData(prev => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter(et => et !== eventType)
        : [...prev.event_types, eventType]
    }));
  };

  if (isLoading || loading) {
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
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center">
                <Webhook className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">Webhooks</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => router.push('/settings/api-tokens')}
              >
                API Tokens
              </Button>
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-destructive hover:text-destructive"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webhook List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Webhooks</CardTitle>
                  <CardDescription>
                    {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {webhooks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No webhooks configured</p>
                      <p className="text-xs">Click Add to create your first webhook</p>
                    </div>
                  ) : (
                    webhooks.map(webhook => (
                      <div
                        key={webhook.id}
                        onClick={() => setSelectedWebhook(webhook)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedWebhook?.id === webhook.id
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {webhook.description || webhook.url}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {webhook.url}
                            </p>
                          </div>
                          <Badge 
                            variant={webhook.is_active ? "default" : "secondary"}
                            className="ml-2 shrink-0"
                          >
                            {webhook.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {webhook.event_types.slice(0, 3).map(et => (
                            <Badge key={et} variant="outline" className="text-xs">
                              {et}
                            </Badge>
                          ))}
                          {webhook.event_types.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{webhook.event_types.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Webhook Details */}
          <div className="lg:col-span-2">
            {selectedWebhook ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Webhook className="h-5 w-5" />
                        {selectedWebhook.description || 'Webhook Details'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selectedWebhook.url}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(selectedWebhook)}
                        disabled={testingWebhook === selectedWebhook.id}
                      >
                        {testingWebhook === selectedWebhook.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="ml-2">Test</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(selectedWebhook)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(selectedWebhook)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="details">
                        <Activity className="h-4 w-4 mr-2" />
                        Details
                      </TabsTrigger>
                      <TabsTrigger value="stats">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Statistics
                      </TabsTrigger>
                      <TabsTrigger value="history">
                        <History className="h-4 w-4 mr-2" />
                        History
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedWebhook.is_active ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span>Inactive</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Created</Label>
                          <p className="mt-1">
                            {new Date(selectedWebhook.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <Label className="text-muted-foreground">Event Types</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedWebhook.event_types.map(et => (
                            <Badge key={et} variant="secondary">
                              {et}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {testResult && (
                        <>
                          <Separator />
                          <div className="p-4 rounded-lg bg-muted">
                            <h4 className="font-medium mb-2">Test Result</h4>
                            <div className="flex items-center gap-2">
                              {testResult.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span>{testResult.success ? 'Success' : 'Failed'}</span>
                              <Badge variant="outline">HTTP {testResult.response_status}</Badge>
                            </div>
                            {testResult.error_message && (
                              <p className="text-sm text-destructive mt-2">
                                {testResult.error_message}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="stats" className="space-y-4 mt-4">
                      {stats ? (
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="pt-6">
                              <div className="text-2xl font-bold">{stats.total_deliveries}</div>
                              <p className="text-sm text-muted-foreground">Total Deliveries</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-6">
                              <div className="text-2xl font-bold text-green-600">{stats.success_rate}</div>
                              <p className="text-sm text-muted-foreground">Success Rate</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-6">
                              <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                              <p className="text-sm text-muted-foreground">Successful</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="pt-6">
                              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                              <p className="text-sm text-muted-foreground">Failed</p>
                            </CardContent>
                          </Card>
                          <Card className="col-span-2">
                            <CardContent className="pt-6">
                              <Label className="text-muted-foreground">Last Delivery</Label>
                              <p className="mt-1">
                                {stats.last_delivery_at 
                                  ? new Date(stats.last_delivery_at).toLocaleString()
                                  : 'Never'
                                }
                                {stats.last_delivery_at && (
                                  <Badge 
                                    variant={stats.last_delivery_status ? "default" : "destructive"}
                                    className="ml-2"
                                  >
                                    {stats.last_delivery_status ? 'Success' : 'Failed'}
                                  </Badge>
                                )}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No statistics available yet</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Response</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deliveries.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                  No delivery history yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              deliveries.map(delivery => (
                                <TableRow key={delivery.id}>
                                  <TableCell>
                                    <Badge variant="outline">{delivery.event_type}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {delivery.success ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-sm">Success</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <XCircle className="h-4 w-4" />
                                        <span className="text-sm">Failed</span>
                                        {delivery.retry_count > 0 && (
                                          <Badge variant="secondary" className="ml-1 text-xs">
                                            {delivery.retry_count} retries
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {delivery.response_status > 0 ? (
                                      <Badge variant={delivery.response_status >= 200 && delivery.response_status < 300 ? "default" : "destructive"}>
                                        {delivery.response_status}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {new Date(delivery.created_at).toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[500px]">
                <div className="text-center text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Webhook Selected</h3>
                  <p className="text-sm">Select a webhook from the list to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your webhook configuration' 
                : 'Configure a new webhook to receive events'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">Webhook URL *</Label>
              <Input
                id="url"
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="secret">Secret (Optional)</Label>
              <Input
                id="secret"
                type="password"
                placeholder="For HMAC signature verification"
                value={formData.secret}
                onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Used to sign webhook payloads with HMAC-SHA256
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="My webhook endpoint"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Event Types *</Label>
              <div className="space-y-2">
                {availableEvents.map(event => (
                  <div key={event.type} className="flex items-start space-x-2">
                    <Checkbox
                      id={event.type}
                      checked={formData.event_types.includes(event.type)}
                      onCheckedChange={() => toggleEventType(event.type)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={event.type}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {event.type}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_active: checked as boolean }))
                }
              />
              <label
                htmlFor="is_active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Active
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.url || formData.event_types.length === 0}
            >
              {isEditing ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
