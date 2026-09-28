import React, { useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import ChatApp from "./src/ChatApp";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import { AppState } from "react-native";

const App = () => {

  const auth = getAuth();
  const currentUid = auth.currentUser?.uid;
  const db = getFirestore();

  useEffect(() => {
    if (currentUid) trackUserStatus(currentUid);
  }, []);

  const trackUserStatus = (userId) => {
    const userRef = doc(db, 'users', userId);

    const updateOnline = () => {
      setDoc(userRef, { isOnline: true, lastSeen: Date.now() }, { merge: true });
    }

    const updateOffline = () => {
      setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
    }

    const handleAppStateChange = (nextAppState) => {
      if (currentUid) {
        if (nextAppState === 'active') {
          updateOnline();
        } else {
          updateOffline();
        }
      }
    };

    updateOnline();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      updateOffline();
    };
  };

  return (
    <NavigationContainer>
      <ChatApp />
    </NavigationContainer>
  );
};

export default App;