import { supabase } from './supabase';
import { MindMapState } from '../types';

export interface MapEntry {
  id: string;
  name: string;
  data: { nodes: Record<string, any>; rootId: string; selectedId: string | null };
  created_at: string;
  updated_at: string;
}

// ---- Supabase API ----

export async function fetchMaps(): Promise<MapEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('maps')
    .select('id, name, data, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchMap(id: string): Promise<MapEntry | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('maps')
    .select('id, name, data, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMap(name: string, state: MindMapState): Promise<MapEntry> {
  if (!supabase) throw new Error('Not connected to Supabase');
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('maps')
    .insert({
      user_id: userData.user.id,
      name,
      data: { nodes: state.nodes, rootId: state.rootId, selectedId: state.selectedId },
    })
    .select('id, name, data, created_at, updated_at')
    .single();
  if (error) throw error;
  return data!;
}

export async function updateMap(id: string, state: MindMapState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('maps')
    .update({
      data: { nodes: state.nodes, rootId: state.rootId, selectedId: state.selectedId },
    })
    .eq('id', id);
  if (error) throw error;
}

export async function renameMapApi(id: string, name: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('maps')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMapApi(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('maps')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
