import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  sound?: boolean;
  priority?: 'default' | 'normal' | 'high';
}

class NotificationService {
  private expoPushToken: string | null = null;

  // Request permissions and get push token
  async registerForPushNotificationsAsync(): Promise<string | null> {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A90E2',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'e404015b-633f-4820-8ffd-860bf8439a44', // Your EAS project ID
      })).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    this.expoPushToken = token || null;
    return token || null;
  }

  // Send local notification
  async sendLocalNotification(notification: NotificationData): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound !== false,
        priority: notification.priority || 'default',
      },
      trigger: null, // Send immediately
    });
    
    return notificationId;
  }

  // Schedule notification for later
  async scheduleNotification(
    notification: NotificationData, 
    trigger: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound !== false,
        priority: notification.priority || 'default',
      },
      trigger,
    });
    
    return notificationId;
  }

  // Cancel a specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // Send friend sighting notification
  async sendFriendSightingNotification(friendName: string, birdName: string, location: string): Promise<string> {
    return this.sendLocalNotification({
      title: `🐦 ${friendName} spotted a bird!`,
      body: `${birdName} at ${location}`,
      data: {
        type: 'friend_sighting',
        friendName,
        birdName,
        location,
      },
      priority: 'high',
    });
  }

  // Send new species notification
  async sendNewSpeciesNotification(birdName: string): Promise<string> {
    return this.sendLocalNotification({
      title: '🎉 New Species Discovered!',
      body: `You just logged your first ${birdName}!`,
      data: {
        type: 'new_species',
        birdName,
      },
      priority: 'high',
    });
  }

  // Send daily reminder
  async scheduleDailyReminder(): Promise<string> {
    return this.scheduleNotification(
      {
        title: '🦅 Time for Bird Watching!',
        body: 'Grab your binoculars and head outside to spot some birds!',
        data: {
          type: 'daily_reminder',
        },
      },
      {
        hour: 8, // 8 AM
        minute: 0,
        repeats: true,
      }
    );
  }

  // Send rare bird alert
  async sendRareBirdAlert(birdName: string, location: string): Promise<string> {
    return this.sendLocalNotification({
      title: '🔍 Rare Bird Alert!',
      body: `${birdName} has been spotted at ${location}`,
      data: {
        type: 'rare_bird',
        birdName,
        location,
      },
      priority: 'high',
    });
  }

  // Get push token
  getPushToken(): string | null {
    return this.expoPushToken;
  }
}

export const notificationService = new NotificationService(); 