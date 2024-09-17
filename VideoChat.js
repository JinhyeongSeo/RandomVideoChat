import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Button, FlatList, TextInput } from 'react-native';
import { RTCView, mediaDevices, mediaStream , RTCPeerConnection, RTCSessionDescription} from 'react-native-webrtc';
import io from 'socket.io-client';

const socket = io('http://10.0.2.2:3000'); // 서버 주소 입력

const VideoChat = () => {
  const localStream = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('User' + Math.floor(Math.random() * 1000));
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    const getUserMedia = async () => {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStream.current = stream;
    };

    getUserMedia();
    socket.emit('join', username);

    socket.on('userList', (userList) => {
      setUsers(userList);
    });

    socket.on('signal', async (data) => {
      if (data.from !== socket.id) {
        if (!peerConnection) {
          const pc = new RTCPeerConnection();
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('signal', { to: data.from, signal: event.candidate });
            }
          };
          pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
          };
          localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
          setPeerConnection(pc);
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { to: data.from, signal: answer });
      }
    });

    socket.on('chatMessage', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [peerConnection, username]);

  const sendMessage = () => {
    socket.emit('chatMessage', { from: username, message });
    setMessages((prev) => [...prev, { from: username, message }]);
    setMessage('');
  };

  return (
    <View style={styles.container}>
      {localStream.current && (
        <RTCView streamURL={localStream.current.toURL()} style={styles.localVideo} />
      )}
      {remoteStream && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} />
      )}
      <FlatList
        data={users}
        keyExtractor={(item) => item}
        renderItem={({ item }) => <Text style={styles.user}>{item}</Text>}
      />
      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.message}>{item.from}: {item.message}</Text>
        )}
      />
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="메시지를 입력하세요"
        style={styles.input}
      />
      <Button title="전송" onPress={sendMessage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideo: {
    width: '100%',
    height: '40%',
  },
  remoteVideo: {
    width: '100%',
    height: '40%',
  },
  user: {
    padding: 10,
    fontSize: 18,
  },
  message: {
    padding: 5,
    fontSize: 16,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});

export default VideoChat;
