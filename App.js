import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, ScrollView, Alert, Modal, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [userId, setUserId] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [hourlyRate, setHourlyRate] = useState('1200');

  const API_URL = 'http://localhost:3000';
  const [startTime, setStartTime] = useState(null);
  const [timerSec, setTimerSec] = useState(0);
  const [records, setRecords] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editRate, setEditRate] = useState('');

const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('idToken');
      if (id) setUserId(id);
      if (token) setIdToken(token);
    })();
  }, []);

  useEffect(() => {
    if (userId) loadData(userId);
  }, [userId, idToken]);

  useEffect(() => {
    if (startTime) {
      timer.current = setInterval(() => {
        setTimerSec(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
      setTimerSec(0);
    }
    return () => timer.current && clearInterval(timer.current);
  }, [startTime]);

  const storageKey = (id) => `data-${id}`;

  async function loadData(id) {
    try {
      if (idToken) {
        const res = await fetch(`${API_URL}/data/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        if (res.ok) {
          const obj = await res.json();
          setRecords(obj.records || []);
          await AsyncStorage.setItem(storageKey(id), JSON.stringify({ records: obj.records || [] }));
          return;
        }
      }
      const json = await AsyncStorage.getItem(storageKey(id));
      if (json) {
        const obj = JSON.parse(json);
        setRecords(obj.records || []);
      }
    } catch (e) {}
  }

  async function saveData(list) {
    try {
      await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ records: list }));
      if (idToken) {
        await fetch(`${API_URL}/data/${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ records: list })
        });
      }
    } catch (e) {}
  }

  function getWeekNumber(date) {
    const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    return 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }

  function computeTotals(list) {
    const totals = {};
    list.forEach(r => {
      const d = new Date(r.start);
      const y = d.getFullYear().toString();
      const m = `${y}-${d.getMonth() + 1}`;
      const w = `${y}-W${getWeekNumber(d)}`;
      totals[y] = (totals[y] || 0) + r.seconds;
      totals[m] = (totals[m] || 0) + r.seconds;
      totals[w] = (totals[w] || 0) + r.seconds;
    });
    return totals;
  }

  function totalsNow(extraSec=0) {
    const totals = computeTotals(records);
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = `${y}-${now.getMonth()+1}`;
    const w = `${y}-W${getWeekNumber(now)}`;
    const yearSec = (totals[y] || 0) + extraSec;
    const monthSec = (totals[m] || 0) + extraSec;
    const weekSec = (totals[w] || 0) + extraSec;
    return { yearSec, monthSec, weekSec };
  }

  function earnedFromSeconds(sec) {
    return (Number(hourlyRate) / 3600) * sec;
  }

  function showReminders(sec) {
    const earned = earnedFromSeconds(sec);
    if (earned >= 1500000) {
      Alert.alert('注意', '年間収入が150万円を超えました。確定申告が必要な場合があります。');
    } else if (earned >= 1300000) {
      Alert.alert('注意', '年間収入が130万円を超えました。扶養判定にご注意ください。');
    } else if (earned >= 1030000) {
      Alert.alert('注意', '年間収入が103万円を超えました。扶養控除に影響する可能性があります。');
    }
  }

  function start() {
    if (startTime) return;
    setStartTime(Date.now());
  }

  function stop() {
    if (!startTime) return;
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const rec = { start: new Date(startTime).toISOString(), end: new Date().toISOString(), seconds, rate: Number(hourlyRate) };
    const list = [...records, rec].slice(-100);
    setRecords(list);
    saveData(list);
    setStartTime(null);
    showReminders(computeTotals(list)[new Date().getFullYear().toString()]);
  }

  function deleteRecord(idx) {
    const list = records.filter((_, i) => i !== idx);
    setRecords(list);
    saveData(list);
  }

  function openEdit(idx) {
    const r = records[idx];
    setEditIndex(idx);
    setEditStart(r.start.replace('T', ' ').slice(0,16));
    setEditEnd(r.end.replace('T', ' ').slice(0,16));
    setEditRate(String(r.rate));
  }

  function saveEdit() {
    const idx = editIndex;
    if (idx < 0) return;
    const start = new Date(editStart);
    const end = new Date(editEnd);
    const rate = Number(editRate);
    if (isNaN(start) || isNaN(end) || end <= start || !rate) {
      Alert.alert('エラー', '入力値が正しくありません');
      return;
    }
    const seconds = Math.floor((end - start) / 1000);
    const list = records.slice();
    list[idx] = { start: start.toISOString(), end: end.toISOString(), rate, seconds };
    setRecords(list);
    saveData(list);
    setEditIndex(-1);
  }

  const { yearSec, monthSec, weekSec } = totalsNow(startTime ? timerSec : 0);
  const allSec = records.reduce((sum, r) => sum + r.seconds, 0) + (startTime ? timerSec : 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{padding:20}}>
      {!userId ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={5}
          style={{width:'100%', height:44}}
          onPress={async () => {
            try {
              const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                  AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                  AppleAuthentication.AppleAuthenticationScope.EMAIL
                ]
              });
              setUserId(credential.user);
              setIdToken(credential.identityToken || null);
              await AsyncStorage.setItem('userId', credential.user);
              if (credential.identityToken) {
                await AsyncStorage.setItem('idToken', credential.identityToken);
              }
            } catch (e) {}
          }}
        />
      ) : (
        <View>
          <Text>Logged in as: {userId}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="時給"
          />
          <Button title={startTime ? '計測中...' : '開始'} onPress={start} disabled={!!startTime} />
          <Button title="停止" onPress={stop} disabled={!startTime} />
          <Text>現在の収益: {earnedFromSeconds(timerSec).toFixed(2)}円</Text>
          <Text>週間合計: {earnedFromSeconds(weekSec).toFixed(2)}円</Text>
          <Text>月間合計: {earnedFromSeconds(monthSec).toFixed(2)}円</Text>
          <Text>年間合計: {earnedFromSeconds(yearSec).toFixed(2)}円</Text>
          <Text>累計合計: {earnedFromSeconds(allSec).toFixed(2)}円</Text>
          <View style={{marginTop:20}}>
            <Text>履歴</Text>
            {records.map((r, idx) => (
              <View key={idx} style={styles.record}>
                <Text>{new Date(r.start).toLocaleString()} - {new Date(r.end).toLocaleString()}</Text>
                <Text>{r.seconds}s @ {r.rate}</Text>
                <Button title="編集" onPress={() => openEdit(idx)} />
                <Button title="削除" onPress={() => deleteRecord(idx)} />
              </View>
            ))}
          </View>
        </View>
      )}
      <Modal visible={editIndex >= 0} animationType="slide" transparent={false}>
        <View style={styles.modal}>
          <Text>編集</Text>
          <TextInput style={styles.input} value={editStart} onChangeText={setEditStart} />
          <TextInput style={styles.input} value={editEnd} onChangeText={setEditEnd} />
          <TextInput style={styles.input} value={editRate} onChangeText={setEditRate} keyboardType="numeric" />
          <Button title="保存" onPress={saveEdit} />
          <Button title="キャンセル" onPress={() => setEditIndex(-1)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 40 },
  input: { borderWidth: 1, padding: 8, marginVertical: 8 },
  record: { marginVertical: 4, borderBottomWidth: 1, paddingBottom: 4 },
  modal: { flex: 1, padding: 20, justifyContent: 'center' }
});
