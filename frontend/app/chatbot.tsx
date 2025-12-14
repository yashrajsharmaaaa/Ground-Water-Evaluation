// @ts-nocheck
// screens/ChatbotScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');

const ChatbotScreen = ({ navigation, groundwaterData, currentLocation }) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: "Hello! I'm JalMitra 🌊, your groundwater advisor. I can help you with water level queries, district analysis, and decision support. How can I assist you today?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('english');

  const scrollViewRef = useRef(null);

  // Backend API URL - Deployed on Render
  const API_BASE_URL = "https://jalmitra-backend.onrender.com";

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      let lat, lon;
      if (currentLocation) {
        lat = currentLocation.lat;
        lon = currentLocation.lon;
      } else {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            lat = location.coords.latitude;
            lon = location.coords.longitude;
          }
        } catch (error) {
          console.log('Location error:', error);
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText.trim(),
          lat,
          lon,
          date: new Date().toISOString().split('T')[0],
          context: groundwaterData || false,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response || "Sorry, I couldn't process your request.",
        isBot: true,
        timestamp: new Date(),
        meta: data.meta,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please check your network connection and try again.",
        isBot: true,
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      Alert.alert('Connection Error', 'Failed to send message. Please check your network connection.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = date =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = message => (
    <View
      key={message.id}
      style={[styles.messageContainer, message.isBot ? styles.botMessage : styles.userMessage]}
    >
      <View
        style={[
          styles.messageBubble,
          message.isBot ? styles.botBubble : styles.userBubble,
          message.isError && styles.errorBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            message.isBot ? styles.botText : styles.userText,
            message.isError && styles.errorText,
          ]}
        >
          {message.text}
        </Text>
        <Text style={[styles.timestamp, message.isBot ? styles.botTimestamp : styles.userTimestamp]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );

  const quickActions = [
    'Show current water level',
    'Highest water level in Jaipur',
    'Lowest water level this year',
    'Water stress analysis',
  ];

  const handleQuickAction = action => setInputText(action);

  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>JalMitra Chat</Text>
          <Text style={styles.headerSubtitle}>Groundwater Assistant</Text>
        </View>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setLanguage(prev => (prev === 'english' ? 'hindi' : 'english'))}
        >
          <Text style={styles.languageText}>{language === 'english' ? 'EN' : 'HI'}</Text>
        </TouchableOpacity>
        <View style={styles.statusIndicator}>
          <View style={styles.onlineIndicator} />
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.messagesContainer} showsVerticalScrollIndicator={false}>
        {messages.map(renderMessage)}
        {loading && (
          <View style={[styles.messageContainer, styles.botMessage]}>
            <View style={[styles.messageBubble, styles.botBubble]}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.messageText, styles.botText, styles.loadingText]}>
                JalMitra is thinking...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Actions:</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionButton}
                onPress={() => handleQuickAction(action)}
              >
                <Text style={styles.quickActionText}>{action}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about groundwater levels, districts, or analysis..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
            onFocus={scrollToBottom}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color={!inputText.trim() || loading ? '#CCC' : '#FFF'} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', elevation: 2 },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  headerSubtitle: { fontSize: 12, color: '#6B7280' },
  statusIndicator: { alignItems: 'center' },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  languageButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 6, marginRight: 12 },
  languageText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  messagesContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  messageContainer: { marginBottom: 16 },
  botMessage: { alignItems: 'flex-start' },
  userMessage: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  botBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, elevation: 1 },
  userBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  errorBubble: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 },
  messageText: { fontSize: 16, lineHeight: 20 },
  botText: { color: '#1F2937' },
  userText: { color: '#FFF' },
  errorText: { color: '#DC2626' },
  loadingText: { fontStyle: 'italic', marginLeft: 8 },
  timestamp: { fontSize: 10, marginTop: 4 },
  botTimestamp: { color: '#9CA3AF' },
  userTimestamp: { color: '#E5E7EB' },
  quickActionsContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  quickActionsTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionButton: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  quickActionText: { fontSize: 12, color: '#374151' },
  inputContainer: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  textInput: { flex: 1, maxHeight: 100, minHeight: 40, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#F3F4F6' },
});

export default ChatbotScreen;
