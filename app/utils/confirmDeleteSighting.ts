import { Alert } from 'react-native';

type DeleteResult = { success: boolean; wasLastOfSpecies: boolean };

/**
 * Shared delete-with-confirmation flow for a sighting, used by both the
 * Journal card action sheet and the detail screen's ⋯ menu. Shows a confirm
 * dialog, calls the context `deleteSighting`, and surfaces the
 * "last of species" alert. `onDeleted` runs after a successful delete (e.g.
 * navigate back from the detail screen).
 */
export function confirmDeleteSighting(
  sighting: { id: string; birdName: string },
  deleteSighting: (sightingId: string) => Promise<DeleteResult>,
  onDeleted?: () => void,
) {
  Alert.alert(
    'Delete sighting?',
    `Remove this sighting of ${sighting.birdName}? This can't be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteSighting(sighting.id);
            if (!result.success) {
              console.error('confirmDeleteSighting: deleteSighting returned false');
              return;
            }
            if (result.wasLastOfSpecies) {
              Alert.alert(
                'Species Removed',
                `${sighting.birdName} has been removed from your species list as this was your only sighting.`,
                [{ text: 'OK' }]
              );
            }
            onDeleted?.();
          } catch (error) {
            console.error('Error deleting sighting:', error);
          }
        },
      },
    ]
  );
}

export default confirmDeleteSighting;
