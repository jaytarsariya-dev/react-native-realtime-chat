import { getAuth, GoogleAuthProvider, signOut } from "@react-native-firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Button, FlatList, Image, ImageBackground, PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { createStackNavigator } from "@react-navigation/stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, onSnapshot, orderBy, query, setDoc, where, writeBatch, onDisconnect, updateDoc } from "@react-native-firebase/firestore";
import Icon from 'react-native-vector-icons/Ionicons';
import Icon1 from 'react-native-vector-icons/MaterialIcons';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as ImagePicker from 'react-native-image-picker';
import Icon2 from 'react-native-vector-icons/Fontisto';
import storage from '@react-native-firebase/storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
})

const Login = () => {

    const [loading, setLoading] = useState(false);
    const db = getFirestore();
    const navigation = useNavigation();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    console.log('Id is : ',currentUser);
    

    useEffect(() => {
        const subscriber = auth.onAuthStateChanged((user) => {
            if (user) {
                const providerData = user.providerData[0];
                const providerId = providerData.providerId;

                if (providerId === 'facebook.com' || providerId === 'google.com') {
                    console.log(`Logged in with ${providerId}:`, user);
                    navigation.replace('BottomTab');
                }
            }
        });
        return () => subscriber();
    }, [navigation]);

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            await GoogleSignin.signOut();
            await GoogleSignin.hasPlayServices();
            const userData = await GoogleSignin.signIn();
            const googleCredential = GoogleAuthProvider.credential(userData.data.idToken);
            const result = await auth.signInWithCredential(googleCredential);

            await setDoc(doc(db, 'users', result.user.uid), {
                uid: result.user.uid,
                displayName: result.user.displayName,
                email: result.additionalUserInfo.profile.email,
                photoURL: result.user.photoURL,
                aboutMe: 'I’m a passionate React Native developer with a strong focus on UI/UX design and seamless user experiences. I have hands-on experience working with Firebase, authentication systems, and effective state management. I’m always eager to learn new technologies and strive to build intuitive, user-friendly applications. I believe in writing clean code, collaborating effectively, and continuously improving both my skills and my projects.',
            })
            navigation.navigate('BottomTab')
            console.log(result);
            ToastAndroid.show('Login with Google', ToastAndroid.SHORT);
        } catch (error) {
            console.warn('Google Sign-In failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ImageBackground source={require('./assets/kohli.jpg')} style={{ flex: 1, }} resizeMode="cover">
                <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.80)', paddingVertical: 30, paddingHorizontal: 20, justifyContent: 'flex-end' }}>
                    <Text style={{ color: '#f9c733', fontSize: 35, fontWeight: 500, marginBottom: 10, marginStart: 10 }}>Sign in</Text>
                    <Text style={{ color: 'white', marginBottom: 18, marginStart: 10 }}>Sign in with Any Of Your Google Account</Text>
                    <TouchableOpacity disabled={loading} onPress={handleGoogleSignIn} style={{ height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', borderRadius: 25 }}>
                        {loading ? <ActivityIndicator size={'small'} color={'black'}></ActivityIndicator> :
                            <Text style={{ color: 'black', fontSize: 16, fontWeight: "600" }}>Continue with Google</Text>
                        }</TouchableOpacity>
                </View>
            </ImageBackground>
        </View>
    );
};

const Chat = () => {

    const [users, setUsers] = useState([]);
    const [serachText, setSearchText] = useState('');
    const navigation = useNavigation();
    const db = getFirestore();
    const currentUid = getAuth().currentUser?.uid;


    useEffect(() => {
        const unsubscribers = [];

        if (currentUid) {

            const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
                const Chat = snapshot.docs
                    .map(doc => ({ ...doc.data(), id: doc.id }))
                    .filter(user => user.id !== currentUid);

                const userWithBadge = [];

                Chat.forEach(user => {
                    const chatId = [currentUid, user.id].sort().join('_');
                    const messagesRef = collection(db, 'chats', chatId, 'messages');

                    const q = query(
                        messagesRef,
                        where('senderId', '==', user.uid),
                        where('isRead', '==', false)
                    );

                    const unsubscribeMessages = onSnapshot(q, (messageSnapshot) => {
                        const unreadCount = messageSnapshot.size;

                        setUsers(prevUsers => {
                            const updated = prevUsers.map(u =>
                                u.uid === user.uid ? { ...u, unreadCount } : u
                            );

                            const exists = updated.find(u => u.uid === user.uid);
                            if (!exists) {
                                return [...updated, { ...user, unreadCount }];
                            }

                            return updated;
                        });
                    });

                    unsubscribers.push(unsubscribeMessages);
                });
            });

            unsubscribers.push(unsubscribeUsers);
        }

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const snapshot = await getDocs(collection(db, 'users'));
            const allUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })
            ).filter(user => user.id !== currentUid);

            let searchStr = serachText.trim();
            if (searchStr === '') {
                setUsers(allUsers);
                return;
            }

            const lowerSearch = searchStr.toLowerCase();
            const filtered = allUsers.filter(user => {
                const name = (user.displayName || '').toLowerCase();

                if (lowerSearch.length === 1) {
                    const firstLetters = name.split(' ').map(word => word.charAt(0));
                    return firstLetters.includes(lowerSearch)
                }

                const words = name.split(' ');
                return words.some(word => word.startsWith(lowerSearch));
            });
            setUsers(filtered)
        };
        fetchData();
    }, [serachText])

    const goToChat = (user) => {
        navigation.navigate('ChatScreen', { user });
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#29282b', paddingHorizontal: 15, paddingVertical: 20, paddingTop: 20 }}>
            <StatusBar backgroundColor={'#29282b'}></StatusBar>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25, backgroundColor: '#343436', borderRadius: 15, paddingStart: 15, height: 50, justifyContent: 'space-between' }}>
                <TextInput
                    maxLength={20}
                    value={serachText}
                    onChangeText={setSearchText}
                    placeholder="Search ..."
                    placeholderTextColor="rgb(255, 242, 242)"
                    style={{
                        color: 'white',
                        fontWeight: '500',
                        width: '90%'
                    }}></TextInput>
                {serachText && (
                    <TouchableOpacity style={{ marginEnd: 10 }} onPress={() => {
                        setSearchText('');
                    }}>
                        <Icon name="close" color="white" size={25} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                showsVerticalScrollIndicator={false}
                data={users}
                keyExtractor={item => item.uid}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', padding: 16, alignItems: 'center', backgroundColor: '#343436', borderRadius: 15, marginBottom: 10, justifyContent: 'space-between' }}
                        onPress={() => goToChat(item)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: item.photoURL }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            <Text style={{ marginLeft: 16, color: 'white', fontWeight: '500' }}>{item.displayName}</Text>
                        </View>
                        {item.unreadCount > 0 && (
                            <View style={{
                                backgroundColor: 'red',
                                height: 23,
                                width: 23,
                                borderRadius: 11.5,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Text style={{ color: 'white', fontSize: 12 }}>{item.unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}></FlatList>
        </View>
    )
}

const ChatScreen = () => {
    const route = useRoute();
    const db = getFirestore();
    const auth = getAuth();
    const { user } = route.params;
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const currentUid = auth.currentUser.uid;
    const chatId = [currentUid, user.uid].sort().join('_');
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const flatListRef = useRef(null);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const typingTimeout = useRef(null);
    const [receiverStatus, setReceiverStatus] = useState({ isOnline: false, lastSeen: null });

    useEffect(() => {
        const currentUid = getAuth().currentUser?.uid;
        if (!currentUid) return;

        const q = query(messagesRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);

            const unreadMessages = querySnapshot.docs.filter(
                doc => doc.data().receiverId === currentUid && doc.data().isRead === false
            );

            const batch = writeBatch(db);
            unreadMessages.forEach(doc => {
                batch.update(doc.ref, { isRead: true });
            });

            if (!unreadMessages.length === 0) return;
            try {
                await batch.commit();
            } catch (err) {
                console.error('Failed to update isRead:', err);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!chatId || !currentUid) return;

        const otherUserId = chatId.replace(currentUid, '').replace('_', '');
        const typingRef = doc(db, 'chats', chatId, 'typingStatus', otherUserId);
        const receiverRef = doc(db, 'users', otherUserId);

        const unsubscribe = onSnapshot(typingRef, (docSnap) => {
            if (docSnap.exists) {
                const data = docSnap.data();
                setIsOtherUserTyping(data.isTyping);
            } else {
                setIsOtherUserTyping(false);
            }
        });

        const unsubscribe1 = onSnapshot(receiverRef, (docSnap) => {
            if (docSnap.exists) {
                const data = docSnap.data();
                setReceiverStatus({
                    isOnline: data.isOnline || false,
                    lastSeen: data.lastSeen || null
                });
            } else {
                setReceiverStatus({ isOnline: false, lastSeen: null });
            }
        });

        return () => { unsubscribe(); unsubscribe1(); }
    }, [chatId, currentUid]);


    useEffect(() => {
        flatListRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
        });
    }, [messages]);

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


    const sendMessage = async () => {
        if (text.trim() === '') return;
        setText('');
        await addDoc(messagesRef, {
            text,
            senderId: currentUid,
            receiverId: user.uid,
            isRead: false,
            timestamp: new Date(),
            time: `${new Date().getHours() % 12 || 12}:${new Date().getMinutes().toString().padStart(2, '0')} ${new Date().getHours() >= 12 ? 'PM' : 'AM'}`
        });
    };

    const handleTyping = (text) => {
        setText(text);

        const typingRef = doc(db, 'chats', chatId, 'typingStatus', currentUid);
        setDoc(typingRef, { isTyping: true }, { merge: true });

        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }

        typingTimeout.current = setTimeout(() => {
            setDoc(typingRef, { isTyping: false }, { merge: true });
        }, 1000);
    };

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return;

        const now = Date.now();
        const timeDiff = now - timestamp;
        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
        const daysDiff = Math.floor(hoursDiff / 24);

        if (daysDiff >= 1) {
            return `last seen at ${daysDiff} day${daysDiff > 1 ? 's' : ''} ago`;
        } else {
            const date = new Date(timestamp);
            return `last seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <StatusBar backgroundColor={'#434041'} />
            <View style={{ alignItems: 'center', backgroundColor: '#434041', paddingTop: 17, paddingBottom: 29, borderBottomLeftRadius: 50, borderBottomEndRadius: 50, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <Image source={{ uri: user.photoURL }} style={{ width: 30, height: 30, borderRadius: 15 }} />
                    <Text style={{ color: 'white', fontSize: 17, marginStart: 10 }}>{user.displayName}</Text>
                </View>
                <Text style={{ color: receiverStatus.isOnline ? 'rgb(23, 253, 73)' : '#acacac' }}>{receiverStatus.isOnline ? 'Online' : formatLastSeen(receiverStatus.lastSeen)}</Text>
            </View>
            <View style={{ backgroundColor: 'black', paddingTop: 20, flex: 1 }}>
                <FlatList
                    ref={flatListRef}
                    showsVerticalScrollIndicator={false}
                    data={messages}
                    inverted
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <View style={{
                            paddingHorizontal: 10,
                            paddingTop: 8,
                            paddingBottom: 3,
                            backgroundColor: item.senderId === currentUid ? '#01385f' : '#373737',
                            marginVertical: 3,
                            marginHorizontal: 20,
                            alignSelf: item.senderId === currentUid ? 'flex-end' : 'flex-start',
                            borderRadius: 10,
                            maxWidth: '70%',
                            flexDirection: 'row'
                        }}>
                            <Text
                                style={{
                                    color: 'white',
                                    marginBottom: 5,
                                    maxWidth: '73%'
                                }}
                            >
                                {item.text}
                            </Text>
                            <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 10 }}>
                                <Text style={{ color: '#acacac', fontSize: 10, marginStart: 7 }}>{item.time}</Text>
                                {item.senderId === currentUid &&
                                    <Icon style={{ marginStart: 5 }} size={14} color={item.isRead === true ? 'rgb(23, 253, 73)' : '#acacac'} name={'checkmark-done'} ></Icon>
                                }
                            </View>
                        </View>
                    )}
                />
            </View>
            {isOtherUserTyping && (
                <View style={{
                    paddingHorizontal: 10,
                    paddingTop: 8,
                    paddingBottom: 8,
                    backgroundColor: '#373737',
                    marginVertical: 3,
                    marginHorizontal: 20,
                    alignSelf: 'flex-start',
                    borderRadius: 10,
                }}>
                    <Text
                        style={{
                            color: 'white',
                            marginBottom: 2
                        }}
                    >
                        Typing...
                    </Text>
                </View>
            )}
            <View style={{ flexDirection: 'row', padding: 10, alignItems: 'center' }}>
                <TextInput
                    multiline
                    value={text}
                    onChangeText={handleTyping}
                    placeholder="Type a message ..."
                    placeholderTextColor={'#acacac'}
                    style={{ flex: 1, borderWidth: 1, backgroundColor: '#2b2b2b', borderRadius: 10, padding: 10 }}
                />
                <TouchableOpacity
                    onPress={sendMessage}
                    style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 50,
                        width: 50,
                        borderRadius: 25,
                        backgroundColor: '#01385f',
                        marginStart: 5,
                    }}
                >
                    <Icon name={'send'} size={20} color={'white'} />
                </TouchableOpacity>
            </View>
        </View>
    );
};


const Setting = () => {

    const auth = getAuth();
    const currentUid = auth.currentUser?.uid;
    const db = getFirestore();
    const navigation = useNavigation();
    const [userData, setUserData] = useState(null);
    const [name, setName] = useState(userData?.displayName || '');
    const [photo, setPhoto] = useState(userData?.photoURL || '');
    const [aboutMe, setAboutMe] = useState(userData?.aboutMe || '');
    const [loading, setLoading] = useState(false);
    const [loading1, setLoading1] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'users', currentUid), (docSnap) => {
            if (docSnap.exists) {
                const x = docSnap.data();
                setUserData(x);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (userData) {
            setName(userData.displayName || '');
            setPhoto(userData.photoURL || '');
            setAboutMe(userData.aboutMe || '');
        }
    }, [userData]);

    const handleLogout = async () => {
        setLoading1(true);
        try {
            Alert.alert(
                'Logout', 'Are you sure want to logout ?',
                [
                    {
                        text: 'No',
                        style: 'cancel',
                    },
                    {
                        text: 'Yes',
                        style: 'destructive',
                        onPress: async () => {
                            if (currentUid) {
                                const userRef = doc(db, 'users', currentUid);
                                await setDoc(userRef, { isOnline: false, lastSeen: Date.now() }, { merge: true });
                            }
                            await signOut(auth);
                            ToastAndroid.show('Logout Successfully', ToastAndroid.SHORT);
                            navigation.replace('Login');
                        }
                    }
                ],
                { cancelable: false }
            );

        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading1(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {

            if (!name.trim()) {
                alert('Enter your Name');
                return;
            }

            if (!aboutMe.trim()) {
                alert('Enter detail about your possion');
                return;
            }

            const userDocRef = doc(db, 'users', currentUid);
            let photoUrlToSave = photo;

            if (photo && !photo.startsWith('http')) {
                const filename = photo.substring(photo.lastIndexOf('/') + 1);
                const reference = storage().ref(`profile_images/${currentUid}/${filename}`);
                await reference.putFile(photo);
                photoUrlToSave = await reference.getDownloadURL();
            }

            await updateDoc(userDocRef, {
                displayName: name || '',
                photoURL: photoUrlToSave || 'https://www.google.com/imgres?q=transparent%20image&imgurl=https%3A%2F%2Fstatic.vecteezy.com%2Fsystem%2Fresources%2Fthumbnails%2F003%2F793%2F482%2Fsmall_2x%2Ftransparent-grid-pattern-for-background-vector.jpg&imgrefurl=https%3A%2F%2Fwww.vecteezy.com%2Ffree-vector%2Ftransparent&docid=iHR7-_RPGPQeNM&tbnid=XXE7XodpIdPBlM&vet=12ahUKEwjv2rugy52NAxV_aPUHHdMeJB0QM3oECDsQAA..i&w=632&h=400&hcb=2&ved=2ahUKEwjv2rugy52NAxV_aPUHHdMeJB0QM3oECDsQAA',
                aboutMe: aboutMe || '',
            });

            ToastAndroid.show('Profile updated successfully', ToastAndroid.SHORT);
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    }

    const requestGalleryPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const permission =
                    Platform.Version >= 33
                        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
                const granted = await PermissionsAndroid.request(permission, {
                    title: 'Gallery Permission',
                    message: 'I need Permission to Select Image from Gallery',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                });
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const selectImage = async () => {
        const hasPermission = await requestGalleryPermission();
        if (hasPermission) {
            ImagePicker.launchImageLibrary(
                { mediaType: 'photo', quality: 1 },
                (response) => {
                    if (response.didCancel) {
                        console.log('User cancelled image picker');
                    } else if (response.errorCode) {
                        console.log('Image Picker Error:', response.errorMessage);
                    } else if (response.assets && response.assets.length > 0) {
                        setPhoto(response.assets[0].uri);
                    }
                }
            );
        } else {
            console.log('Gallery permission denied');
        }
    };

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#29282b' }}>
            <TouchableOpacity onPress={selectImage}><Image source={{ uri: photo || 'https://www.google.com/imgres?q=transparent%20image&imgurl=https%3A%2F%2Fstatic.vecteezy.com%2Fsystem%2Fresources%2Fthumbnails%2F003%2F793%2F482%2Fsmall_2x%2Ftransparent-grid-pattern-for-background-vector.jpg&imgrefurl=https%3A%2F%2Fwww.vecteezy.com%2Ffree-vector%2Ftransparent&docid=iHR7-_RPGPQeNM&tbnid=XXE7XodpIdPBlM&vet=12ahUKEwjv2rugy52NAxV_aPUHHdMeJB0QM3oECDsQAA..i&w=632&h=400&hcb=2&ved=2ahUKEwjv2rugy52NAxV_aPUHHdMeJB0QM3oECDsQAA' }} style={{ height: 150, width: 150, borderRadius: 75, marginBottom: 30 }}></Image></TouchableOpacity>
            <TextInput
                placeholder="Enter Name"
                placeholderTextColor="gray"
                value={name}
                onChangeText={setName}
                style={{
                    width: '90%',
                    padding: 8,
                    color: 'white',
                    height: 50,
                    borderRadius: 15,
                    marginEnd: 8,
                    marginBottom: 20,
                    paddingStart: 15,
                    backgroundColor: '#343436',
                    fontWeight: '500'
                }}></TextInput>
            <TextInput
                placeholderTextColor="gray"
                value={userData?.email}
                editable={false}
                style={{
                    width: '90%',
                    padding: 8,
                    color: 'white',
                    height: 50,
                    borderRadius: 15,
                    marginEnd: 8,
                    marginBottom: 20,
                    paddingStart: 15,
                    backgroundColor: '#343436',
                    fontWeight: '500'
                }}></TextInput>
            <TextInput
                placeholder="About me..."
                placeholderTextColor="gray"
                value={aboutMe}
                onChangeText={setAboutMe}
                multiline
                style={{
                    width: '90%',
                    padding: 8,
                    color: 'white',
                    height: '40%',
                    borderRadius: 15,
                    marginEnd: 8,
                    marginBottom: 25,
                    paddingStart: 15,
                    backgroundColor: '#343436',
                    fontWeight: '500',
                    verticalAlign: 'top',
                    lineHeight: 25
                    // maxHeight:'100%'
                }}></TextInput>
            <View style={{ flexDirection: 'row', width: '90%', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={handleSave} style={{ backgroundColor: 'rgba(76, 175, 80, 0.8)', height: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 15, width: '49%' }}>
                    {loading ? <ActivityIndicator size={'small'} color={'white'}></ActivityIndicator> :
                        <Text style={{ color: 'white', fontSize: 15, fontWeight: '500' }}>Save</Text>
                    }
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: 'rgba(244, 67, 54, 0.8)', height: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 15, width: '49%' }}>
                    {loading1 ? <ActivityIndicator size={'small'} color={'white'}></ActivityIndicator> :
                        <Text style={{ color: 'white', fontSize: 15, fontWeight: '500' }}>Logout</Text>
                    }
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

const CustomTab = ({ state, navigation }) => {
    // const navigation = useNavigation();

    return (
        <View style={{ backgroundColor: '#29282b' }}>
            <View style={{ height: 70, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#2d3a3d', width: '95%', alignSelf: 'center', bottom: 10, borderRadius: 25, paddingHorizontal: 10 }}>
                {state.routeNames.map((routeName, index) => {
                    const isFocused = index === state.index;
                    let icon;

                    if (routeName === 'Chat') {
                        icon = 'chat';
                    } else if (routeName === 'Setting') {
                        icon = 'settings';
                    }

                    return (
                        <TouchableOpacity
                            key={routeName}
                            onPress={() => navigation.navigate(routeName)}
                            style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', height: '65%' }, isFocused && { flex: 1, backgroundColor: '#214d59', borderRadius: 20 }]}>
                            <Icon1 name={icon} color={isFocused ? '#a3cddf' : '#b5c5c4'} size={25}></Icon1>
                            {isFocused ? (
                                <Text style={[{ marginLeft: 7, fontSize: 15, color: '#a3cddf', }, isFocused && { fontWeight: 'bold' }]}>{routeName}</Text>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    )
}

const BottomTab = () => {

    const bottomTab = createBottomTabNavigator();

    return (
        <bottomTab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTab {...props}></CustomTab>}>
            <bottomTab.Screen name="Chat" component={Chat}></bottomTab.Screen>
            <bottomTab.Screen name="Setting" component={Setting}></bottomTab.Screen>
        </bottomTab.Navigator>
    )
}

const ChatApp = () => {

    const Stack = createStackNavigator();

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "none" }}>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="BottomTab" component={BottomTab} />
            <Stack.Screen name="ChatScreen" component={ChatScreen} />
        </Stack.Navigator>
    )
}


export default ChatApp;