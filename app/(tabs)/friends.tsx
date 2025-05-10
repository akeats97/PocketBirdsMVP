import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FriendSightingCard from '../../components/FriendSightingCard';
import { useFriendSightings } from '../context/FriendSightingsContext';

export default function FriendsScreen() {
  const { friendSightings, friends, filterByFriend } = useFriendSightings();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriendsList, setShowFriendsList] = useState(false);
  
  // Filter friends based on search query
  const filteredFriends = useMemo(() => {
    if (!searchQuery) return friends;
    return friends.filter(friend => 
      friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, friends]);
  
  // Filter sightings based on selected friend (if any)
  const filteredSightings = useMemo(() => {
    return filterByFriend(searchQuery);
  }, [searchQuery, filterByFriend]);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Friends Activity</Text>
        <TouchableOpacity 
          style={styles.addFriendButton}
          onPress={() => console.log('Add friend button pressed')}
        >
          <Ionicons name="person-add-outline" size={20} color="#4A90E2" />
          <Text style={styles.addFriendText}>Add</Text>
        </TouchableOpacity>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            setShowFriendsList(text.length > 0);
          }}
          onFocus={() => setShowFriendsList(true)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              setSearchQuery('');
              setShowFriendsList(false);
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Friends List (shown when searching) */}
      {showFriendsList && (
        <View style={styles.friendsListContainer}>
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.friendItem}
                onPress={() => {
                  setSearchQuery(item.name);
                  setShowFriendsList(false);
                }}
              >
                <Ionicons name="person-circle-outline" size={24} color="#4A90E2" />
                <Text style={styles.friendName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No friends found</Text>
            }
          />
        </View>
      )}
      
      {/* Friend Sightings Feed */}
      {filteredSightings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No sightings found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery ? `No sightings from "${searchQuery}"` : "Your friends haven't shared any sightings yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSightings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendSightingCard sighting={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addFriendButton: {
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e1ebf9',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  friendsListContainer: {
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eeeeee',
    marginBottom: 16,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  friendName: {
    fontSize: 16,
    marginLeft: 8,
  },
  emptyText: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  addFriendText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#4A90E2',
  },
}); 