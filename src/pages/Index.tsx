
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/components/AuthPage';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import Timeline from '@/components/Timeline';
import TradeReplayForm from '@/components/TradeReplayForm';

const Index = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'timeline' | 'form'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNewReplay={() => setCurrentView('form')} />;
      case 'timeline':
        return <Timeline />;
      case 'form':
        return <TradeReplayForm onTradeCreated={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard onNewReplay={() => setCurrentView('form')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header onNewReplay={() => setCurrentView('form')} />
      
      {/* Navigation */}
      <div className="border-b border-gray-700 bg-gray-900/50">
        <div className="px-6 py-3">
          <nav className="flex space-x-6">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('timeline')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'timeline'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setCurrentView('form')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'form'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              New Replay
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
