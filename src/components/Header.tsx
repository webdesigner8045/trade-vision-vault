import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, TrendingUp, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onNewReplay?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewReplay }) => {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Replay Locker</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <>
              <div className="flex items-center space-x-2 text-gray-300">
                <User className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
              <Button className="bg-green-600 hover:bg-green-700" onClick={onNewReplay}>
                <FileText className="w-4 h-4 mr-2" />
                New Replay
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
