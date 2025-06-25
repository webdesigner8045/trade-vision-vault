
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, TrendingUp, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onNewReplay?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewReplay }) => {
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <User className="w-4 h-4" />
              <span className="text-sm">{user.email}</span>
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
              <div className="absolute right-4 top-16 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 z-50 animate-fade-in">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={handleNewReplay}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-3" />
                    New Replay
                  </button>
                  
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center px-4 py-3 text-left text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <User className="w-4 h-4 mr-3" />
                    Account Info
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
