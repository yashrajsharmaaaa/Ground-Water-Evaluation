// components/ChatbotFloatingIcon.js
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';

const ChatbotFloatingIcon = ({ onPress, style }) => {
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, { toValue: 0.9, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.floatingButton, { transform: [{ scale: scaleValue }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.button}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubbles" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatbotFloatingIcon;
