import { supabase } from "@/lib/supabase/client";
import { UserProfile } from "@/types/db/UserProfile";
import { UUID } from "crypto";
import { db } from "./db";
import { Store } from "@/types/db/Store";
import { PostgrestError } from "@supabase/supabase-js";

// Fetch store as type Store from store id saved in user profile
const fetchStoreForUser = async (): Promise<{ data: Store | null, error: PostgrestError | null }> => {
    const { data: userProfile, error: userError } = await db.profiles.fetch.current();

    if (userError) {
        return { data: null, error: userError };
    }

    if (!userProfile) {
        return { data: null, error: userError };
    }

    const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('store_id', userProfile.store_id)
        .single();

    if (storeError) {
        return { data: null, error: storeError };
    } else {
        return { data: storeData, error: null };
    }

};

const createStore = async (store: Store): Promise<{ data: Store | null, error: PostgrestError | null }> => {
    const { data, error } = await supabase
        .from('stores')
        .insert([store])
        .select()
        .single();

    return { data: data ?? null, error };
}

const joinStoreForUser = async (inviteCode: string): Promise<{ data: Store | null, error: PostgrestError | null }> => {
    // See if store exists with invite code
    const { data: store, error } = await supabase
        .from('stores')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

    // If store exists, update user profile with store_id
    if (store) {
        const { data: updatedProfile, error: updateError } = await db.profiles.update.store(store.store_id);
        if (updateError) {
            return { data: null, error: updateError };
        }

        return { data: store, error: null };
    } else {
        // No store, return error
        return { data: null, error };
    }
}

const updateStoreById = async (id: UUID, updatedStore: Store): Promise<{ data: Store | null, error: PostgrestError | null }> => {
    const { data, error } = await supabase
        .from('stores')
        .update(updatedStore)
        .eq('store_id', id)
        .select()
        .single();

    return { data: data ?? null, error };
}


export const stores = {
    fetch: {
        forUser: fetchStoreForUser,

    },
    create: createStore,
    update: {
        byId: updateStoreById,

    },
    join: joinStoreForUser,
};