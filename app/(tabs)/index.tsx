import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import SightingCard, { HardShadow } from '../../components/SightingCard';
import { palette, recipes, space, type } from '../../constants/Colors';
import { useSightings } from '../context/SightingsContext';
import { groupSightingsByDay } from '../utils/groupSightingsByDay';

function JournalHeader() {
  const { sightings } = useSightings();
  const speciesCount = useMemo(
    () => new Set(sightings.map((s) => s.birdName)).size,
    [sightings]
  );

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Field Journal</Text>
      <Text style={styles.subtitle}>
        {sightings.length} {sightings.length === 1 ? 'sighting' : 'sightings'} · {speciesCount} {speciesCount === 1 ? 'species' : 'species'}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <HardShadow>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing logged yet.</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + below when you see something.
          </Text>
        </View>
      </HardShadow>
    </View>
  );
}

export default function LogScreen() {
  const { sightings, isNewSpeciesForUser } = useSightings();

  const sections = useMemo(() => groupSightingsByDay(sightings), [sightings]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SightingCard
            sighting={item}
            isNewSpecies={isNewSpeciesForUser(item.birdName, item.date)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{section.title}</Text>
            <Text style={styles.dayCounts}>
              {section.sightingCount} {section.sightingCount === 1 ? 'sighting' : 'sightings'} · {section.speciesCount} {section.speciesCount === 1 ? 'species' : 'species'}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={JournalHeader}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={
          sightings.length === 0
            ? styles.emptyListContent
            : styles.listContent
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  title: {
    ...type.h1,
    color: palette.ink,
    fontWeight: '700',
  },
  subtitle: {
    ...type.body,
    color: palette.inkSoft,
    marginTop: 4,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: space.xl,
  },
  dayHeader: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    backgroundColor: palette.cream,
  },
  dayTitle: {
    ...type.h3,
    color: palette.ink,
    fontWeight: '700',
  },
  dayCounts: {
    ...type.bodyS,
    color: palette.inkSoft,
    marginTop: 2,
    fontWeight: '500',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
  },
  emptyCard: {
    ...recipes.card,
    padding: space.xl,
    alignItems: 'center',
    minWidth: 260,
  },
  emptyTitle: {
    ...type.h2,
    color: palette.ink,
    marginBottom: space.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...type.body,
    color: palette.inkSoft,
    textAlign: 'center',
  },
});
