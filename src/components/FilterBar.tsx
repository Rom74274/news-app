import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CategoryFilter, TabFilter } from "../types/news";

interface Props {
  category: CategoryFilter;
  tab: TabFilter;
  onCategoryChange: (c: CategoryFilter) => void;
  onTabChange: (t: TabFilter) => void;
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function FilterBar({
  category,
  tab,
  onCategoryChange,
  onTabChange,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Category toggle */}
      <View style={styles.row}>
        <Pill
          label="France"
          active={category === "france"}
          onPress={() => onCategoryChange("france")}
        />
        <Pill
          label="Monde"
          active={category === "monde"}
          onPress={() => onCategoryChange("monde")}
        />
      </View>

      {/* Time toggle */}
      <View style={styles.row}>
        <Pill
          label="Aujourd'hui"
          active={tab === "jour"}
          onPress={() => onTabChange("jour")}
        />
        <Pill
          label="Cette semaine"
          active={tab === "semaine"}
          onPress={() => onTabChange("semaine")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
  },
  pillActive: {
    backgroundColor: "#1A1A2E",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
});
