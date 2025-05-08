import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sighting } from '../types';

interface SightingsContextType {
  sightings: Sighting[];
  lastLocation: string;
  addSighting: (sighting: Omit<Sighting, 'id'>) => void;
}

const SightingsContext = createContext<SightingsContextType | undefined>(undefined);

const STORAGE_KEY = 'birdSightings';
const LOCATION_KEY = 'lastLocation';

export function SightingsProvider({ children }: { children: React.ReactNode }) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [lastLocation, setLastLocation] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load sightings data from AsyncStorage on startup
  useEffect(() => {
    const loadSightings = async () => {
      try {
        const storedSightings = await AsyncStorage.getItem(STORAGE_KEY);
        const storedLocation = await AsyncStorage.getItem(LOCATION_KEY);
        
        if (storedSightings !== null) {
          // Need to parse the dates back to Date objects
          const parsedSightings = JSON.parse(storedSightings).map((sighting: any) => ({
            ...sighting,
            date: new Date(sighting.date)
          }));
          setSightings(parsedSightings);
        }
        
        if (storedLocation !== null) {
          setLastLocation(storedLocation);
        }
      } catch (error) {
        console.error('Failed to load sightings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSightings();
  }, []);

  // Save sightings to AsyncStorage whenever sightings change
  useEffect(() => {
    const saveSightings = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sightings));
      } catch (error) {
        console.error('Failed to save sightings:', error);
      }
    };

    if (!isLoading) {
      saveSightings();
    }
  }, [sightings, isLoading]);

  // Save lastLocation to AsyncStorage whenever it changes
  useEffect(() => {
    const saveLocation = async () => {
      try {
        await AsyncStorage.setItem(LOCATION_KEY, lastLocation);
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    };

    if (!isLoading && lastLocation) {
      saveLocation();
    }
  }, [lastLocation, isLoading]);

  const addSighting = (sighting: Omit<Sighting, 'id'>) => {
    const newSighting: Sighting = {
      ...sighting,
      id: Date.now().toString(), // Simple way to generate unique IDs
    };
    setSightings(prev => [newSighting, ...prev]); // Add new sighting at the beginning
    setLastLocation(sighting.location); // Store the last used location
  };

  return (
    <SightingsContext.Provider value={{ sightings, lastLocation, addSighting }}>
      {children}
    </SightingsContext.Provider>
  );
}

export function useSightings() {
  const context = useContext(SightingsContext);
  if (context === undefined) {
    throw new Error('useSightings must be used within a SightingsProvider');
  }
  return context;
} 