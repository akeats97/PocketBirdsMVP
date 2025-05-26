import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FriendSightingCard from '../../components/FriendSightingCard';
import { useFriendSightings } from '../context/FriendSightingsContext';
import { UserProfile, followUser, isFollowing, searchUsers, unfollowUser } from '../services/userService';

// Define search result user type with following status
interface SearchResultUser extends UserProfile {
  isFollowing?: boolean;
}

export default function FriendsScreen() {
  const { friendSightings, friends, filterByFriend, isLoadingFriends, refreshFriends } = useFriendSightings();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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

  // Calculate stats for selected friend
  const friendStats = useMemo(() => {
    if (!searchQuery) return null;
    
    const friendSightings = filterByFriend(searchQuery);
    const totalSightings = friendSightings.length;
    const uniqueSpecies = new Set(friendSightings.map(sighting => sighting.birdName)).size;
    
    return {
      totalSightings,
      uniqueSpecies
    };
  }, [searchQuery, filterByFriend]);

  const openSearchModal = () => {
    setIsSearchModalVisible(true);
  };

  const closeSearchModal = () => {
    setIsSearchModalVisible(false);
    setModalSearchQuery('');
    setSearchResults([]);
    
    // Refresh friends list when modal closes to show any new follows
    refreshFriends();
  };

  const handleSearchUsers = async (text: string) => {
    setModalSearchQuery(text);
    
    if (text.length >= 2) {
      setIsSearching(true);
      console.log(`Starting search for username: "${text}"`);
      try {
        // Get users that match the search query
        const results = await searchUsers(text);
        console.log(`Search returned ${results.length} results`, results);
        
        // Check following status for each user
        const resultsWithFollowing = await Promise.all(
          results.map(async (user) => {
            const following = await isFollowing(user.uid);
            console.log(`User ${user.username} follow status: ${following ? 'Following' : 'Not following'}`);
            return {
              ...user,
              isFollowing: following
            };
          })
        );
        
        setSearchResults(resultsWithFollowing);
      } catch (error) {
        console.error('Error searching users:', error);
        Alert.alert('Error', 'Failed to search for users. Please try again.');
      } finally {
        setIsSearching(false);
      }
    } else {
      console.log('Search query too short, clearing results');
      setSearchResults([]);
    }
  };

  const handleFollowAction = async (user: SearchResultUser) => {
    if (actionInProgress === user.uid) return;
    
    setActionInProgress(user.uid);
    try {
      if (user.isFollowing) {
        // Unfollow the user
        await unfollowUser(user.uid);
        
        // Update local state
        setSearchResults(prev => 
          prev.map(u => 
            u.uid === user.uid 
              ? { ...u, isFollowing: false } 
              : u
          )
        );
      } else {
        // Follow the user
        await followUser(user.uid);
        
        // Update local state
        setSearchResults(prev => 
          prev.map(u => 
            u.uid === user.uid 
              ? { ...u, isFollowing: true } 
              : u
          )
        );
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      Alert.alert(
        'Error', 
        `Failed to ${user.isFollowing ? 'unfollow' : 'follow'} user. Please try again.`
      );
    } finally {
      setActionInProgress(null);
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFriends();
    } catch (error) {
      console.error('Error refreshing friends:', error);
    } finally {
      setIsRefreshing(false);
    }
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
      
      {/* Friend Stats Panel - shown when a friend is selected */}
      {friendStats && (
        <View style={styles.statsPanel}>
          <View style={styles.statItem}>
            <FontAwesome5 name="eye" size={18} color="#4CAF50" style={styles.statIcon} />
            <View>
              <Text style={styles.statValue}>{friendStats.totalSightings}</Text>
              <Text style={styles.statLabel}>Total Sightings</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statItem}>
            <FontAwesome5 name="feather" size={18} color="#2196F3" style={styles.statIcon} />
            <View>
              <Text style={styles.statValue}>{friendStats.uniqueSpecies}</Text>
              <Text style={styles.statLabel}>Species Seen</Text>
            </View>
          </View>
        </View>
      )}
      
      {/* Friends List (shown when searching) */}
      {showFriendsList && (
        <View style={styles.friendsListContainer}>
          {isLoadingFriends ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading friends...</Text>
            </View>
          ) : (
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
                <Text style={styles.emptyText}>
                  {searchQuery ? "No friends match your search" : "You're not following anyone yet"}
                </Text>
              }
            />
          )}
        </View>
      )}
      
      {/* Friend Sightings Feed */}
      {isLoadingFriends && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading friend activity...</Text>
        </View>
      ) : filteredSightings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No sightings found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery 
              ? `No sightings from "${searchQuery}"` 
              : friends.length > 0 
                ? "Your friends haven't shared any sightings yet"
                : "Follow some friends to see their sightings here"}
          </Text>
          {friends.length === 0 && (
            <TouchableOpacity 
              style={styles.findFriendsButton}
              onPress={openSearchModal}
            >
              <Text style={styles.findFriendsButtonText}>Find Friends</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredSightings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendSightingCard sighting={item} />}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
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
                    keyExtractor={(item) => item.uid}
                    renderItem={({ item }) => (
                      <View style={styles.searchResultItem}>
                        <View style={styles.userInfo}>
                          <Ionicons name="person-circle-outline" size={40} color="#4A90E2" />
                          <Text style={styles.username}>{item.username}</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.followButton,
                            item.isFollowing && styles.followingButton
                          ]}
                          onPress={() => handleFollowAction(item)}
                          disabled={actionInProgress === item.uid}
                        >
                          {actionInProgress === item.uid ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text style={styles.followButtonText}>
                              {item.isFollowing ? 'Following' : 'Follow'}
                            </Text>
                          )}
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
  addFriendText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#4A90E2',
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
    marginBottom: 24,
  },
  findFriendsButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  findFriendsButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
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
    minWidth: 100,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#6BB06E', // Green color for following state
  },
  followButtonText: {
    color: 'white',
    fontWeight: '600',
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
  
  // Friend Stats Panel styles
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#ddd',
  },
}); 