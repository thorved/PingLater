'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme-toggle';
import { 
  LogOut, 
  MessageCircle, 
  User,
  ArrowLeft,
  Settings
} from 'lucide-react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { username, logout } = useAuth();
  const router = useRouter();

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
                <Settings className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{username}</span>
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
        {children}
      </main>
    </div>
  );
}
