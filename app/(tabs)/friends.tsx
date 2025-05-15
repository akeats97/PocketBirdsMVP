import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FriendSightingCard from '../../components/FriendSightingCard';
import { useFriendSightings } from '../context/FriendSightingsContext';

// Define search result user type
interface SearchResultUser {
  id: string;
  username: string;
}

export default function FriendsScreen() {
  const { friendSightings, friends, filterByFriend } = useFriendSightings();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
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

  const openSearchModal = () => {
    setIsSearchModalVisible(true);
  };

  const closeSearchModal = () => {
    setIsSearchModalVisible(false);
    setModalSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchUsers = (text: string) => {
    setModalSearchQuery(text);
    
    // Mock search functionality for now
    if (text.length >= 2) {
      setIsSearching(true);
      // Simulate API call delay
      setTimeout(() => {
        const mockResults: SearchResultUser[] = [
          { id: '1', username: 'birdwatcher42' },
          { id: '2', username: 'eagleeye' },
          { id: '3', username: 'crowspotter' },
        ].filter(user => 
          user.username.toLowerCase().includes(text.toLowerCase())
        );
        setSearchResults(mockResults);
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const handleFollowUser = (userId: string, username: string) => {
    // This will be implemented in the next step
    console.log(`Follow user: ${userId} (${username})`);
    // For now, just close the modal as if action succeeded
    closeSearchModal();
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Friends Activity</Text>
        <TouchableOpacity 
          style={styles.addFriendButton}
          onPress={openSearchModal}
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

      {/* Search Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSearchModalVisible}
        onRequestClose={closeSearchModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find Users to Follow</Text>
              <TouchableOpacity onPress={closeSearchModal}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Modal Search Bar */}
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by username..."
                value={modalSearchQuery}
                onChangeText={handleSearchUsers}
                autoFocus={true}
              />
              {modalSearchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setModalSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Search Results */}
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : (
              <>
                {modalSearchQuery.length > 0 ? (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <View style={styles.searchResultItem}>
                        <View style={styles.userInfo}>
                          <Ionicons name="person-circle-outline" size={40} color="#4A90E2" />
                          <Text style={styles.username}>{item.username}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.followButton}
                          onPress={() => handleFollowUser(item.id, item.username)}
                        >
                          <Text style={styles.followButtonText}>Follow</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>No users found</Text>
                    }
                  />
                ) : (
                  <View style={styles.searchPromptContainer}>
                    <Ionicons name="people-outline" size={60} color="#ccc" />
                    <Text style={styles.searchPromptText}>
                      Search for users to follow
                    </Text>
                    <Text style={styles.searchPromptSubtext}>
                      Enter a username to find other bird enthusiasts
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    height: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  followButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  searchPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  searchPromptText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
    color: '#333',
  },
  searchPromptSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 