
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TradeReplay {
  id: string;
  instrument: string;
  trade_date: string;
  trade_time?: string;
  entry_price: number;
  exit_price: number;
  tag: 'win' | 'mistake' | 'learning';
  notes?: string;
  recording_url?: string;
  chart_url?: string;
  created_at: string;
}

export const useTradeReplays = () => {
  const [trades, setTrades] = useState<TradeReplay[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTrades = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('trade_replays')
      .select('*')
      .order('trade_date', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching trades",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTrades(data || []);
    }
    setLoading(false);
  };

  const createTrade = async (tradeData: Omit<TradeReplay, 'id' | 'created_at'>) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('trade_replays')
      .insert([{
        ...tradeData,
        user_id: user.id,
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error creating trade",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Trade saved!",
      description: "Your trade replay has been successfully saved.",
    });

    fetchTrades();
    return data;
  };

  const uploadFile = async (file: File) => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('trade-files')
      .upload(fileName, file);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return null;
    }

    const { data } = supabase.storage
      .from('trade-files')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  useEffect(() => {
    fetchTrades();
  }, [user]);

  return {
    trades,
    loading,
    createTrade,
    uploadFile,
    refetch: fetchTrades,
  };
};
