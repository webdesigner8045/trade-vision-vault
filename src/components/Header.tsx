
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, TrendingUp } from 'lucide-react';

const Header = () => {
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
          
          <nav className="flex items-center space-x-6">
            <Button variant="ghost" className="text-gray-300 hover:text-white">
              Dashboard
            </Button>
            <Button variant="ghost" className="text-gray-300 hover:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Timeline
            </Button>
            <Button variant="ghost" className="text-gray-300 hover:text-white">
              Analytics
            </Button>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <Button className="bg-green-600 hover:bg-green-700">
            <FileText className="w-4 h-4 mr-2" />
            New Replay
          </Button>
          <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
            Settings
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
