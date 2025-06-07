import { useState, useEffect, useCallback } from 'react';

// DEPRECATED: This hook is no longer the primary way to store application data.
// Supabase is now used for persistent storage.
// This file can be removed once all components are fully migrated.

function getValue<T,>(key: string, initialValue: T | (() => T)): T {
    const savedValue = localStorage.getItem(key);
    if (savedValue !== null && savedValue !== 'undefined' && savedValue !== 'null') { 
        try {
            return JSON.parse(savedValue) as T;
        } catch (error) {
            console.warn(`DEPRECATED: Error parsing localStorage key "${key}":`, error);
            // localStorage.removeItem(key); // Avoid removing if other parts still briefly use it
        }
    }
    if (initialValue instanceof Function) {
        return initialValue();
    }
    return initialValue;
}

export function useLocalStorage<T,>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
    console.warn(`DEPRECATED: useLocalStorage is active for key "${key}". This should be migrated to Supabase.`);
    const [value, setValue] = useState<T>(() => getValue(key, initialValue));

    const setStoredValue = useCallback((newValue: T | React.SetStateAction<T>) => {
        setValue(prevValue => {
            const result = newValue instanceof Function ? newValue(prevValue) : newValue;
            try {
                // localStorage.setItem(key, JSON.stringify(result)); // Avoid writing back too much if being phased out
            } catch (error) {
                console.error(`DEPRECATED: Error setting localStorage key "${key}":`, error);
            }
            return result;
        });
    }, [key]);


    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === key) {
                 if (event.newValue === null || event.newValue === 'undefined' || event.newValue === 'null' ) {
                    // ...
                 } else {
                    try {
                        // setValue(JSON.parse(event.newValue) as T);
                    } catch (error) {
                        console.warn(`DEPRECATED: Error parsing storage change for key "${key}":`, error);
                    }
                 }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key]);


    return [value, setStoredValue];
}
