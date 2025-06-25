
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, TrendingUp, LogOut, User, Menu, X, Settings, Download, Upload, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
  onNewReplay?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewReplay }) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = () => {
    signOut();
    setIsMobileMenuOpen(false);
  };

  const handleNewReplay = () => {
    onNewReplay?.();
    setIsMobileMenuOpen(false);
  };

  const handleDownloadExtension = () => {
    window.open('https://chrome.google.com/webstore/detail/replay-locker', '_blank');
    setIsMobileMenuOpen(false);
    toast({
      title: "Extension Download",
      description: "Opening Chrome Web Store..."
    });
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        toast({
          title: "Import Started",
          description: `Importing ${file.name}...`
        });
        // Add actual import logic here
      }
    };
    input.click();
    setIsMobileMenuOpen(false);
  };

  const handleExportData = () => {
    try {
      // Create mock export data
      const exportData = {
        trades: [],
        exported_at: new Date().toISOString(),
        version: "1.0"
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `replay-locker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Your trade data has been exported successfully."
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export trade data. Please try again.",
        variant: "destructive"
      });
    }
    setIsMobileMenuOpen(false);
  };

  const handleSettings = () => {
    toast({
      title: "Settings",
      description: "Settings panel opened."
    });
    setIsMobileMenuOpen(false);
  };

  const handleNotifications = () => {
    toast({
      title: "Notifications",
      description: "No new notifications."
    });
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 px-4 sm:px-6 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Replay Locker</span>
        </div>

        {/* Desktop Navigation */}
        {user && (
          <div className="hidden md:flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors relative"
              onClick={handleNotifications}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={handleImportData}
              title="Import Data"
            >
              <Upload className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={handleExportData}
              title="Export Data"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={handleDownloadExtension}
              title="Download Extension"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={handleSettings}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <div className="flex items-center space-x-2 text-gray-300 px-2">
              <User className="w-4 h-4" />
              <span className="text-sm max-w-[120px] truncate">{user.email}</span>
            </div>

            <Button 
              className="bg-green-600 hover:bg-green-700 transition-colors" 
              onClick={onNewReplay}
            >
              <FileText className="w-4 h-4 mr-2" />
              New Replay
            </Button>

            <Button 
              variant="outline" 
              className="border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors" 
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Mobile Menu Button */}
        {user && (
          <div className="md:hidden" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <div className="absolute right-4 top-16 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-700">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium truncate">{user.email}</span>
                  </div>
                </div>

                <div className="py-2">
                  <button
                    onClick={handleNewReplay}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-3" />
                    New Replay
                  </button>

                  <button
                    onClick={handleNotifications}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <Bell className="w-4 h-4 mr-3" />
                    Notifications
                    {notifications > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {notifications}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={handleImportData}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-3" />
                    Import Data
                  </button>

                  <button
                    onClick={handleExportData}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-3" />
                    Export Data
                  </button>

                  <button
                    onClick={handleDownloadExtension}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Download Extension
                  </button>

                  <button
                    onClick={handleSettings}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center px-4 py-3 text-left text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
