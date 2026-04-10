import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { FilterBar } from "./src/components/FilterBar";
import { NewsCard } from "./src/components/NewsCard";
import {
  fetchAllNews,
  filterNews,
} from "./src/services/newsService";
import { NewsArticle, CategoryFilter, TabFilter } from "./src/types/news";

export default function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("france");
  const [tab, setTab] = useState<TabFilter>("jour");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async () => {
    try {
      const data = await fetchAllNews();
      setArticles(data);
    } catch (e) {
      console.error("Error fetching news:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    // Rafraîchissement automatique toutes les 15 minutes
    const interval = setInterval(loadNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNews();
  }, [loadNews]);

  const filteredArticles = filterNews(articles, category, tab);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actu Express</Text>
        <Text style={styles.headerSubtitle}>
          L'essentiel de l'info, sans le superflu
        </Text>
      </View>

      {/* Filtres */}
      <FilterBar
        category={category}
        tab={tab}
        onCategoryChange={setCategory}
        onTabChange={setTab}
      />

      {/* Liste des news */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A1A2E" />
          <Text style={styles.loadingText}>
            Chargement des actualités...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredArticles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NewsCard article={item} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            filteredArticles.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📰</Text>
              <Text style={styles.emptyTitle}>Aucune actualité</Text>
              <Text style={styles.emptyText}>
                {tab === "jour"
                  ? "Pas encore d'articles aujourd'hui. Tirez vers le bas pour rafraîchir."
                  : "Aucun article cette semaine pour cette catégorie."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FC",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
  list: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#8E8E93",
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },
});
