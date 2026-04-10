import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { NewsArticle } from "../types/news";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  article: NewsArticle;
}

function FactRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function NewsCard({ article }: Props) {
  const timeAgo = format(article.publishedAt, "dd MMM · HH:mm", {
    locale: fr,
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => Linking.openURL(article.link)}
      activeOpacity={0.7}
    >
      {/* Source + heure */}
      <View style={styles.header}>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceIcon}>{article.sourceIcon}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.sourceName}>{article.source}</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>

      {/* Headline percutant */}
      <Text style={styles.headline}>{article.headline}</Text>

      {/* Faits essentiels : Qui / Quoi / Pourquoi */}
      <View style={styles.facts}>
        <FactRow label="QUI" value={article.who} />
        <FactRow label="QUOI" value={article.what} />
        <FactRow label="POURQUOI" value={article.why} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.readMore}>Lire l'article complet →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sourceBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#1A1A2E",
    justifyContent: "center",
    alignItems: "center",
  },
  sourceIcon: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
  },
  sourceName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  time: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 1,
  },
  headline: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
    lineHeight: 23,
    marginBottom: 12,
  },
  facts: {
    backgroundColor: "#F8F8FC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  factLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#007AFF",
    width: 72,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  factValue: {
    fontSize: 14,
    color: "#2C2C3A",
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    paddingTop: 10,
  },
  readMore: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "600",
  },
});
